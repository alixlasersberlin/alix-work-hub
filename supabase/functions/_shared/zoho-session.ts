// Zoho-Session-Handler: hält pro Zoho-Konto ein Zugriffstoken im Speicher, erneuert es kurz vor
// Ablauf automatisch, bündelt parallele Anmeldungen und meldet sich bei abgelaufenem/ungültigem
// Token (401) genau einmal neu an. Bei Zoho-Anmeldesperre wird kurz gewartet statt Zoho zu fluten.
export interface ZohoSessionConfig {
  accountsBaseUrl: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  organizationId: string;
}

export class ZohoRateLimitError extends Error {}

const REFRESH_MARGIN_MS = 5 * 60_000;
const cache = new Map<string, { token: string; expiresAt: number }>();
const inflight = new Map<string, Promise<string>>();
const cooldownUntil = new Map<string, number>();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const keyOf = (c: ZohoSessionConfig) => `${c.accountsBaseUrl}|${c.clientId}|${c.organizationId}`;

async function requestToken(cfg: ZohoSessionConfig) {
  const res = await fetch(`${cfg.accountsBaseUrl}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: cfg.refreshToken,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json().catch(() => null);
  if (data?.access_token) {
    return { token: String(data.access_token), expiresIn: Number(data.expires_in) || 3600 };
  }
  const text = JSON.stringify(data);
  if (res.status === 429 || /too many requests|access denied/i.test(text)) throw new ZohoRateLimitError(text);
  throw new Error(`Zoho token error: ${text}`);
}

async function refresh(cfg: ZohoSessionConfig, key: string): Promise<string> {
  const delays = [0, 5_000, 15_000];
  let last: unknown;
  for (const d of delays) {
    const wait = Math.max(d, (cooldownUntil.get(key) ?? 0) - Date.now());
    if (wait > 0) await sleep(Math.min(wait, 20_000));
    try {
      const { token, expiresIn } = await requestToken(cfg);
      cache.set(key, { token, expiresAt: Date.now() + Math.max(60_000, expiresIn * 1000 - REFRESH_MARGIN_MS) });
      cooldownUntil.delete(key);
      return token;
    } catch (e) {
      last = e;
      if (!(e instanceof ZohoRateLimitError)) throw e;
      cooldownUntil.set(key, Date.now() + 15_000);
    }
  }
  throw new ZohoRateLimitError(
    'Zoho hat zu viele Anmeldungen in kurzer Zeit gemeldet. Bitte einige Minuten warten und dann erneut versuchen.',
    { cause: last },
  );
}

export function getZohoAccessToken(cfg: ZohoSessionConfig, force = false): Promise<string> {
  const key = keyOf(cfg);
  const cached = cache.get(key);
  if (!force && cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.token);
  const pending = inflight.get(key);
  if (pending) return pending;
  if (force) cache.delete(key);
  const p = refresh(cfg, key).finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/** Fetch mit Zoho-Token; bei 401 einmal neu anmelden und denselben Lesezugriff wiederholen. */
export async function zohoFetch(cfg: ZohoSessionConfig, url: string, init: RequestInit = {}): Promise<Response> {
  const run = (token: string) => {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Zoho-oauthtoken ${token}`);
    return fetch(url, { ...init, headers });
  };
  const used = await getZohoAccessToken(cfg);
  const res = await run(used);
  if (res.status !== 401) return res;
  await res.body?.cancel();
  const current = cache.get(keyOf(cfg));
  const fresh = current && current.token !== used ? current.token : await getZohoAccessToken(cfg, true);
  return run(fresh);
}

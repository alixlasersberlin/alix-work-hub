// Alix ID — SSO Client Library
// -----------------------------------------------------------------------------
// Wiederverwendbarer Baustein für ALLE angebundenen Alix-Apps (AlixSmart, Academy,
// Medi Metropole, Mediapaket, Studio, eAnamnese, Alix Finance, …).
//
// Die App importiert diese Datei (oder eine 1:1-Kopie) und ruft:
//
//   const alixId = createAlixIdClient({
//     issuer: 'https://id.alixwork.de',        // Origin von Alix ID
//     appKey: 'alixsmart',                     // = alix_applications.app_key
//     redirectUri: 'https://smart.alix.de/sso/callback',
//   });
//
//   // 1. Login-Button
//   await alixId.startLogin({ state: { returnTo: '/dashboard' } });
//
//   // 2. Auf /sso/callback (der App-Route):
//   const session = await alixId.completeLogin();
//   // → { identity, organizations, apps, access_token, expires_at, state }
//
// Sicherheit:
// - PKCE S256 (browsergeneriert, verifier bleibt nur im sessionStorage).
// - state enthält CSRF-Nonce + optionale App-Payload (JSON in base64url).
// - Code + Verifier werden POST → /functions/v1/alix-id-token getauscht.
// - Kein Access-Token in der URL.
// -----------------------------------------------------------------------------

export type AlixIdConfig = {
  issuer: string;
  appKey: string;
  redirectUri: string;
  /** Optionaler Organisations-Kontext (nur wenn der Nutzer mehrere Orgs hat). */
  organizationId?: string;
  /** Optionaler Auth-Endpoint-Override (Standard: <issuer>/id/login) */
  authPath?: string;
  /** Optionaler Token-Endpoint-Override (Standard: <issuer>/functions/v1/alix-id-token) */
  tokenPath?: string;
};

export type AlixIdSession = {
  identity: {
    id: string;
    display_name: string | null;
    primary_email: string;
    account_type: string;
    preferred_language: string;
  };
  organizations: Array<{
    id: string;
    display_name: string | null;
    legal_name: string;
    relationship_type: string;
  }>;
  apps: Array<{ id: string; app_key: string; app_name: string; app_role: string }>;
  access_token: string;
  expires_at: string;
  state: unknown;
};

const STORAGE_KEY = 'alix-id.pkce';

function b64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256(input: string): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return b64url(h);
}

function randomString(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return b64url(arr.buffer);
}

export function createAlixIdClient(cfg: AlixIdConfig) {
  const issuer = cfg.issuer.replace(/\/$/, '');
  const authUrl = `${issuer}${cfg.authPath ?? '/id/login'}`;
  const tokenUrl = `${issuer}${cfg.tokenPath ?? '/functions/v1/alix-id-token'}`;

  async function startLogin(opts: { state?: unknown } = {}): Promise<void> {
    const verifier = randomString(32);
    const challenge = await sha256(verifier);
    const nonce = randomString(16);
    const statePayload = { n: nonce, s: opts.state ?? null };
    const state = btoa(JSON.stringify(statePayload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ verifier, nonce, appKey: cfg.appKey }));

    const params = new URLSearchParams({
      app_key: cfg.appKey,
      redirect_uri: cfg.redirectUri,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state,
    });
    if (cfg.organizationId) params.set('organization_id', cfg.organizationId);
    window.location.assign(`${authUrl}?${params.toString()}`);
  }

  async function completeLogin(): Promise<AlixIdSession> {
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const err = url.searchParams.get('error');
    if (err) throw new Error(`alix_id_error:${err}`);
    if (!code || !state) throw new Error('alix_id_missing_code_or_state');

    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error('alix_id_pkce_missing');
    sessionStorage.removeItem(STORAGE_KEY);
    const { verifier, nonce, appKey } = JSON.parse(raw);
    if (appKey !== cfg.appKey) throw new Error('alix_id_app_key_mismatch');

    // Decode + validate state
    const padded = state.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(atob(padded + '=='.slice(0, (4 - padded.length % 4) % 4)));
    if (decoded.n !== nonce) throw new Error('alix_id_nonce_mismatch');

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, code_verifier: verifier, redirect_uri: cfg.redirectUri }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`alix_id_token_failed:${res.status}:${text}`);
    }
    const data = await res.json();
    return { ...data, state: decoded.s } as AlixIdSession;
  }

  function issuerUrl() { return issuer; }

  return { startLogin, completeLogin, issuerUrl };
}

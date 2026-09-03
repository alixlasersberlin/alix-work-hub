// push-send-native – Versand nativer Push-Nachrichten via FCM (Android) und APNs (iOS).
// Wird vom reminder-scheduler aufgerufen. Kein direkter Client-Zugriff.
//
// Erwartete Secrets (werden erst gebraucht, wenn native Push scharf geschaltet wird):
//   FCM_SERVICE_ACCOUNT_JSON  – Google-Service-Account (voller JSON-Inhalt)
//   APNS_KEY_P8               – Inhalt des .p8-Auth-Keys von Apple
//   APNS_KEY_ID               – 10-stellige Key-ID
//   APNS_TEAM_ID              – 10-stellige Team-ID
//   APNS_BUNDLE_ID            – Bundle-ID der iOS-App (= appId aus capacitor.config.ts)
//   APNS_USE_SANDBOX          – "true" für Sandbox (Debug-Builds), sonst Production

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { create as createJwt, getNumericDate } from 'https://deno.land/x/djwt@v3.0.2/mod.ts';

interface SendPayload {
  user_id: string;
  title: string;
  body: string;
  url?: string;
  notification_type?: string;
  data?: Record<string, string>;
}

/** Whitelist erlaubter Notification-Typen (P0-2, Punkt 18). */
const ALLOWED_TYPES = new Set([
  'NEW_MESSAGE', 'ASSIGNED', 'P1_ALERT', 'P2_ALERT', 'ESCALATION',
  'TICKET_CREATED', 'FOLLOW_UP', 'SYSTEM', 'TEST',
]);

const MAX_TITLE = 120;
const MAX_BODY = 400;
const MAX_DATA_BYTES = 2048;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const encoder = new TextEncoder();

/** Konstantzeit-Vergleich, verhindert Timing-Angriffe auf das interne Secret. */
function timingSafeEqual(a: string, b: string): boolean {
  const ab = encoder.encode(a);
  const bb = encoder.encode(b);
  if (ab.length !== bb.length || ab.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

/**
 * P0-2: Nur vertrauenswürdige interne Server-/Edge-Prozesse dürfen Push auslösen.
 * Akzeptiert werden ausschliesslich:
 *   - Header `x-alix-internal-key` == INTERNAL_PUSH_SECRET, ODER
 *   - Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
 * Normale User-JWTs werden abgelehnt — sie könnten sonst beliebige Empfänger setzen.
 */
function isInternalCaller(req: Request): boolean {
  const internal = Deno.env.get('INTERNAL_PUSH_SECRET') ?? '';
  const provided = req.headers.get('x-alix-internal-key') ?? '';
  if (internal && provided && timingSafeEqual(provided, internal)) return true;

  const svcKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const auth = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (svcKey && auth && timingSafeEqual(auth, svcKey)) return true;

  return false;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  if (!isInternalCaller(req)) {
    console.warn('push-send-native: unauthorized caller rejected');
    return json({ error: 'unauthorized' }, 401);
  }

  const body = (await req.json().catch(() => null)) as SendPayload | null;
  if (!body?.user_id || !UUID_RE.test(String(body.user_id))) {
    return json({ error: 'invalid user_id' }, 400);
  }
  if (!body.title || typeof body.title !== 'string' || body.title.length > MAX_TITLE) {
    return json({ error: 'invalid title' }, 400);
  }
  if (body.body && (typeof body.body !== 'string' || body.body.length > MAX_BODY)) {
    return json({ error: 'invalid body' }, 400);
  }
  if (body.notification_type && !ALLOWED_TYPES.has(body.notification_type)) {
    return json({ error: 'invalid notification_type' }, 400);
  }
  if (body.data && encoder.encode(JSON.stringify(body.data)).length > MAX_DATA_BYTES) {
    return json({ error: 'data payload too large' }, 400);
  }
  body.title = body.title.slice(0, MAX_TITLE);
  body.body = String(body.body ?? '').slice(0, MAX_BODY);

  const svc = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Zielvalidierung: existiert der User und ist das Profil aktiv?
  const { data: profile } = await svc
    .from('user_profiles')
    .select('id, status')
    .eq('id', body.user_id)
    .maybeSingle();
  if (!profile) return json({ error: 'unknown target user' }, 400);
  if (profile.status && String(profile.status).toLowerCase() !== 'active'
      && String(profile.status).toLowerCase() !== 'aktiv') {
    return json({ ok: true, skipped: 'user inactive', count: 0, results: [] });
  }

  const { data: subs, error } = await svc
    .from('mobile_push_subscriptions')
    .select('id, platform, native_token, notifications_enabled, revoked_at')
    .eq('user_id', body.user_id)
    .in('platform', ['ios', 'android']);
  if (error) return json({ error: error.message }, 500);

  const active = (subs || []).filter((s) => s.native_token && !s.revoked_at && s.notifications_enabled !== false);
  if (active.length === 0) {
    return json({ ok: true, skipped: 'no active devices', count: 0, results: [] });
  }

  const results: Array<{ platform: string; ok: boolean; error?: string }> = [];
  for (const sub of active) {
    try {
      if (sub.platform === 'android') {
        await sendFcm(sub.native_token!, body);
        results.push({ platform: 'android', ok: true });
      } else if (sub.platform === 'ios') {
        await sendApns(sub.native_token!, body);
        results.push({ platform: 'ios', ok: true });
      }
    } catch (e) {
      results.push({ platform: sub.platform, ok: false, error: String((e as Error).message) });
    }
  }

  return json({ ok: true, count: results.length, results });
});


// ---------- FCM (HTTP v1) ----------

async function sendFcm(token: string, p: SendPayload) {
  const svcJson = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON');
  if (!svcJson) throw new Error('FCM_SERVICE_ACCOUNT_JSON not configured');
  const svc = JSON.parse(svcJson);

  const accessToken = await getGoogleAccessToken(svc);
  const url = `https://fcm.googleapis.com/v1/projects/${svc.project_id}/messages:send`;

  const message = {
    message: {
      token,
      notification: { title: p.title, body: p.body },
      data: { url: p.url ?? '/m/kalender', ...(p.data ?? {}) },
      android: { priority: 'HIGH' as const },
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });
  if (!res.ok) throw new Error(`FCM ${res.status}: ${await res.text()}`);
}

async function getGoogleAccessToken(svc: { client_email: string; private_key: string }) {
  const now = getNumericDate(0);
  const jwt = await createJwt(
    { alg: 'RS256', typ: 'JWT' },
    {
      iss: svc.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    },
    await importPkcs8(svc.private_key, 'RS256'),
  );
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  if (!res.ok) throw new Error(`Google OAuth ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return j.access_token as string;
}

// ---------- APNs (HTTP/2 via fetch – Deno unterstützt HTTP/2) ----------

async function sendApns(token: string, p: SendPayload) {
  const keyP8 = Deno.env.get('APNS_KEY_P8');
  const keyId = Deno.env.get('APNS_KEY_ID');
  const teamId = Deno.env.get('APNS_TEAM_ID');
  const bundleId = Deno.env.get('APNS_BUNDLE_ID');
  const sandbox = Deno.env.get('APNS_USE_SANDBOX') === 'true';
  if (!keyP8 || !keyId || !teamId || !bundleId) {
    throw new Error('APNS_* secrets not configured');
  }

  const now = getNumericDate(0);
  const jwt = await createJwt(
    { alg: 'ES256', typ: 'JWT', kid: keyId },
    { iss: teamId, iat: now },
    await importPkcs8(keyP8, 'ES256'),
  );

  const host = sandbox ? 'api.sandbox.push.apple.com' : 'api.push.apple.com';
  const url = `https://${host}/3/device/${token}`;

  const payload = {
    aps: { alert: { title: p.title, body: p.body }, sound: 'default', badge: 1 },
    url: p.url ?? '/m/kalender',
    ...(p.data ?? {}),
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `bearer ${jwt}`,
      'apns-topic': bundleId,
      'apns-push-type': 'alert',
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`APNs ${res.status}: ${await res.text()}`);
}

// ---------- Key-Import (PEM -> CryptoKey) ----------

async function importPkcs8(pem: string, alg: 'RS256' | 'ES256') {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const algo: RsaHashedImportParams | EcKeyImportParams =
    alg === 'RS256'
      ? { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }
      : { name: 'ECDSA', namedCurve: 'P-256' };
  return crypto.subtle.importKey('pkcs8', bin, algo, false, ['sign']);
}

function json(v: unknown, status = 200) {
  return new Response(JSON.stringify(v), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

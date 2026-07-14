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
  data?: Record<string, string>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const body = (await req.json().catch(() => null)) as SendPayload | null;
  if (!body?.user_id || !body?.title) {
    return json({ error: 'invalid payload' }, 400);
  }

  const svc = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: subs, error } = await svc
    .from('mobile_push_subscriptions')
    .select('id, platform, native_token')
    .eq('user_id', body.user_id)
    .in('platform', ['ios', 'android']);
  if (error) return json({ error: error.message }, 500);

  const results: Array<{ platform: string; ok: boolean; error?: string }> = [];
  for (const sub of subs || []) {
    if (!sub.native_token) continue;
    try {
      if (sub.platform === 'android') {
        await sendFcm(sub.native_token, body);
        results.push({ platform: 'android', ok: true });
      } else if (sub.platform === 'ios') {
        await sendApns(sub.native_token, body);
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

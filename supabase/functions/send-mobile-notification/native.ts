// Native Push-Transport (FCM HTTP v1 + APNs). Secrets ausschließlich serverseitig.
import { create as createJwt, getNumericDate } from 'https://deno.land/x/djwt@v3.0.2/mod.ts';

export interface NativePayload {
  title: string;
  body: string;
  url: string;
  priority: string;
  sound: boolean;
  threadId: string;
  data: Record<string, string>;
  badge?: number;
  androidChannel: string;
  iosCategory: string;
}

export function fcmConfigured() {
  return !!Deno.env.get('FCM_SERVICE_ACCOUNT_JSON');
}
export function apnsConfigured() {
  return !!(Deno.env.get('APNS_KEY_P8') && Deno.env.get('APNS_KEY_ID')
    && Deno.env.get('APNS_TEAM_ID') && Deno.env.get('APNS_BUNDLE_ID'));
}

function pemToArrayBuffer(pem: string) {
  const b64 = pem.replace(/-----BEGIN [^-]+-----/, '').replace(/-----END [^-]+-----/, '').replace(/\s+/g, '');
  const raw = atob(b64);
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  return buf.buffer;
}

async function importPkcs8(pem: string, alg: 'RS256' | 'ES256') {
  const params = alg === 'RS256'
    ? { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }
    : { name: 'ECDSA', namedCurve: 'P-256' };
  return await crypto.subtle.importKey('pkcs8', pemToArrayBuffer(pem.replace(/\\n/g, '\n')), params, false, ['sign']);
}

export async function sendFcm(token: string, p: NativePayload): Promise<string> {
  const svcJson = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON');
  if (!svcJson) throw new Error('FCM_SERVICE_ACCOUNT_JSON not configured');
  const svc = JSON.parse(svcJson);
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
  const tokRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  if (!tokRes.ok) throw new Error(`Google OAuth ${tokRes.status}: ${await tokRes.text()}`);
  const accessToken = (await tokRes.json()).access_token as string;

  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${svc.project_id}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        token,
        notification: { title: p.title, body: p.body },
        data: { url: p.url, ...p.data },
        android: {
          priority: 'HIGH',
          notification: {
            channel_id: p.androidChannel,
            tag: p.threadId,
            default_sound: p.sound,
            default_vibrate_timings: true,
            notification_priority: p.priority === 'P1' ? 'PRIORITY_MAX' : 'PRIORITY_DEFAULT',
          },
        },
      },
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`FCM ${res.status}: ${text}`);
  try { return JSON.parse(text).name ?? ''; } catch { return ''; }
}

export async function sendApns(token: string, p: NativePayload): Promise<string> {
  const keyP8 = Deno.env.get('APNS_KEY_P8');
  const keyId = Deno.env.get('APNS_KEY_ID');
  const teamId = Deno.env.get('APNS_TEAM_ID');
  const bundleId = Deno.env.get('APNS_BUNDLE_ID');
  const sandbox = Deno.env.get('APNS_USE_SANDBOX') === 'true';
  if (!keyP8 || !keyId || !teamId || !bundleId) throw new Error('APNS_* secrets not configured');

  const jwt = await createJwt(
    { alg: 'ES256', typ: 'JWT', kid: keyId },
    { iss: teamId, iat: getNumericDate(0) },
    await importPkcs8(keyP8, 'ES256'),
  );
  const host = sandbox ? 'api.sandbox.push.apple.com' : 'api.push.apple.com';
  const res = await fetch(`https://${host}/3/device/${token}`, {
    method: 'POST',
    headers: {
      authorization: `bearer ${jwt}`,
      'apns-topic': bundleId,
      'apns-push-type': 'alert',
      'apns-priority': p.priority === 'P1' ? '10' : '5',
      'apns-collapse-id': p.threadId.slice(0, 63),
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      aps: {
        alert: { title: p.title, body: p.body },
        sound: p.sound ? (p.priority === 'P1' ? 'default' : 'default') : undefined,
        badge: p.badge,
        'thread-id': p.threadId,
        category: p.iosCategory,
        'interruption-level': p.priority === 'P1' ? 'time-sensitive' : 'active',
      },
      url: p.url,
      ...p.data,
    }),
  });
  if (!res.ok) throw new Error(`APNs ${res.status}: ${await res.text()}`);
  return res.headers.get('apns-id') ?? '';
}

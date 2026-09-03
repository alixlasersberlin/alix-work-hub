import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { verifyMetaSignature, verifyTwilioSignature, detectProvider, timingSafeEqual } from './verify.ts';

const APP_SECRET = 'test_app_secret_value';
const TWILIO_TOKEN = 'test_twilio_auth_token';
Deno.env.set('WHATSAPP_APP_SECRET', APP_SECRET);
Deno.env.set('TWILIO_AUTH_TOKEN', TWILIO_TOKEN);

const enc = new TextEncoder();
async function metaSig(secret: string, raw: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const buf = await crypto.subtle.sign('HMAC', key, enc.encode(raw));
  return 'sha256=' + Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function twilioSig(token: string, url: string, form: Record<string, string>) {
  let data = url;
  for (const k of Object.keys(form).sort()) data += k + form[k];
  const key = await crypto.subtle.importKey('raw', enc.encode(token), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const buf = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

const RAW = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ id: '1' }] });

Deno.test('Meta: gültige Signatur wird akzeptiert', async () => {
  const r = await verifyMetaSignature(RAW, await metaSig(APP_SECRET, RAW));
  assertEquals(r.ok, true);
});

Deno.test('Meta: fehlende Signatur wird abgelehnt', async () => {
  const r = await verifyMetaSignature(RAW, null);
  assertEquals(r.ok, false);
  assertEquals(r.reason, 'SIGNATURE_MISSING');
});

Deno.test('Meta: falsche Signatur wird abgelehnt', async () => {
  const r = await verifyMetaSignature(RAW, await metaSig('wrong_secret', RAW));
  assertEquals(r.ok, false);
  assertEquals(r.reason, 'SIGNATURE_INVALID');
});

Deno.test('Meta: nachträglich veränderter Body wird abgelehnt', async () => {
  const sig = await metaSig(APP_SECRET, RAW);
  const tampered = RAW.replace('"1"', '"999"');
  const r = await verifyMetaSignature(tampered, sig);
  assertEquals(r.ok, false);
});

Deno.test('Twilio: gültige Signatur wird akzeptiert', async () => {
  const url = 'https://example.com/functions/v1/ac-webhook-whatsapp';
  const form = { From: 'whatsapp:+4917100000', Body: 'Hallo', MessageSid: 'SM1' };
  const r = await verifyTwilioSignature(url, form, await twilioSig(TWILIO_TOKEN, url, form));
  assertEquals(r.ok, true);
});

Deno.test('Twilio: ungültige Signatur wird abgelehnt', async () => {
  const url = 'https://example.com/functions/v1/ac-webhook-whatsapp';
  const form = { From: 'whatsapp:+4917100000', Body: 'Hallo' };
  const r = await verifyTwilioSignature(url, form, await twilioSig('wrong', url, form));
  assertEquals(r.ok, false);
});

Deno.test('Provider-Erkennung nutzt nur Transport-Merkmale', () => {
  const meta = new Request('https://x/', { method: 'POST', headers: { 'x-hub-signature-256': 'sha256=aa' } });
  assertEquals(detectProvider(meta, 'application/json'), 'META');
  const tw = new Request('https://x/', { method: 'POST', headers: { 'x-twilio-signature': 'aa' } });
  assertEquals(detectProvider(tw, 'application/x-www-form-urlencoded'), 'TWILIO');
  const none = new Request('https://x/', { method: 'POST' });
  assertEquals(detectProvider(none, 'text/plain'), null);
});

Deno.test('timingSafeEqual arbeitet korrekt', () => {
  assertEquals(timingSafeEqual('abc', 'abc'), true);
  assertEquals(timingSafeEqual('abc', 'abd'), false);
  assertEquals(timingSafeEqual('abc', 'abcd'), false);
});

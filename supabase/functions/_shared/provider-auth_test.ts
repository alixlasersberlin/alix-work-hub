import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import twilio from 'npm:twilio@5.10.4';
import { Webhook } from 'npm:standardwebhooks@1.0.0';
import { validTwilioRequest, verifyMailPayload, sameTicketSender } from './provider-auth.ts';

Deno.test('Twilio authenticates the fixed provider URL and rejects changed body or host', async () => {
  Deno.env.set('SUPABASE_URL', 'https://project.example.test');
  const url = 'https://project.example.test/functions/v1/ac-webhook-twilio';
  const signature = twilio.getExpectedTwilioSignature('test-private-token', url, { From: '+491234', Body: 'test' });
  const make = (text: string, sig = signature) => new Request(url, { method: 'POST', headers: {
    'content-type': 'application/x-www-form-urlencoded', 'x-twilio-signature': sig,
  }, body: text });
  assertEquals(await validTwilioRequest(make('From=%2B491234&Body=test'), 'ac-webhook-twilio', 'test-private-token'), true);
  assertEquals(await validTwilioRequest(make('From=%2B491234&Body=changed'), 'ac-webhook-twilio', 'test-private-token'), false);
  const wrongUrl = twilio.getExpectedTwilioSignature('test-private-token', 'https://attacker.test', { From: '+491234', Body: 'test' });
  assertEquals(await validTwilioRequest(make('From=%2B491234&Body=test', wrongUrl), 'ac-webhook-twilio', 'test-private-token'), false);
  assertEquals(await validTwilioRequest(make('From=x'), 'ac-webhook-twilio', ''), false);
});
Deno.test('mail requires a signed unmodified body and fresh provider timestamp', () => {
  const secret = btoa('test-private-mail-secret');
  const hook = new Webhook(secret);
  const raw = JSON.stringify({ data: { from: 'customer@example.test' } });
  const now = new Date();
  const headers = new Headers({ 'svix-id': 'event-123', 'svix-timestamp': String(Math.floor(now.getTime() / 1000)), 'svix-signature': hook.sign('event-123', now, raw) });
  assertEquals(verifyMailPayload(raw, headers, `whsec_${secret}`), JSON.parse(raw));
  assertThrows(() => verifyMailPayload(raw + ' ', headers, secret));
  assertThrows(() => verifyMailPayload(raw, headers, ''));
  const old = new Date(Date.now() - 600_000);
  headers.set('svix-timestamp', String(Math.floor(old.getTime() / 1000)));
  headers.set('svix-signature', hook.sign('event-123', old, raw));
  assertThrows(() => verifyMailPayload(raw, headers, secret));
});
Deno.test('a ticket number alone never authorizes another sender', () => {
  assertEquals(sameTicketSender('customer@example.test', 'CUSTOMER@example.test'), true);
  assertEquals(sameTicketSender('attacker@example.test', 'customer@example.test'), false);
  assertEquals(sameTicketSender('', null), false);
});
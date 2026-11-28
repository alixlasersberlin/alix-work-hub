import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import twilio from 'npm:twilio@5.10.4';
const id = '00000000-0000-4000-8000-000000000001';
const host = 'security-machines.example.test';
type Handler = (req: Request) => Promise<Response>;
const handlers = new Map<string, Handler>();
async function load(name: string) {
  Deno.env.set('SUPABASE_URL', `https://${host}`); Deno.env.set('SUPABASE_ANON_KEY', 'public-machines'); Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'service-machines'); Deno.env.set('CRON_SECRET', 'cron-machines'); Deno.env.set('TWILIO_AUTH_TOKEN', 'synthetic-twilio'); Deno.env.set('RESEND_API_KEY', 'synthetic-resend');
  const saved = handlers.get(name); if (saved) return saved;
  const original = Deno.serve; let h: Handler | undefined;
  Deno.serve = ((fn: Handler) => { h = fn; return {}; }) as typeof Deno.serve;
  try { await import(`../${name}/index.ts`); } finally { Deno.serve = original; }
  if (!h) throw new Error('Handler missing'); handlers.set(name, h); return h;
}
const request = (body: unknown, token = 'cron-machines') => new Request(`https://${host}/test`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
for (const name of ['sig-entity-sync', 'ticket-user-notify', 'ticket-auto-close']) {
  Deno.test(`Machine ${name} rejects public, forged and ordinary staff credentials before data access`, async () => {
    const h = await load(name), original = fetch; let calls = 0;
    globalThis.fetch = async () => { calls++; throw new Error('Unauthorized access'); };
    try { for (const t of ['', 'public-machines', 'forged', 'staff']) { const r = await h(request({}, t)); assertEquals(r.status, 401); await r.body?.cancel(); } assertEquals(calls, 0); } finally { globalThis.fetch = original; }
  });
}
Deno.test('Signature entity status comes only from the stored completed document', async () => {
  const h = await load('sig-entity-sync'), original = fetch; let update: any;
  globalThis.fetch = async (input, init) => {
    const u = new URL(String(input instanceof Request ? input.url : input)); assertEquals(u.hostname, host);
    if (u.pathname.endsWith('/sig_documents')) return Response.json({ id, entity_type: 'order', entity_id: id, status: 'signiert', completed_at: '2026-11-28T12:00:00Z' });
    assert(u.pathname.endsWith('/orders')); assertEquals(init?.method, 'PATCH'); update = JSON.parse(String(init?.body)); return new Response(null, { status: 204 });
  };
  try { const r = await h(request({ document_id: id, status: 'abgelehnt' })); assertEquals(r.status, 200); await r.body?.cancel(); assertEquals(update.signature_status, 'signiert'); assertEquals(update.signature_signed_at, '2026-11-28T12:00:00Z'); } finally { globalThis.fetch = original; }
});
Deno.test('Signature entity cannot fabricate a missing completion timestamp', async () => {
  const h = await load('sig-entity-sync'), original = fetch;
  globalThis.fetch = async input => { const u = new URL(String(input instanceof Request ? input.url : input)); assert(u.pathname.endsWith('/sig_documents')); return Response.json({ id, entity_type: 'order', entity_id: id, status: 'signiert', completed_at: null }); };
  try { const r = await h(request({ document_id: id, status: 'signiert' })); assertEquals(r.status, 409); await r.body?.cancel(); } finally { globalThis.fetch = original; }
});
Deno.test('Signature entity cannot become signed through an incoming status override', async () => {
  const h = await load('sig-entity-sync'), original = fetch; let update: any;
  globalThis.fetch = async (input, init) => { const u = new URL(String(input instanceof Request ? input.url : input)); if (u.pathname.endsWith('/sig_documents')) return Response.json({ id, entity_type: 'order', entity_id: id, status: 'versendet', completed_at: null }); update = JSON.parse(String(init?.body)); return new Response(null, { status: 204 }); };
  try { const r = await h(request({ document_id: id, status: 'signiert' })); assertEquals(r.status, 200); await r.body?.cancel(); assertEquals(update.signature_status, 'versendet'); assertEquals(update.signature_signed_at, undefined); } finally { globalThis.fetch = original; }
});
Deno.test('Signature entity reports failed database writes as failure', async () => {
  const h = await load('sig-entity-sync'), original = fetch;
  globalThis.fetch = async input => { const u = new URL(String(input instanceof Request ? input.url : input)); if (u.pathname.endsWith('/sig_documents')) return Response.json({ id, entity_type: 'order', entity_id: id, status: 'versendet' }); return Response.json({ message: 'write failed' }, { status: 409 }); };
  try { const r = await h(request({ document_id: id })); assertEquals(r.status, 500); await r.body?.cancel(); } finally { globalThis.fetch = original; }
});
Deno.test('Ticket notification rejects added recipient parameters before reading the notification', async () => {
  const h = await load('ticket-user-notify'), original = fetch;
  globalThis.fetch = async () => { throw new Error('Invalid recipient read data'); };
  try { const r = await h(request({ notification_id: id, to: 'attacker@example.test' })); assertEquals(r.status, 400); await r.body?.cancel(); } finally { globalThis.fetch = original; }
});
Deno.test('Ticket notification skips inactive stored recipient without provider calls', async () => {
  const h = await load('ticket-user-notify'), original = fetch;
  globalThis.fetch = async input => { const u = new URL(String(input instanceof Request ? input.url : input)); if (u.pathname.endsWith('/ticket_notifications')) return Response.json({ id, user_id: id, ticket_id: id, kind: 'assigned' }); assert(u.pathname.endsWith('/user_profiles')); return Response.json({ email: 'staff@example.test', is_active: false, account_status: 'disabled' }); };
  try { const r = await h(request({ notification_id: id })); assertEquals(r.status, 200); assertEquals((await r.json()).skipped, 'no active user email'); } finally { globalThis.fetch = original; }
});
Deno.test('Ticket notification sends only to the stored active user and treats saved HTML as text', async () => {
  const h = await load('ticket-user-notify'), original = fetch; let mail: any;
  globalThis.fetch = async (input, init) => { const u = new URL(String(input instanceof Request ? input.url : input)); if (u.hostname === 'api.resend.com') { mail = JSON.parse(String(init?.body)); return Response.json({ id: 'synthetic-mail' }); } assertEquals(u.hostname, host); if (u.pathname.endsWith('/ticket_notifications')) return Response.json({ id, user_id: id, ticket_id: id, kind: 'assigned', title: '<script>danger()</script>', actor_name: '<img src=x onerror=danger()>' }); if (u.pathname.endsWith('/user_profiles')) return Response.json({ email: 'stored@example.test', is_active: true, account_status: 'active', invitation_status: 'accepted', password_reset_required: false }); if (u.pathname.endsWith('/tickets')) return Response.json({ title: '<iframe src=evil>' }); throw new Error('Unexpected request'); };
  try { const r = await h(request({ notification_id: id })); assertEquals(r.status, 200); await r.body?.cancel(); assertEquals(mail.to, ['stored@example.test']); assertEquals(mail.html.includes('<script>'), false); assertEquals(mail.html.includes('<iframe'), false); assertEquals(mail.html.includes('<img src=x'), false); } finally { globalThis.fetch = original; }
});
Deno.test('Automatic ticket closure uses only its existing private RPC', async () => {
  const h = await load('ticket-auto-close'), original = fetch; let calls = 0;
  globalThis.fetch = async input => { const u = new URL(String(input instanceof Request ? input.url : input)); assertEquals(u.hostname, host); assertEquals(u.pathname, '/rest/v1/rpc/ticket_auto_close_stale'); calls++; return Response.json(0); };
  try { const r = await h(request({})); assertEquals(r.status, 200); await r.body?.cancel(); assertEquals(calls, 1); } finally { globalThis.fetch = original; }
});
Deno.test('Calendar WhatsApp rejects unsigned and invalidly signed input before reads or writes', async () => {
  const h = await load('esc-whatsapp-inbound'), original = fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('Forged webhook write'); };
  try { for (const sig of ['', 'forged']) { const r = await h(new Request(`https://${host}/functions/v1/esc-whatsapp-inbound`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'x-twilio-signature': sig }, body: 'From=whatsapp%3A%2B49123456789&Body=JA' })); assertEquals(r.status, 401); await r.body?.cancel(); } assertEquals(calls, 0); } finally { globalThis.fetch = original; }
});
Deno.test('Calendar WhatsApp accepts a genuine synthetic provider signature with its established confirmation flow', async () => {
  const h = await load('esc-whatsapp-inbound'), original = fetch; let event: any;
  const params = { From: 'whatsapp:+49123456789', Body: 'JA' };
  const url = `https://${host}/functions/v1/esc-whatsapp-inbound`;
  const signature = twilio.getExpectedTwilioSignature('synthetic-twilio', url, params);
  globalThis.fetch = async (input, init) => { const u = new URL(String(input instanceof Request ? input.url : input)); assertEquals(u.hostname, host); if (u.pathname.endsWith('/esc_event_participants')) return Response.json({ id, event_id: id }); if (u.pathname.endsWith('/esc_events')) event = JSON.parse(String(init?.body)); return new Response(null, { status: 201 }); };
  try { const r = await h(new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'x-twilio-signature': signature }, body: new URLSearchParams(params) })); assertEquals(r.status, 200); await r.body?.cancel(); assertEquals(event.status, 'bestaetigt'); } finally { globalThis.fetch = original; }
});
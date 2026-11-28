import { assertEquals } from 'jsr:@std/assert@1';
import { handleAppointment, ticketPatchFor, type AppointmentDeps } from './handler.ts';

const TICKET = '11111111-1111-4111-8111-111111111111';
const cors = {};
const req = (body: unknown, auth = 'Bearer staff') => new Request('https://x.test', { method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

function chain(result: any, log: string[], label: string) {
  const q: any = new Proxy({}, { get: (_t, p) => {
    if (p === 'then') return (res: any) => res(result);
    if (p === 'maybeSingle' || p === 'single') return async () => result;
    return (...args: any[]) => { if (['insert', 'update', 'delete'].includes(String(p))) log.push(`${label}:${String(p)}:${JSON.stringify(args[0])}`); return q; };
  } });
  return q;
}
function deps(opts: { visible?: boolean; mayUpdate?: boolean; authorized?: boolean } = {}) {
  const log: string[] = []; const mails: any[] = [];
  const { visible = true, mayUpdate = true, authorized = true } = opts;
  const ticket = { id: TICKET, ticket_number: 'T-1', title: '<script>x</script>', customer_name: 'Max <b>', customer_email: 'kunde@example.test', department: null };
  const caller = { from: (t: string) => t === 'tickets'
    ? { select: () => chain({ data: visible ? ticket : null, error: null }, log, 'caller'), update: (p: any) => { log.push(`caller:tickets:update:${JSON.stringify(p)}`); return chain({ data: mayUpdate ? [{ id: TICKET }] : [], error: null }, log, 'caller'); } }
    : chain({ data: null, error: null }, log, 'caller') };
  const admin = { from: (t: string) => chain(t === 'esc_departments' ? { data: { id: 'dep' }, error: null } : t === 'esc_events' ? { data: { id: 'ev1' }, error: null } : { data: null, error: null }, log, `admin:${t}`) };
  const d: AppointmentDeps = {
    access: async () => authorized ? { caller, user: { id: 'staff-id' } } : { response: new Response('{}', { status: 401 }) },
    admin, sendMail: async (body) => { mails.push(body); return { error: null }; },
  };
  return { d, log, mails };
}

Deno.test('unauthenticated callers are rejected before any write', async () => {
  const { d, log } = deps({ authorized: false });
  assertEquals((await handleAppointment(req({ ticket_id: TICKET, start_at: '2026-12-01T10:00:00Z' }, ''), cors, d)).status, 401);
  assertEquals(log.length, 0);
});

Deno.test('invalid input returns 400 with field errors', async () => {
  const { d } = deps();
  const res = await handleAppointment(req({ ticket_id: 'nope', start_at: 'x' }), cors, d);
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(Object.keys(body.fields).sort(), ['start_at', 'ticket_id']);
});

Deno.test('tickets the caller cannot read are not found and nothing is written', async () => {
  const { d, log, mails } = deps({ visible: false });
  assertEquals((await handleAppointment(req({ ticket_id: TICKET, start_at: '2026-12-01T10:00:00Z' }), cors, d)).status, 404);
  assertEquals(log.length, 0); assertEquals(mails.length, 0);
});

Deno.test('callers without ticket update rights get 403 and no event or mail is created', async () => {
  const { d, log, mails } = deps({ mayUpdate: false });
  assertEquals((await handleAppointment(req({ ticket_id: TICKET, start_at: '2026-12-01T10:00:00Z' }), cors, d)).status, 403);
  assertEquals(log.filter(l => l.startsWith('admin:')).length, 0); assertEquals(mails.length, 0);
});

Deno.test('authorized appointment mails only the stored address with escaped content', async () => {
  const { d, log, mails } = deps();
  const res = await handleAppointment(req({ ticket_id: TICKET, start_at: '2026-12-01T10:00:00Z', customer_email: 'attacker@evil.test' }), cors, d);
  assertEquals(res.status, 200);
  assertEquals(mails.length, 1);
  assertEquals(mails[0].to_email, 'kunde@example.test');
  assertEquals(mails[0].body_html.includes('<script>'), false);
  assertEquals(mails[0].body_html.includes('Max &lt;b&gt;'), true);
  assertEquals(log.some(l => l.startsWith('caller:tickets:update')), true);
});

Deno.test('event kinds map to the documented ticket fields', () => {
  assertEquals(Object.keys(ticketPatchFor('rueckruf', 'x')), ['due_at']);
  assertEquals(Object.keys(ticketPatchFor('wiedervorlage', 'x')), ['follow_up_at']);
  assertEquals(ticketPatchFor('kundentermin', 'x').status, 'Termin vereinbart');
});

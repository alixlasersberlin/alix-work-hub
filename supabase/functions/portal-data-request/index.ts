// GDPR data request (export / delete / rectification).
import { authPortalUser, audit, json, corsHeaders, sendMail } from '../_shared/portal-auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const ctx = await authPortalUser(req);
  if ('error' in ctx) return ctx.error;
  const { admin, user, customerId, ip, ua } = ctx;

  const b = await req.json().catch(() => ({}));
  const kind = ['export','delete','rectify','restrict'].includes(b.kind) ? b.kind : null;
  const note = String(b.note ?? '').trim().slice(0, 3000);
  if (!kind) return json({ error: 'invalid_input' }, 400);

  const { data: row, error } = await admin.from('customer_portal_data_requests').insert({
    customer_id: customerId, auth_user_id: user.id,
    kind, note, status: 'open',
  }).select('id').single();
  if (error) return json({ error: error.message }, 400);

  await audit(admin, {
    customer_id: customerId, auth_user_id: user.id,
    action: 'gdpr_request_created', object_type: 'data_request', object_id: row.id,
    ip_address: ip, user_agent: ua, metadata: { kind },
  });

  const to = Deno.env.get('PRIVACY_NOTIFY_EMAIL') ?? Deno.env.get('SUPPORT_NOTIFY_EMAIL');
  if (to) await sendMail(to, `[Portal][DSGVO] ${kind}-Anfrage`,
    `<p>Kunde: ${customerId}</p><p>Auth-User: ${user.email}</p><p>Art: <strong>${kind}</strong></p>${note ? `<blockquote>${note.replace(/</g,'&lt;')}</blockquote>` : ''}`);

  return json({ ok: true, id: row.id });
});

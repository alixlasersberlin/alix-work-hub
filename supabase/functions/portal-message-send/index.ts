// Post a message into an existing thread or start a new one. Notifies internal.
import { authPortalUser, audit, json, corsHeaders, sendMail } from '../_shared/portal-auth.ts';

const DEPARTMENTS = ['service','accounting','sales','contracts','training','privacy'] as const;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const ctx = await authPortalUser(req);
  if ('error' in ctx) return ctx.error;
  const { admin, user, customerId, ip, ua } = ctx;

  const body = await req.json().catch(() => ({}));
  let threadId: string | null = body.thread_id ? String(body.thread_id) : null;
  const department = String(body.department ?? '');
  const subject = String(body.subject ?? '').slice(0, 200);
  const message = String(body.message ?? '').trim().slice(0, 5000);
  if (!message) return json({ error: 'invalid_input' }, 400);

  if (!threadId) {
    if (!DEPARTMENTS.includes(department as any) || !subject) return json({ error: 'invalid_input' }, 400);
    const { data: t, error } = await admin.from('customer_portal_message_threads').insert({
      customer_id: customerId, department, subject, created_by: user.id,
    }).select('id').single();
    if (error) return json({ error: error.message }, 400);
    threadId = t.id;
  } else {
    const { data: t } = await admin.from('customer_portal_message_threads')
      .select('id, customer_id').eq('id', threadId).maybeSingle();
    if (!t || t.customer_id !== customerId) return json({ error: 'not_found' }, 404);
  }

  const { error: mErr } = await admin.from('customer_portal_messages').insert({
    thread_id: threadId, customer_id: customerId,
    from_role: 'customer', author_user_id: user.id, body: message,
  });
  if (mErr) return json({ error: mErr.message }, 400);

  await admin.from('customer_portal_message_threads')
    .update({ last_message_at: new Date().toISOString(), status: 'open', archived_by_customer: false })
    .eq('id', threadId);

  await audit(admin, {
    customer_id: customerId, auth_user_id: user.id,
    action: 'message_sent', object_type: 'thread', object_id: threadId,
    ip_address: ip, user_agent: ua, metadata: { department },
  });

  const to = Deno.env.get('SUPPORT_NOTIFY_EMAIL');
  if (to) await sendMail(to, `[Portal] Neue Nachricht (${department || 'Thread'})`,
    `<p>Neue Nachricht im Kundenportal.</p><p>Kunde: ${customerId}</p><p>Thread: ${threadId}</p><blockquote>${message.replace(/</g,'&lt;')}</blockquote>`);

  return json({ ok: true, thread_id: threadId });
});

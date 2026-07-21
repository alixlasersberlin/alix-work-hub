// Admin-triggered manual signature reminder for a specific contract.
// Requires Admin or Super Admin role. Bypasses cadence but still respects a
// 1-hour cool-down and the reminder_max ceiling.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders, json, envClients, sendMail } from '../_shared/portal-auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'unauthorized' }, 401);

  const { url, anon, service } = envClients();
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: u } = await userClient.auth.getUser();
  if (!u?.user) return json({ error: 'unauthorized' }, 401);

  const admin = createClient(url, service);
  const { data: isAdmin } = await admin.rpc('has_role', { _user_id: u.user.id, _role: 'Admin' });
  const { data: isSuper } = await admin.rpc('has_role', { _user_id: u.user.id, _role: 'Super Admin' });
  if (!isAdmin && !isSuper) return json({ error: 'forbidden' }, 403);

  const body = await req.json().catch(() => ({}));
  const contractId = String(body.contract_id ?? '');
  if (!contractId) return json({ error: 'invalid_input' }, 400);

  const { data: c } = await admin
    .from('finance_contracts')
    .select('id, customer_id, contract_number, contract_type, signature_status, signature_last_reminder_at, signature_reminder_count, signature_reminder_max, signature_requested_at')
    .eq('id', contractId).maybeSingle();
  if (!c) return json({ error: 'not_found' }, 404);
  if (c.signature_status === 'signed') return json({ error: 'already_signed' }, 409);

  const count = c.signature_reminder_count ?? 0;
  const max = c.signature_reminder_max ?? 3;
  if (count >= max) return json({ error: 'max_reminders_reached' }, 429);

  if (c.signature_last_reminder_at) {
    const lastMs = new Date(c.signature_last_reminder_at as string).getTime();
    if (Date.now() - lastMs < 3600 * 1000) return json({ error: 'cooldown', retry_after_seconds: 3600 - Math.floor((Date.now() - lastMs) / 1000) }, 429);
  }

  const { data: portalUser } = await admin
    .from('customer_portal_users')
    .select('user_id')
    .eq('customer_id', c.customer_id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  if (!portalUser?.user_id) return json({ error: 'no_portal_user' }, 404);

  const { data: pu } = await admin.auth.admin.getUserById(portalUser.user_id);
  const email = pu?.user?.email;
  if (!email) return json({ error: 'no_email' }, 404);

  const label = c.contract_number ?? c.id;
  const nextCount = count + 1;
  const isLast = nextCount >= max;

  await sendMail(email,
    `Erinnerung: Bitte signieren Sie Ihren Vertrag ${label}`,
    `<p>Guten Tag,</p>
     <p>für Ihren Vertrag <strong>${label}</strong> (${c.contract_type ?? 'Vertrag'}) liegt noch keine digitale Signatur vor.</p>
     <p>Bitte melden Sie sich in Ihrem Kundenportal an und schließen Sie die Signatur ab:</p>
     <p><a href="https://app.alixwork.de/portal/vertraege" style="background:#111;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Zum Kundenportal</a></p>
     <p style="color:#666;font-size:12px">Erinnerung ${nextCount} von ${max}${isLast ? ' — dies ist die letzte automatische Erinnerung.' : ''}</p>`
  );

  const nowIso = new Date().toISOString();
  await admin.from('finance_contracts').update({
    signature_last_reminder_at: nowIso,
    signature_reminder_count: nextCount,
    signature_requested_at: c.signature_requested_at ?? nowIso,
    signature_status: c.signature_status === 'pending' || c.signature_status === 'requested' ? c.signature_status : 'requested',
  }).eq('id', c.id);

  await admin.from('customer_portal_audit_logs').insert({
    customer_id: c.customer_id,
    action: 'contract_signature_reminder_sent_manual',
    object_type: 'contract',
    object_id: c.id,
    success: true,
    metadata: { reminder_number: nextCount, triggered_by: u.user.id },
  }).then(() => {}, () => {});

  return json({ ok: true, reminder_number: nextCount, max });
});

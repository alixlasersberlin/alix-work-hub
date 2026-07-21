// Hourly cron: sends reminder emails for contracts with pending signature.
// Cadence (days since signature_requested_at): 3, 7, 14 — max 3 reminders.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders, json, envClients, sendMail } from '../_shared/portal-auth.ts';

const CADENCE_DAYS = [3, 7, 14];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const { url, service } = envClients();
  const admin = createClient(url, service);

  const now = Date.now();
  const { data: contracts, error } = await admin
    .from('finance_contracts')
    .select('id, customer_id, contract_number, contract_type, signature_status, signature_requested_at, signature_last_reminder_at, signature_reminder_count, signature_reminder_max')
    .eq('customer_visible', true)
    .in('signature_status', ['requested', 'pending'])
    .not('signature_requested_at', 'is', null)
    .limit(500);

  if (error) return json({ error: error.message }, 500);

  let sent = 0;
  let skipped = 0;

  for (const c of contracts ?? []) {
    const max = c.signature_reminder_max ?? 3;
    const count = c.signature_reminder_count ?? 0;
    if (count >= max) { skipped++; continue; }

    const requestedAt = new Date(c.signature_requested_at as string).getTime();
    const daysSinceRequest = Math.floor((now - requestedAt) / 86_400_000);
    const targetDay = CADENCE_DAYS[count];
    if (daysSinceRequest < targetDay) { skipped++; continue; }

    // Rate limit: no more than one reminder per 24h
    if (c.signature_last_reminder_at) {
      const lastMs = new Date(c.signature_last_reminder_at as string).getTime();
      if (now - lastMs < 20 * 3600 * 1000) { skipped++; continue; }
    }

    // Fetch customer portal user email
    const { data: portalUser } = await admin
      .from('customer_portal_users')
      .select('user_id')
      .eq('customer_id', c.customer_id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();
    if (!portalUser?.user_id) { skipped++; continue; }

    const { data: u } = await admin.auth.admin.getUserById(portalUser.user_id);
    const email = u?.user?.email;
    if (!email) { skipped++; continue; }

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

    await admin.from('finance_contracts').update({
      signature_last_reminder_at: new Date().toISOString(),
      signature_reminder_count: nextCount,
    }).eq('id', c.id);

    await admin.from('customer_portal_audit_logs').insert({
      customer_id: c.customer_id,
      action: 'contract_signature_reminder_sent',
      object_type: 'contract',
      object_id: c.id,
      success: true,
      metadata: { reminder_number: nextCount, days_since_request: daysSinceRequest },
    }).then(() => {}, () => {});

    sent++;
  }

  return json({ ok: true, sent, skipped, total: contracts?.length ?? 0 });
});

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

// Versendet SEPA-Vorabinformationen eines freigegebenen Monatslaufs.
// Idempotent: bereits übergebene Vorabinfos werden übersprungen, außer sie
// werden ausdrücklich über resend_ids erneut angefordert (wird protokolliert).
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const eur = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);
const de = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('de-DE');
const fill = (t: string, v: Record<string, string>) => t.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => v[k] ?? '');
const UUID = /^[0-9a-f-]{36}$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization') || '';
    const url = Deno.env.get('SUPABASE_URL')!;
    const sb = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const { data: can } = await sb.rpc('rp_can_manage');
    if (!can) return json({ error: 'Keine Berechtigung' }, 200);

    const body = await req.json().catch(() => ({}));
    const runId = String(body.run_id || '');
    const resend: string[] = Array.isArray(body.resend_ids) ? body.resend_ids.filter((x: string) => UUID.test(x)) : [];
    const only: string[] = Array.isArray(body.prenotification_ids) ? body.prenotification_ids.filter((x: string) => UUID.test(x)) : [];
    if (!UUID.test(runId)) return json({ error: 'run_id fehlt' }, 200);

    const { data: run } = await sb.from('rp_billing_runs').select('id,status').eq('id', runId).maybeSingle();
    if (!run || !['rechnungen_erzeugt', 'prenotification_versendet'].includes(run.status)) return json({ error: 'Lauf ist nicht im Status „Rechnungen erzeugt"' }, 200);

    const { data: settings } = await sb.from('rp_settings').select('*').eq('id', 1).single();
    const { data: items } = await sb.from('rp_billing_run_items').select('id, plan_id, customer_id, installment_number, installment_count, due_date').eq('run_id', runId);
    const itemIds = (items || []).map((i) => i.id);
    let q = sb.from('rp_prenotifications').select('*').in('item_id', itemIds.length ? itemIds : ['00000000-0000-0000-0000-000000000000']);
    if (only.length || resend.length) q = q.in('id', [...only, ...resend]);
    const { data: pns } = await q;
    const { data: sent } = await sb.from('rp_notification_deliveries').select('prenotification_id, channel').eq('status', 'uebergeben');
    const sentSet = new Set((sent || []).map((s) => s.prenotification_id + ':' + s.channel));

    let ok = 0, fail = 0, skipped = 0;
    const errors: string[] = [];
    for (const pn of pns || []) {
      const item = items!.find((i) => i.id === pn.item_id)!;
      const [{ data: plan }, { data: cust }, { data: inv }] = await Promise.all([
        sb.from('rp_payment_plans').select('notify_channel,email,phone,sms_enabled').eq('id', item.plan_id).single(),
        sb.from('customers').select('company_name,contact_name,email,phone').eq('id', pn.customer_id).single(),
        sb.from('zoho_invoices').select('legal_invoice_number,invoice_number').eq('id', pn.invoice_id).single(),
      ]);
      const vars = {
        customer_name: cust?.contact_name || cust?.company_name || '',
        amount: eur(Number(pn.amount)), collection_date: de(pn.collection_date),
        invoice_number: inv?.legal_invoice_number || inv?.invoice_number || '',
        mandate_reference: pn.mandate_reference || '', creditor_id: pn.creditor_id || '', creditor_name: pn.creditor_name,
        due_date: de(item.due_date || pn.collection_date), installment_number: String(item.installment_number ?? ''), installment_count: String(item.installment_count ?? ''),
      };
      const isResend = resend.includes(pn.id);
      const isInfo = pn.kind === 'zahlungsinfo';
      const chSet = new Set<string>(plan?.notify_channel === 'sms' ? ['sms'] : plan?.notify_channel === 'email_sms' ? ['email', 'sms'] : ['email']);
      if (plan?.sms_enabled) chSet.add('sms');
      const channels = [...chSet];
      const subjT = isInfo ? settings.info_email_subject : settings.email_subject;
      const bodyT = isInfo ? settings.info_email_body : settings.email_body;
      const smsT = isInfo ? settings.info_sms_body : settings.sms_body;
      for (const ch of channels) {
        if (sentSet.has(pn.id + ':' + ch) && !isResend) { skipped++; continue; }
        const to = ch === 'email' ? (plan?.email || cust?.email) : (plan?.phone || cust?.phone);
        if (!to) { await sb.rpc('rp_log_delivery', { p_prenotification_id: pn.id, p_channel: ch, p_recipient: null, p_status: 'fehlgeschlagen', p_is_resend: isResend, p_provider_ref: null, p_error: 'Keine Adresse' }); fail++; continue; }
        let status = 'uebergeben', err: string | null = null, ref: string | null = null;
        try {
          const fn = ch === 'email' ? 'send-transactional-email' : 'op-light-send-sms';
          const payload = ch === 'email'
            ? { templateName: 'customer-shipping-notice', recipientEmail: to, idempotencyKey: `rp-pn-${pn.id}${isResend ? '-r' + Date.now() : ''}`, templateData: { subject: fill(subjT, vars), body: fill(bodyT, vars) } }
            : { to, message: fill(smsT, vars) };
          const r = await fetch(`${url}/functions/v1/${fn}`, { method: 'POST', headers: { Authorization: auth, apikey: Deno.env.get('SUPABASE_ANON_KEY')!, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          const t = await r.text(); let d: any = {}; try { d = JSON.parse(t); } catch { /* */ }
          if (!r.ok || d?.error || d?.success === false) { status = 'fehlgeschlagen'; err = String(d?.error || d?.reason || t).slice(0, 400); }
          ref = d?.id || d?.sid || null;
        } catch (e) { status = 'fehlgeschlagen'; err = String(e); }
        await sb.rpc('rp_log_delivery', { p_prenotification_id: pn.id, p_channel: ch, p_recipient: to, p_status: status, p_is_resend: isResend, p_provider_ref: ref, p_error: err });
        if (status === 'uebergeben') ok++; else { fail++; errors.push(`${vars.customer_name} (${ch}): ${err}`); }
      }
    }
    return json({ ok: true, handed_over: ok, failed: fail, skipped, errors: errors.slice(0, 20) });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 200);
  }
});

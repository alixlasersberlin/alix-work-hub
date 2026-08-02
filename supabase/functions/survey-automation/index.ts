// Automatisierung: erzeugt Umfrage-Empfänger aus Geschäftsereignissen (Auftrag geliefert, Ticket geschlossen …)
// und stößt den Einladungsversand an. Läuft per Cron oder manuell aus der Oberfläche.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

type Candidate = {
  source_ref: string;
  email: string;
  first_name?: string | null;
  company_name?: string | null;
  customer_id?: string | null;
  order_number?: string | null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const onlyRuleId = typeof body.rule_id === 'string' ? body.rule_id : null;
    const dryRun = body.dry_run === true;

    let q = admin.from('survey_automation_rules').select('*').eq('active', true);
    if (onlyRuleId) q = admin.from('survey_automation_rules').select('*').eq('id', onlyRuleId);
    const { data: rules } = await q;

    const now = Date.now();
    let created = 0, skipped = 0;
    const details: Record<string, number> = {};

    for (const rule of rules ?? []) {
      if (!rule.survey_id) { skipped++; continue; }
      const { data: survey } = await admin.from('surveys')
        .select('id, status, ends_at').eq('id', rule.survey_id).maybeSingle();
      if (!survey || survey.status !== 'aktiv') { skipped++; continue; }

      const cutoff = new Date(now - Math.max(0, rule.delay_days ?? 0) * 864e5).toISOString();
      const candidates: Candidate[] = [];

      if (rule.trigger_event === 'order_delivered' || rule.trigger_event === 'order_created') {
        let oq = admin.from('orders')
          .select('id, order_number, customer_id, order_status, updated_at, created_at, source_system')
          .lte(rule.trigger_event === 'order_created' ? 'created_at' : 'updated_at', cutoff)
          .order('updated_at', { ascending: false })
          .limit(200);
        if (rule.trigger_event === 'order_delivered') oq = oq.in('order_status', ['geliefert', 'invoiced', 'delivered', 'closed']);
        const src = (rule.filters as Record<string, unknown> | null)?.source_system;
        if (typeof src === 'string' && src) oq = oq.eq('source_system', src);
        const { data: orders } = await oq;

        for (const o of orders ?? []) {
          const { data: c } = await admin.from('customers')
            .select('id, email, contact_name, company_name').eq('id', o.customer_id).maybeSingle();
          if (!c?.email) continue;
          candidates.push({
            source_ref: `order:${o.id}`, email: c.email, first_name: c.contact_name,
            company_name: c.company_name, customer_id: c.id, order_number: o.order_number,
          });
        }
      } else if (rule.trigger_event === 'ticket_closed') {
        const { data: tickets } = await admin.from('tickets')
          .select('id, customer_email, customer_name, company_name, order_number, resolved_at, status')
          .in('status', ['geschlossen', 'closed', 'resolved'])
          .not('resolved_at', 'is', null).lte('resolved_at', cutoff)
          .order('resolved_at', { ascending: false }).limit(200);
        for (const t of tickets ?? []) {
          if (!t.customer_email) continue;
          candidates.push({
            source_ref: `ticket:${t.id}`, email: t.customer_email, first_name: t.customer_name,
            company_name: t.company_name, order_number: t.order_number,
          });
        }
      } else if (rule.trigger_event === 'service_done') {
        const { data: tickets } = await admin.from('tickets')
          .select('id, customer_email, customer_name, company_name, order_number, appointment_at')
          .not('appointment_at', 'is', null).lte('appointment_at', cutoff)
          .order('appointment_at', { ascending: false }).limit(200);
        for (const t of tickets ?? []) {
          if (!t.customer_email) continue;
          candidates.push({
            source_ref: `service:${t.id}`, email: t.customer_email, first_name: t.customer_name,
            company_name: t.company_name, order_number: t.order_number,
          });
        }
      }

      let ruleCreated = 0;
      for (const cand of candidates) {
        // bereits verarbeitet?
        const { data: existing } = await admin.from('survey_automation_runs')
          .select('id').eq('rule_id', rule.id).eq('source_ref', cand.source_ref).limit(1).maybeSingle();
        if (existing) { skipped++; continue; }

        // Mindestabstand pro E-Mail
        const gapFrom = new Date(now - Math.max(0, rule.min_gap_days ?? 0) * 864e5).toISOString();
        const { data: recent } = await admin.from('survey_automation_runs')
          .select('id').eq('email', cand.email).eq('status', 'ok').gte('created_at', gapFrom).limit(1).maybeSingle();
        if (recent) {
          if (!dryRun) {
            await admin.from('survey_automation_runs').insert({
              rule_id: rule.id, survey_id: rule.survey_id, source_ref: cand.source_ref,
              customer_id: cand.customer_id ?? null, email: cand.email,
              status: 'skipped', error_text: 'Mindestabstand nicht erreicht',
            });
          }
          skipped++;
          continue;
        }

        if (dryRun) { ruleCreated++; continue; }

        // Empfänger anlegen (falls noch nicht vorhanden)
        const { data: rec } = await admin.from('survey_recipients')
          .select('id').eq('survey_id', rule.survey_id).eq('email', cand.email).limit(1).maybeSingle();

        let recipientId = rec?.id ?? null;
        let errText: string | null = null;
        if (!recipientId) {
          const { data: ins, error } = await admin.from('survey_recipients').insert({
            survey_id: rule.survey_id,
            email: cand.email,
            first_name: cand.first_name ?? null,
            company_name: cand.company_name ?? null,
            customer_id: cand.customer_id ?? null,
            order_number: cand.order_number ?? null,
            status: 'neu',
          }).select('id').single();
          if (error) errText = error.message; else recipientId = ins.id;
        }

        await admin.from('survey_automation_runs').insert({
          rule_id: rule.id, survey_id: rule.survey_id, source_ref: cand.source_ref,
          customer_id: cand.customer_id ?? null, email: cand.email,
          status: errText ? 'failed' : 'ok', error_text: errText,
        });
        if (!errText) { created++; ruleCreated++; }
      }

      details[rule.name] = ruleCreated;
      if (!dryRun) {
        await admin.from('survey_automation_rules').update({ last_run_at: new Date().toISOString() }).eq('id', rule.id);

        if (ruleCreated > 0) {
          // Einladungen für die neuen Empfänger anstoßen
          await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/survey-send-invites`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ survey_id: rule.survey_id, kind: 'einladung' }),
          }).catch(() => null);
        }
      }
    }

    return json({ ok: true, created, skipped, dry_run: dryRun, details });
  } catch (e) {
    return json({ error: (e as Error)?.message ?? 'error' }, 500);
  }
});

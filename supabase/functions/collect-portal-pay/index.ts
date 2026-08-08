// ALIX COLLECT – Öffentliches Kundenportal für Zahl-Links (kein Login)
// GET-artig via {token} -> offene Posten; Aktionen: ratenantrag, zahlung_angekuendigt
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body?.token ?? '').trim();
    const action = String(body?.action ?? 'view');
    if (!token || token.length < 20) return json({ error: 'Ungültiger Link' }, 400);

    const { data: link } = await admin
      .from('collect_payment_links')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (!link) return json({ error: 'Link nicht gefunden' }, 404);
    if (link.expires_at && new Date(link.expires_at) < new Date()) return json({ error: 'Dieser Link ist abgelaufen' }, 410);
    if (link.status === 'cancelled') return json({ error: 'Dieser Link wurde deaktiviert' }, 410);

    const { data: items } = await admin
      .from('collect_case_items')
      .select('invoice_number, invoice_date, due_date, balance, currency, days_overdue')
      .eq('case_id', link.case_id)
      .gt('balance', 0)
      .order('due_date');

    // Zur Unterschrift offener / bereits signierter Ratenplan
    const { data: plans } = await admin
      .from('collect_payment_plans')
      .select('id, total_amount, downpayment, monthly_amount, term_months, start_date, currency, sepa_iban_masked, sepa_mandate_ref, status, signed_at, signed_name')
      .eq('case_id', link.case_id)
      .order('created_at', { ascending: false })
      .limit(1);
    const plan: any = (plans ?? [])[0] ?? null;
    let planItems: any[] = [];
    if (plan) {
      const { data: pi } = await admin
        .from('collect_payment_plan_items')
        .select('seq, due_date, amount, status')
        .eq('plan_id', plan.id)
        .order('seq');
      planItems = pi ?? [];
    }

    if (action === 'view') {
      if (!link.opened_at) {
        await admin.from('collect_payment_links').update({ opened_at: new Date().toISOString() }).eq('id', link.id);
        await admin.from('collect_events').insert({
          case_id: link.case_id,
          event_type: 'payment_link_opened',
          channel: 'portal',
          direction: 'inbound',
          subject: 'Kunde hat den Zahlungslink geöffnet',
          automated: true,
        });
      }
      return json({
        success: true,
        customer_name: link.customer_name,
        amount: link.amount,
        currency: link.currency ?? 'EUR',
        allow_installments: link.allow_installments,
        expires_at: link.expires_at,
        status: link.status,
        items: items ?? [],
        plan: plan ? { ...plan, items: planItems } : null,
      });
    }

    if (action === 'plan_sign') {
      if (!plan) return json({ error: 'Keine Ratenvereinbarung vorhanden' }, 404);
      if (plan.signed_at) return json({ error: 'Diese Ratenvereinbarung wurde bereits unterschrieben' }, 409);

      const signature = String(body?.signature ?? '');
      const signedName = String(body?.signed_name ?? '').trim().slice(0, 120);
      if (!signature.startsWith('data:image/png;base64,') || signature.length > 400_000) {
        return json({ error: 'Bitte unterschreiben Sie im Unterschriftenfeld' }, 400);
      }
      if (signedName.length < 3) return json({ error: 'Bitte geben Sie Ihren vollständigen Namen an' }, 400);

      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
      const now = new Date().toISOString();

      await admin.from('collect_payment_plans').update({
        signature_data_url: signature,
        signed_name: signedName,
        signed_ip: ip,
        signed_at: now,
        status: 'active',
      }).eq('id', plan.id);

      await admin.from('collect_events').insert({
        case_id: link.case_id,
        event_type: 'payment_plan_signed',
        channel: 'portal',
        direction: 'inbound',
        subject: `Ratenvereinbarung digital unterschrieben von ${signedName}`,
        body: `IP ${ip ?? 'unbekannt'} · ${plan.term_months ?? 0} Raten à ${plan.monthly_amount ?? 0}`,
        automated: true,
      });

      await admin.from('collect_payment_links').update({
        status: 'plan_signed',
        customer_response: `Ratenvereinbarung unterschrieben von ${signedName}`,
        responded_at: now,
      }).eq('id', link.id);

      return json({ success: true, message: 'Vielen Dank – Ihre Ratenvereinbarung ist unterschrieben.' });
    }


    if (action === 'promise') {
      const date = String(body?.date ?? '').slice(0, 10);
      const amount = Number(body?.amount ?? link.amount ?? 0);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: 'Bitte ein gültiges Datum angeben' }, 400);
      if (!(amount > 0)) return json({ error: 'Bitte einen gültigen Betrag angeben' }, 400);

      await admin.from('collect_promises').insert({
        case_id: link.case_id,
        promised_date: date,
        amount,
        currency: link.currency ?? 'EUR',
        status: 'open',
        note: 'Zahlungszusage über Kundenportal',
      });
      await admin.from('collect_events').insert({
        case_id: link.case_id,
        event_type: 'promise_created',
        channel: 'portal',
        direction: 'inbound',
        subject: `Kunde sagt Zahlung zu: ${amount} zum ${date}`,
        automated: true,
      });
      await admin.from('collect_payment_links').update({ status: 'promised', customer_response: `Zusage ${amount} zum ${date}`, responded_at: new Date().toISOString() }).eq('id', link.id);
      return json({ success: true, message: 'Vielen Dank – Ihre Zahlungszusage wurde erfasst.' });
    }

    if (action === 'installment_request') {
      if (!link.allow_installments) return json({ error: 'Ratenzahlung ist für diesen Vorgang nicht freigegeben' }, 403);
      const months = Math.min(Math.max(Number(body?.months ?? 3), 2), 24);
      const note = String(body?.note ?? '').slice(0, 500);
      const total = Number(link.amount ?? 0);

      await admin.from('collect_tasks').insert({
        case_id: link.case_id,
        task_type: 'installment_request',
        title: `Ratenzahlungsantrag: ${months} Raten (${total})`,
        description: `Kundenantrag über Portal.${note ? ` Anmerkung: ${note}` : ''}`,
        priority: 'high',
        status: 'open',
        source: 'portal',
        due_date: new Date().toISOString().slice(0, 10),
      });
      await admin.from('collect_events').insert({
        case_id: link.case_id,
        event_type: 'installment_requested',
        channel: 'portal',
        direction: 'inbound',
        subject: `Kunde beantragt Ratenzahlung über ${months} Monate`,
        body: note || null,
        automated: true,
      });
      await admin.from('collect_payment_links').update({ status: 'installment_requested', customer_response: `Ratenantrag ${months} Monate${note ? ': ' + note : ''}`, responded_at: new Date().toISOString() }).eq('id', link.id);
      return json({ success: true, message: 'Ihr Ratenzahlungsantrag ist eingegangen. Wir melden uns kurzfristig.' });
    }

    return json({ error: 'Unbekannte Aktion' }, 400);
  } catch (e: any) {
    console.error('collect-portal-pay error', e);
    return json({ error: e?.message ?? 'Unbekannter Fehler' }, 500);
  }
});

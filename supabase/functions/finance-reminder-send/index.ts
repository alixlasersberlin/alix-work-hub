// Phase 3 Mahnwesen: sendet eine einzelne Mahnung als E-Mail. Aktualisiert
// finance_reminders.status -> "Versendet" und finance_accounts.reminder_level / last_reminder_at.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  try {
    const { reminder_id } = await req.json();
    if (!reminder_id) {
      return new Response(JSON.stringify({ error: 'reminder_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: rem, error: remErr } = await admin.from('finance_reminders').select('*').eq('id', reminder_id).maybeSingle();
    if (remErr || !rem) throw new Error(remErr?.message ?? 'Mahnung nicht gefunden');
    if (rem.status === 'Versendet') {
      return new Response(JSON.stringify({ ok: true, already_sent: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: items } = await admin.from('finance_reminder_items').select('invoice_number, amount, due_date, days_overdue').eq('reminder_id', reminder_id);
    const { data: cust } = await admin.from('customers').select('id, company_name, contact_name, email, iban, bic, bank_name').eq('id', rem.customer_id).maybeSingle();
    if (!cust?.email) throw new Error('Kunde hat keine E-Mail-Adresse');

    const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('de-DE') : '';

    const templateData = {
      customerName: cust.company_name || cust.contact_name || '',
      level: rem.level,
      amount: Number(rem.amount),
      fee: Number(rem.fee),
      interest: Number(rem.interest),
      total: Number(rem.total),
      dueDate: fmtDate(rem.due_date),
      items: (items ?? []).map((i) => ({ ...i, due_date: fmtDate(i.due_date) })),
      iban: cust.iban,
      bic: cust.bic,
      bankName: cust.bank_name,
    };

    // Forward to send-transactional-email using the caller JWT
    const sendRes = await fetch(`${SUPABASE_URL}/functions/v1/send-transactional-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
        apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      },
      body: JSON.stringify({
        templateName: 'finance-reminder',
        recipientEmail: cust.email,
        idempotencyKey: `finance-reminder-${reminder_id}`,
        templateData,
      }),
    });
    const sendBody = await sendRes.json().catch(() => ({}));
    if (!sendRes.ok) throw new Error(`E-Mail-Versand fehlgeschlagen: ${sendRes.status} ${JSON.stringify(sendBody)}`);

    // Update reminder + account
    await admin.from('finance_reminders').update({
      status: 'Versendet',
      sent_at: new Date().toISOString(),
      email_message_id: sendBody?.message_id ?? null,
    }).eq('id', reminder_id);

    await admin.from('finance_accounts').update({
      reminder_level: rem.level,
      last_reminder_at: new Date().toISOString(),
    }).eq('customer_id', rem.customer_id);

    return new Response(JSON.stringify({ ok: true, recipient: cust.email }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error).message ?? e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

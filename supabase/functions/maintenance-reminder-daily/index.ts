// Phase 8: Tägliche Wartungs-Erinnerungen
// - berechnet 30d/14d/0d/overdue je Datensatz in device_maintenance
// - sendet via ticket-customer-notify (Resend) und loggt in maintenance_reminder_log
// - keine doppelten Erinnerungen am gleichen Tag (Unique-Index)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function fmt(d: Date) { return d.toISOString().slice(0, 10); }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const today = new Date();
  const in30 = new Date(today); in30.setDate(in30.getDate() + 30);
  const in14 = new Date(today); in14.setDate(in14.getDate() + 14);

  // Statuswerte aktualisieren
  await supa.rpc('refresh_warranty_and_maintenance_status').catch(() => {});

  const { data: rows, error } = await supa
    .from('device_maintenance')
    .select('id, serial_number, device_name, customer_id, customer_name, customer_email, next_maintenance_date, maintenance_status, reminder_30d_sent_at, reminder_14d_sent_at, reminder_due_sent_at, reminder_overdue_sent_at')
    .not('next_maintenance_date', 'is', null)
    .neq('maintenance_status', 'Abgeschlossen')
    .limit(2000);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const result = { processed: 0, sent: 0, skipped: 0, failed: 0 } as any;

  for (const r of rows ?? []) {
    result.processed++;
    if (!r.customer_email) { result.skipped++; continue; }
    const due = r.next_maintenance_date as string;
    let type: '30d' | '14d' | 'due' | 'overdue' | null = null;
    if (due === fmt(today)) type = 'due';
    else if (due === fmt(in14)) type = '14d';
    else if (due === fmt(in30)) type = '30d';
    else if (due < fmt(today)) type = 'overdue';
    if (!type) { result.skipped++; continue; }

    const flagCol = type === '30d' ? 'reminder_30d_sent_at' : type === '14d' ? 'reminder_14d_sent_at' : type === 'due' ? 'reminder_due_sent_at' : 'reminder_overdue_sent_at';
    // overdue: nur einmal pro Tag
    const existing = (r as any)[flagCol] as string | null;
    if (type !== 'overdue' && existing) { result.skipped++; continue; }
    if (type === 'overdue' && existing && existing.slice(0, 10) === fmt(today)) { result.skipped++; continue; }

    const message = type === 'overdue'
      ? `Die Wartung Ihres Gerätes ist überfällig (geplant für ${due}). Bitte vereinbaren Sie zeitnah einen Termin.`
      : type === 'due'
      ? `Heute ist die geplante Wartung Ihres Gerätes (${due}). Bitte kontaktieren Sie uns zur Terminbestätigung.`
      : `Die nächste Wartung Ihres Gerätes ist für ${due} geplant (${type === '30d' ? 'in ca. 30 Tagen' : 'in ca. 14 Tagen'}).`;

    let sendStatus = 'sent';
    let sendError: string | null = null;
    try {
      const resp = await supa.functions.invoke('ticket-customer-notify', {
        body: {
          event: 'maintenance_reminder',
          recipient_email: r.customer_email,
          customer_name: r.customer_name,
          message: `${message}\n\nGerät: ${r.device_name ?? ''}\nSeriennummer: ${r.serial_number ?? ''}`,
        },
      });
      if (resp.error) { sendStatus = 'failed'; sendError = String(resp.error); }
    } catch (e: any) {
      sendStatus = 'failed'; sendError = e.message;
    }

    const { error: logErr } = await supa.from('maintenance_reminder_log').insert({
      device_maintenance_id: r.id,
      serial_number: r.serial_number,
      device_name: r.device_name,
      customer_id: r.customer_id,
      customer_name: r.customer_name,
      recipient_email: r.customer_email,
      reminder_type: type,
      due_date: due,
      status: sendStatus,
      error: sendError,
    });
    if (logErr && logErr.code === '23505') { result.skipped++; continue; }
    if (sendStatus === 'sent') {
      result.sent++;
      await supa.from('device_maintenance').update({ [flagCol]: new Date().toISOString() }).eq('id', r.id);
    } else {
      result.failed++;
    }
  }

  return new Response(JSON.stringify({ ok: true, ...result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});

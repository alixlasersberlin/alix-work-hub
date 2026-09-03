// follow-up-reminder-engine — löst persönliche Wiedervorlagen zur Fälligkeit aus.
// Läuft per Cron. Sendet ausschliesslich INTERNE Benachrichtigungen an den
// Ersteller/Empfänger – niemals eine Nachricht an Kunden.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

const FN_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-mobile-notification`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const result = { due: 0, notified: 0, failed: 0 };
  try {
    // Feature Flag respektieren
    const { data: flag } = await admin.from('app_settings')
      .select('value').eq('key', 'follow_up_reminders_enabled').maybeSingle();
    if (flag && String(flag.value) === 'false') {
      return json({ skipped: 'feature_disabled' });
    }

    const nowIso = new Date().toISOString();
    const { data: due, error } = await admin
      .from('follow_up_reminders')
      .select('id, user_id, note, remind_at, conversation_id, ticket_id')
      .eq('status', 'SCHEDULED')
      .lte('remind_at', nowIso)
      .limit(200);
    if (error) throw error;

    result.due = (due || []).length;

    for (const r of due || []) {
      const url = r.conversation_id
        ? `/mobil/inbox/${r.conversation_id}`
        : r.ticket_id
          ? `/mobil/tickets`
          : '/mobil/wiedervorlagen';
      try {
        const res = await fetch(FN_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            notification_type: 'SYSTEM',
            target_user_ids: [r.user_id],
            title: 'Wiedervorlage fällig',
            body: r.note ?? 'Erinnerung fällig',
            url,
            priority: 'P3',
            dedup_suffix: `follow_up_${r.id}`,
          }),
        });
        if (!res.ok) {
          console.error('notify failed', res.status, await res.text());
          result.failed++;
          continue;
        }
        await admin.from('follow_up_reminders')
          .update({ notified_at: new Date().toISOString() })
          .eq('id', r.id);
        result.notified++;
      } catch (e) {
        console.error('reminder error', r.id, e);
        result.failed++;
      }
    }

    return json(result);
  } catch (e) {
    console.error('follow-up-reminder-engine', e);
    return json({ error: String(e), ...result }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

// SLA-Grenzwerte pro Priorität (Minuten bis zur Erst-Antwort)
const SLA_MINUTES: Record<string, number> = {
  urgent: 15,
  high: 30,
  normal: 60,
  low: 240,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const nowIso = new Date().toISOString();

    // Alle offenen Konversationen mit letzter Nachricht
    const { data: convs, error } = await admin
      .from('ac_conversations')
      .select('id, tenant_id, priority, status, last_message_at, sla_notified_at, channel_type')
      .in('status', ['open', 'pending'])
      .limit(500);
    if (error) throw error;

    let breached = 0;
    const errors: string[] = [];

    for (const c of convs ?? []) {
      const prio = (c as any).priority || 'normal';
      const limitMin = SLA_MINUTES[prio] ?? 60;
      const last = new Date((c as any).last_message_at || 0).getTime();
      const ageMin = (Date.now() - last) / 60000;
      if (ageMin < limitMin) continue;

      // Bereits benachrichtigt in diesem SLA-Fenster?
      const notifiedAt = (c as any).sla_notified_at ? new Date((c as any).sla_notified_at).getTime() : 0;
      if (notifiedAt > last) continue;

      // Prüfen ob letzte Nachricht wirklich inbound war (sonst hat Agent geantwortet)
      const { data: lastMsg } = await admin
        .from('ac_messages')
        .select('direction, is_internal_note')
        .eq('conversation_id', (c as any).id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!lastMsg) continue;
      if ((lastMsg as any).direction !== 'inbound') continue;

      // Fire event
      try {
        await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/ac-automation-run`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            apikey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
          },
          body: JSON.stringify({
            event: 'sla.breached',
            conversation_id: (c as any).id,
            tenant_id: (c as any).tenant_id,
          }),
        });
        breached++;
        await admin
          .from('ac_conversations')
          .update({ sla_notified_at: nowIso })
          .eq('id', (c as any).id);
      } catch (e) {
        errors.push(`${(c as any).id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return new Response(JSON.stringify({ ok: true, checked: convs?.length ?? 0, breached, errors }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

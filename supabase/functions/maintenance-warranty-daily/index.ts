// Phase 10 daily refresh: warranty + maintenance statuses and reminder events
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supa = createClient(url, key);

  const result: Record<string, unknown> = {};
  try {
    // 1) recompute statuses in DB
    const { error: rpcErr } = await supa.rpc('refresh_warranty_and_maintenance_status');
    if (rpcErr) throw rpcErr;

    // 2) Garantie-Mahnungen: log lifecycle events at 12/6/3/1 months before end (once per threshold)
    const thresholds = [12, 6, 3, 1];
    const today = new Date();
    for (const m of thresholds) {
      const target = new Date(today);
      target.setMonth(target.getMonth() + m);
      const day = target.toISOString().slice(0, 10);
      const { data: due } = await supa
        .from('warranty_records')
        .select('serial_number, device_name, customer_id, customer_name, warranty_end')
        .eq('warranty_end', day);
      for (const w of (due ?? []) as any[]) {
        await supa.from('device_lifecycle').insert({
          serial_number: w.serial_number,
          device_name: w.device_name,
          customer_id: w.customer_id,
          customer_name: w.customer_name,
          event_type: 'Garantie',
          event_source: 'warranty_reminder',
          reference_id: `${w.serial_number}-${m}m`,
          description: `Garantie läuft in ${m} Monat${m === 1 ? '' : 'en'} ab (${w.warranty_end})`,
        });
      }
      result[`reminders_${m}m`] = (due ?? []).length;
    }

    // 3) Überfällige Wartungen → Lifecycle-Hinweis (1x pro Tag pro Eintrag)
    const { data: overdue } = await supa
      .from('device_maintenance')
      .select('id, serial_number, device_name, customer_id, customer_name, next_maintenance_date, maintenance_status')
      .eq('maintenance_status', 'Überfällig');
    for (const m of (overdue ?? []) as any[]) {
      await supa.from('device_lifecycle').insert({
        serial_number: m.serial_number,
        device_name: m.device_name,
        customer_id: m.customer_id,
        customer_name: m.customer_name,
        event_type: 'Wartung',
        event_source: 'maintenance_overdue',
        reference_id: `${m.id}-${today.toISOString().slice(0, 10)}`,
        description: `Wartung überfällig seit ${m.next_maintenance_date}`,
      });
    }
    result.overdue_maintenance = (overdue ?? []).length;

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

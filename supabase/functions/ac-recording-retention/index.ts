// Cron: löscht Aufzeichnungen deren Retention-Frist abgelaufen ist
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from('ac_calls')
      .update({ recording_url: null, recording_deleted_at: nowIso })
      .lt('recording_retention_until', nowIso)
      .is('recording_deleted_at', null)
      .not('recording_url', 'is', null)
      .select('id');

    if (error) throw error;
    return new Response(JSON.stringify({ deleted: data?.length || 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('retention error', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

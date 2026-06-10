import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { pack_id, action, recipients } = await req.json();
    if (!pack_id || !action) {
      return new Response(JSON.stringify({ error: 'pack_id and action required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    if (action === 'generate') {
      const { error } = await supabase.from('finance_management_packs')
        .update({ status: 'generated', generated_at: new Date().toISOString() })
        .eq('id', pack_id);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'send') {
      const { error } = await supabase.from('finance_management_packs')
        .update({ status: 'sent', sent_at: new Date().toISOString(), sent_to: recipients ?? [] })
        .eq('id', pack_id);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, sent_to: recipients }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'unknown action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

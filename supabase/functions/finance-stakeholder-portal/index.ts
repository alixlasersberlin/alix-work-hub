import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { token } = await req.json();
    if (!token || typeof token !== 'string' || token.length < 32) {
      return new Response(JSON.stringify({ error: 'Ungültiger Zugriffslink' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: sh } = await supabase.from('finance_stakeholders').select('*').eq('access_token', token).eq('enabled', true).maybeSingle();
    if (!sh) return new Response(JSON.stringify({ error: 'Zugriff verweigert oder Link gesperrt' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (sh.expires_at && new Date(sh.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'Zugriffslink ist abgelaufen' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const ids = (sh.allowed_reports ?? []) as string[];
    let reports: any[] = [];
    if (ids.length) {
      const { data } = await supabase.from('finance_reports').select('id,name,description,visualization,metrics').in('id', ids);
      reports = data ?? [];
    }

    await supabase.from('finance_stakeholders').update({
      last_access_at: new Date().toISOString(),
      access_count: (sh.access_count ?? 0) + 1,
    }).eq('id', sh.id);

    await supabase.from('finance_stakeholder_access_logs').insert({
      stakeholder_id: sh.id,
      resource_type: 'portal',
      ip_address: req.headers.get('x-forwarded-for') ?? null,
      user_agent: req.headers.get('user-agent') ?? null,
    });

    return new Response(JSON.stringify({
      stakeholder: { name: sh.name, role: sh.role },
      reports,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

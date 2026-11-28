import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { requireCallerAccess } from '../_shared/caller-access.ts';
import { financeRegionAllowed, tenantObjectAllowed } from '../_shared/process-access.ts';
import { ManagementPackBody } from '../_shared/security-v5-input.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  try {
    const access = await requireCallerAccess(req, corsHeaders, ['Super Admin', 'Admin', 'Finance']);
    if ('response' in access) return access.response;
    const parsed = ManagementPackBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return new Response(JSON.stringify({ error: 'Invalid pack request' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const { pack_id, action, recipients } = parsed.data;
    const supabase = access.caller;
    const { data: pack, error: readError } = await supabase.from('finance_management_packs')
      .select('id,tenant_id,accounting_region').eq('id', pack_id).maybeSingle();
    if (readError || !pack) return new Response(JSON.stringify({ error: 'Pack not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!tenantObjectAllowed(access.tenants.map((t: any) => t.id), pack.tenant_id) || !financeRegionAllowed(access.roles, pack.accounting_region)) {
      return new Response(JSON.stringify({ error: 'Pack company scope denied' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'generate') {
      const { error } = await supabase.from('finance_management_packs')
        .update({ status: 'generated', generated_at: new Date().toISOString() })
        .eq('id', pack_id).eq('tenant_id', pack.tenant_id).select('id').single();
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'send') {
      const { error } = await supabase.from('finance_management_packs')
        .update({ status: 'sent', sent_at: new Date().toISOString(), sent_to: recipients ?? [] })
        .eq('id', pack_id).eq('tenant_id', pack.tenant_id).select('id').single();
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, sent_to: recipients }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'unknown action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

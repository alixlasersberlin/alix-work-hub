import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);
  const apiKey = req.headers.get('x-api-key') ?? '';
  if (!apiKey) return new Response(JSON.stringify({ error: 'missing x-api-key' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const hash = await sha256(apiKey);
  const { data: partner } = await supabase.from('sig_partners').select('*').eq('api_key_hash', hash).eq('status', 'active').maybeSingle();
  if (!partner) return new Response(JSON.stringify({ error: 'invalid_api_key' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  // Quota check
  if (partner.used_quota >= partner.monthly_quota) {
    return new Response(JSON.stringify({ error: 'quota_exceeded', quota: partner.monthly_quota }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const segments = url.pathname.split('/').filter(Boolean);
  const action = segments[segments.length - 1];

  try {
    if (req.method === 'POST' && action === 'requests') {
      const body = await req.json();
      const { title, signer_email, signer_name, document_url, document_type = 'contract' } = body;
      if (!title || !signer_email) {
        return new Response(JSON.stringify({ error: 'title, signer_email required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { data: doc } = await supabase.from('sig_documents').insert({
        title, document_type, file_url: document_url ?? null, created_by: partner.owner_user_id,
      }).select().single();
      const { data: reqRow } = await supabase.from('sig_requests').insert({
        document_id: doc?.id, status: 'sent', created_by: partner.owner_user_id,
      }).select().single();
      await supabase.from('sig_signers').insert({
        request_id: reqRow?.id, email: signer_email, name: signer_name ?? signer_email, status: 'pending',
      });
      await supabase.from('sig_partners').update({ used_quota: partner.used_quota + 1 }).eq('id', partner.id);
      // Log usage
      const month = new Date().toISOString().slice(0, 7) + '-01';
      await supabase.from('sig_partner_usage').upsert({
        partner_id: partner.id, month, signatures_count: 1, api_calls: 1,
      }, { onConflict: 'partner_id,month' });
      return new Response(JSON.stringify({ ok: true, request_id: reqRow?.id, sign_url: `${url.origin}/sign/${reqRow?.id}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (req.method === 'GET' && segments[segments.length - 2] === 'requests') {
      const reqId = segments[segments.length - 1];
      const { data } = await supabase.from('sig_requests').select('id, status, document_id, created_at').eq('id', reqId).maybeSingle();
      if (!data) return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'unknown_route' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

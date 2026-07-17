// Public: load a signature request by token (no auth)
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  if (!token) return new Response(JSON.stringify({ error: 'token required' }), {
    status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: reqRow } = await admin.from('sig_requests')
    .select('id, document_id, status, expires_at, otp_required, opened_at')
    .eq('token', token).maybeSingle();
  if (!reqRow) return new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

  if (new Date(reqRow.expires_at).getTime() < Date.now()) {
    await admin.from('sig_requests').update({ status: 'abgelaufen' }).eq('id', reqRow.id);
    return new Response(JSON.stringify({ error: 'expired' }), {
      status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: doc } = await admin.from('sig_documents')
    .select('id, title, document_type, storage_path, fields, version, status').eq('id', reqRow.document_id).single();

  const { data: signers } = await admin.from('sig_signers')
    .select('id, signer_role, order_index, name, email, is_required, signed_at, declined_at')
    .eq('request_id', reqRow.id).order('order_index');

  // Signed URL for PDF (5min)
  const { data: signed } = await admin.storage.from('sig-documents').createSignedUrl(doc!.storage_path, 300);

  if (!reqRow.opened_at) {
    await admin.from('sig_requests').update({ opened_at: new Date().toISOString(), status: 'geoeffnet' }).eq('id', reqRow.id);
    await admin.from('sig_audit_log').insert({
      document_id: doc!.id, request_id: reqRow.id, event: 'opened',
      ip_address: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      user_agent: req.headers.get('user-agent'),
    });
  }

  return new Response(JSON.stringify({
    request: reqRow, document: doc, signers, pdf_url: signed?.signedUrl,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});

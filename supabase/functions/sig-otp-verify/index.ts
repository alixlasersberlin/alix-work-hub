import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  let body: any;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const { token, signer_id, code } = body || {};
  if (!token || !signer_id || !code) {
    return new Response(JSON.stringify({ error: 'token, signer_id, code required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: reqRow } = await admin.from('sig_requests').select('id, document_id').eq('token', token).maybeSingle();
  if (!reqRow) return new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

  const { data: ch } = await admin.from('sig_otp_challenges')
    .select('*').eq('request_id', reqRow.id).eq('signer_id', signer_id)
    .is('verified_at', null).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!ch) return new Response(JSON.stringify({ error: 'no active OTP' }), {
    status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
  if (new Date(ch.expires_at).getTime() < Date.now()) {
    return new Response(JSON.stringify({ error: 'expired' }), {
      status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (ch.attempts >= ch.max_attempts) {
    return new Response(JSON.stringify({ error: 'too_many_attempts' }), {
      status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const codeHash = await sha256Hex(String(code));
  if (codeHash !== ch.code_hash) {
    await admin.from('sig_otp_challenges').update({ attempts: ch.attempts + 1 }).eq('id', ch.id);
    return new Response(JSON.stringify({ error: 'invalid_code' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  await admin.from('sig_otp_challenges').update({ verified_at: new Date().toISOString() }).eq('id', ch.id);
  await admin.from('sig_audit_log').insert({
    document_id: reqRow.document_id, request_id: reqRow.id, signer_id, event: 'otp_verified',
  });

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

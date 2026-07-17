// Send OTP code to a signer's email
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
  const { token, signer_id } = body || {};
  if (!token || !signer_id) {
    return new Response(JSON.stringify({ error: 'token, signer_id required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const admin = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: reqRow } = await admin.from('sig_requests').select('id, document_id').eq('token', token).maybeSingle();
  if (!reqRow) return new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
  const { data: signer } = await admin.from('sig_signers').select('id, email, name').eq('id', signer_id).eq('request_id', reqRow.id).maybeSingle();
  if (!signer?.email) return new Response(JSON.stringify({ error: 'signer email missing' }), {
    status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const codeHash = await sha256Hex(code);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  await admin.from('sig_otp_challenges').insert({
    request_id: reqRow.id, signer_id: signer.id, code_hash: codeHash, expires_at: expiresAt,
    ip_address: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
  });

  // Best-effort mail via transactional email using service role (no user auth in public flow)
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-transactional-email`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        templateName: 'sig-otp',
        recipientEmail: signer.email,
        idempotencyKey: `sig-otp-${reqRow.id}-${Date.now()}`,
        templateData: { code, name: signer.name, expires_min: 60 },
      }),
    });
  } catch (e: any) { console.error('sig-otp-send mail error', e?.message); }

  await admin.from('sig_audit_log').insert({
    document_id: reqRow.document_id, request_id: reqRow.id, signer_id: signer.id, event: 'otp_sent',
    details: { to: signer.email },
  });

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

// Submit signatures for a signer via the public token
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
  const { token, signer_id, signatures = [], decline_reason } = body || {};
  if (!token || !signer_id) {
    return new Response(JSON.stringify({ error: 'token, signer_id required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: reqRow } = await admin.from('sig_requests')
    .select('id, document_id, otp_required, status, expires_at').eq('token', token).maybeSingle();
  if (!reqRow) return new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
  if (new Date(reqRow.expires_at).getTime() < Date.now()) {
    return new Response(JSON.stringify({ error: 'expired' }), {
      status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const { data: signer } = await admin.from('sig_signers').select('*').eq('id', signer_id).eq('request_id', reqRow.id).maybeSingle();
  if (!signer) return new Response(JSON.stringify({ error: 'signer not found' }), {
    status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
  if (signer.signed_at || signer.declined_at) {
    return new Response(JSON.stringify({ error: 'already_completed' }), {
      status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const ua = req.headers.get('user-agent') ?? null;

  // Decline path
  if (decline_reason) {
    await admin.from('sig_signers').update({
      declined_at: new Date().toISOString(), decline_reason,
    }).eq('id', signer.id);
    await admin.from('sig_requests').update({ status: 'abgelehnt' }).eq('id', reqRow.id);
    await admin.from('sig_documents').update({ status: 'abgelehnt' }).eq('id', reqRow.document_id);
    await admin.from('sig_audit_log').insert({
      document_id: reqRow.document_id, request_id: reqRow.id, signer_id: signer.id,
      event: 'declined', ip_address: ip, user_agent: ua, details: { reason: decline_reason },
    });
    return new Response(JSON.stringify({ ok: true, status: 'abgelehnt' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // OTP gate
  let otpVerified = false;
  if (reqRow.otp_required) {
    const { data: ch } = await admin.from('sig_otp_challenges').select('verified_at')
      .eq('request_id', reqRow.id).eq('signer_id', signer.id)
      .not('verified_at', 'is', null).order('verified_at', { ascending: false }).limit(1).maybeSingle();
    if (!ch?.verified_at) {
      return new Response(JSON.stringify({ error: 'otp_required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    otpVerified = true;
  }

  if (!Array.isArray(signatures) || signatures.length === 0) {
    return new Response(JSON.stringify({ error: 'signatures required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const rows = [];
  for (const s of signatures) {
    const hashInput = JSON.stringify({ v: s.vector_data, p: s.png_data?.slice(0, 200), t: Date.now(), sid: signer.id });
    const hash = await sha256Hex(hashInput);
    rows.push({
      request_id: reqRow.id, signer_id: signer.id,
      field_key: s.field_key || 'signature',
      field_type: s.field_type || 'signature',
      vector_data: s.vector_data ?? null, png_data: s.png_data ?? null,
      page: s.page ?? 1, x: s.x ?? 0, y: s.y ?? 0, width: s.width ?? 200, height: s.height ?? 80,
      ip_address: ip, user_agent: ua, hash, otp_verified: otpVerified,
    });
  }
  const { error: sigErr } = await admin.from('sig_signatures').insert(rows);
  if (sigErr) {
    return new Response(JSON.stringify({ error: sigErr.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  await admin.from('sig_signers').update({ signed_at: new Date().toISOString() }).eq('id', signer.id);

  // Check if all required signers done
  const { data: allSigners } = await admin.from('sig_signers').select('id, is_required, signed_at, declined_at').eq('request_id', reqRow.id);
  const allDone = (allSigners || []).filter((s) => s.is_required).every((s) => s.signed_at);
  const anyDeclined = (allSigners || []).some((s) => s.declined_at);

  let finalStatus: 'signiert' | 'teilweise_signiert' | 'abgelehnt' = 'teilweise_signiert';
  if (anyDeclined) finalStatus = 'abgelehnt';
  else if (allDone) finalStatus = 'signiert';

  const updates: any = { status: finalStatus };
  if (finalStatus === 'signiert') updates.completed_at = new Date().toISOString();
  await admin.from('sig_requests').update(updates).eq('id', reqRow.id);
  await admin.from('sig_documents').update({
    status: finalStatus,
    ...(finalStatus === 'signiert' ? { completed_at: new Date().toISOString(), locked_at: new Date().toISOString() } : {}),
  }).eq('id', reqRow.document_id);

  await admin.from('sig_audit_log').insert({
    document_id: reqRow.document_id, request_id: reqRow.id, signer_id: signer.id,
    event: finalStatus === 'signiert' ? 'signed_complete' : 'signed_partial',
    ip_address: ip, user_agent: ua, details: { signatures: rows.length },
  });

  return new Response(JSON.stringify({ ok: true, status: finalStatus }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

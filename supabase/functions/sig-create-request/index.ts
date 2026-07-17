// Create a new signature request: document + signers + token, send invite email
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function randomToken(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  let s = '';
  for (const b of buf) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: ud, error: uerr } = await userClient.auth.getUser(auth.replace('Bearer ', ''));
  if (uerr || !ud?.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const { data: canSend } = await userClient.rpc('sig_can_send');
  if (!canSend) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const {
    title, document_type, entity_type = null, entity_id = null, customer_id = null,
    pdf_base64, fields = [], signers = [], channel = 'email', otp_required = true,
    expires_days = 14, template_id = null, base_url = 'https://alixwork.de',
  } = body || {};

  if (!title || !document_type || !pdf_base64 || !Array.isArray(signers) || signers.length === 0) {
    return new Response(JSON.stringify({
      error: 'title, document_type, pdf_base64, signers required',
    }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const docId = crypto.randomUUID();
  const path = `${ud.user.id}/${docId}/v1.pdf`;

  // Upload PDF
  const bin = atob(pdf_base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const { error: upErr } = await admin.storage.from('sig-documents').upload(path, bytes, {
    contentType: 'application/pdf', upsert: false,
  });
  if (upErr) {
    return new Response(JSON.stringify({ error: `Upload failed: ${upErr.message}` }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const hash = await sha256Hex(pdf_base64);

  // Insert document
  const { data: doc, error: docErr } = await admin.from('sig_documents').insert({
    id: docId, title, document_type, entity_type, entity_id, customer_id,
    storage_path: path, sha256: hash, version: 1, status: 'versendet',
    template_id, fields, created_by: ud.user.id,
  }).select().single();
  if (docErr || !doc) {
    return new Response(JSON.stringify({ error: docErr?.message || 'Insert failed' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Version snapshot
  await admin.from('sig_document_versions').insert({
    document_id: docId, version: 1, storage_path: path, sha256: hash,
    is_signed_version: false, created_by: ud.user.id,
  });

  // Request + signers
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + Math.min(Math.max(Number(expires_days) || 14, 1), 60) * 86400 * 1000).toISOString();
  const { data: reqRow, error: reqErr } = await admin.from('sig_requests').insert({
    document_id: docId, channel, token, otp_required, status: 'versendet',
    expires_at: expiresAt, sent_at: new Date().toISOString(), created_by: ud.user.id,
  }).select().single();
  if (reqErr || !reqRow) {
    return new Response(JSON.stringify({ error: reqErr?.message || 'Request failed' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const signerRows = signers.map((s: any, i: number) => ({
    request_id: reqRow.id,
    signer_role: s.signer_role || 'kunde',
    order_index: s.order_index ?? i,
    name: s.name || null, email: s.email || null, phone: s.phone || null,
    is_required: s.is_required !== false,
  }));
  await admin.from('sig_signers').insert(signerRows);

  await admin.from('sig_audit_log').insert({
    document_id: docId, request_id: reqRow.id,
    event: 'request_created', actor_user_id: ud.user.id, actor_email: ud.user.email,
    ip_address: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    user_agent: req.headers.get('user-agent'),
    details: { document_type, signer_count: signers.length },
  });

  const signUrl = `${base_url.replace(/\/$/, '')}/sign-doc/${token}`;

  // Try to send invite email (best effort)
  try {
    const primary = signers.find((s: any) => s.email)?.email;
    if (primary) {
      const emailRes = await fetch(`${SUPABASE_URL}/functions/v1/send-transactional-email`, {
        method: 'POST',
        headers: {
          'Authorization': auth, 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          templateName: 'alix-sign-invite',
          recipientEmail: primary,
          idempotencyKey: `sig-invite-${reqRow.id}`,
          templateData: {
            offer_number: title,
            customer_name: signers[0]?.name,
            sign_url: signUrl,
            expires_at: new Date(expiresAt).toLocaleDateString('de-DE'),
          },
        }),
      });
      if (emailRes.ok) {
        await admin.from('sig_audit_log').insert({
          document_id: docId, request_id: reqRow.id, event: 'email_sent',
          details: { to: primary },
        });
      }
    }
  } catch (e: any) {
    console.error('sig-create-request email error', e?.message);
  }

  return new Response(JSON.stringify({
    document_id: docId, request_id: reqRow.id, token, sign_url: signUrl, expires_at: expiresAt,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});

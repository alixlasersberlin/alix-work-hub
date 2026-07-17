// Async bulk creator: stores CSV/recipient batch as sig_bulk_jobs and creates
// one sig_requests entry per row via sig-create-request. Progress via Realtime.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface Recipient { name?: string; email: string; phone?: string; signer_role?: string; }

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
  const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
  const admin = createClient(SUPABASE_URL, SERVICE);

  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const userId = userData.user.id;

  let body: any;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const {
    title, document_type = 'sonstiges', pdf_base64,
    recipients = [], otp_required = false, expires_days = 21,
    template_id = null, base_url,
  } = body || {};

  if (!title || !pdf_base64 || !Array.isArray(recipients) || recipients.length === 0) {
    return new Response(JSON.stringify({ error: 'title, pdf_base64, recipients required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Job Row anlegen
  const { data: job, error: jobErr } = await admin.from('sig_bulk_jobs').insert({
    uploaded_by: userId,
    template_id,
    total: recipients.length,
    processed: 0,
    failed: 0,
    status: 'running',
  }).select().single();

  if (jobErr || !job) {
    return new Response(JSON.stringify({ error: jobErr?.message ?? 'job insert failed' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Async Processing im Hintergrund starten und sofort antworten
  const process = async () => {
    let ok = 0, failed = 0;
    for (let i = 0; i < recipients.length; i++) {
      const r: Recipient = recipients[i];
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/sig-create-request`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: SERVICE,
            Authorization: `Bearer ${SERVICE}`,
          },
          body: JSON.stringify({
            title: `${title} – ${r.name || r.email}`,
            document_type,
            pdf_base64,
            signers: [{ signer_role: r.signer_role || 'kunde', name: r.name || '', email: r.email, phone: r.phone || '' }],
            otp_required,
            expires_days,
            base_url,
            bulk_job_id: job.id,
            created_by: userId,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        ok++;
      } catch (e) {
        console.error('bulk row failed', r.email, e);
        failed++;
      }
      // Progress-Update alle 1 Zeile → triggert Realtime
      await admin.from('sig_bulk_jobs').update({
        processed: ok + failed,
        failed,
      }).eq('id', job.id);
    }
    await admin.from('sig_bulk_jobs').update({
      status: failed === recipients.length ? 'failed' : 'completed',
      processed: ok + failed,
      failed,
    }).eq('id', job.id);
  };

  // fire-and-forget: EdgeRuntime.waitUntil hält den Worker am Leben
  // @ts-ignore Deno Deploy Edge-Runtime API
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
    // @ts-ignore
    EdgeRuntime.waitUntil(process());
  } else {
    process();
  }

  return new Response(JSON.stringify({ ok: true, job_id: job.id }), {
    status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

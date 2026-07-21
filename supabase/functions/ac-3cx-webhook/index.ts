// 3CX Call Control webhook - receives call events (ringing, answered, ended, voicemail)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-3cx-signature',
};

function normalizeNumber(n?: string) {
  if (!n) return null;
  return n.replace(/[^\d+]/g, '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const secret = Deno.env.get('PBX_3CX_WEBHOOK_SECRET');
    const provided = req.headers.get('x-3cx-signature') || new URL(req.url).searchParams.get('secret');
    if (secret && provided !== secret) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const body = await req.json();
    // Expected fields: event, call_id, direction, from, to, extension, agent_email, status, recording_url, voicemail_url, started_at, answered_at, ended_at, duration
    const event = String(body.event || body.status || '').toLowerCase();
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const fromNumber = normalizeNumber(body.from);
    const toNumber = normalizeNumber(body.to);

    // Try to link agent by email -> user_profiles.user_id
    let agentUserId: string | null = null;
    if (body.agent_email) {
      const { data } = await supabase.from('user_profiles').select('user_id').eq('email', body.agent_email).maybeSingle();
      agentUserId = data?.user_id ?? null;
    }
    // Contact lookup by phone
    let contactId: string | null = null;
    const searchNum = body.direction === 'inbound' ? fromNumber : toNumber;
    if (searchNum) {
      const { data } = await supabase.from('ac_contacts').select('id').or(`phone.ilike.%${searchNum.slice(-8)}%,mobile.ilike.%${searchNum.slice(-8)}%`).limit(1).maybeSingle();
      contactId = data?.id ?? null;
    }

    const externalId = body.call_id || body.id || `${fromNumber}-${toNumber}-${body.started_at || Date.now()}`;

    const statusMap: Record<string, string> = {
      ringing: 'ringing', start: 'ringing', started: 'ringing',
      answered: 'answered', answer: 'answered', connected: 'answered',
      ended: 'ended', end: 'ended', hangup: 'ended', complete: 'ended',
      missed: 'missed', voicemail: 'voicemail', busy: 'busy', failed: 'failed',
    };
    const status = statusMap[event] || 'ringing';

    const payload: Record<string, unknown> = {
      external_call_id: externalId,
      direction: body.direction === 'outbound' ? 'outbound' : 'inbound',
      status,
      from_number: fromNumber,
      to_number: toNumber,
      extension: body.extension ?? null,
      agent_user_id: agentUserId,
      contact_id: contactId,
      recording_url: body.recording_url ?? null,
      voicemail_url: body.voicemail_url ?? null,
      metadata: body,
    };
    if (body.started_at) payload.started_at = body.started_at;
    if (body.answered_at || status === 'answered') payload.answered_at = body.answered_at || new Date().toISOString();
    if (body.ended_at || status === 'ended' || status === 'missed' || status === 'voicemail') {
      payload.ended_at = body.ended_at || new Date().toISOString();
      if (body.duration) payload.duration_seconds = Number(body.duration);
    }

    const { data, error } = await supabase.from('ac_calls').upsert(payload, { onConflict: 'external_call_id' }).select().single();
    if (error) throw error;

    // Auto-trigger voicemail transcription (fire-and-forget)
    if (data?.voicemail_url && !data?.voicemail_transcript) {
      const fnUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/ac-voicemail-transcribe`;
      fetch(fnUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
        body: JSON.stringify({ call_id: data.id }),
      }).catch((e) => console.error('voicemail transcribe trigger failed', e));
    }

    return new Response(JSON.stringify({ ok: true, call: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('ac-3cx-webhook error', e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

// AlixWork → AlixSmart outbound push
// Pushes ticket updates (status changes, new comments) back to AlixSmart.
// Auth (incoming): x-alix-sync-key matching ALIX_SYNC_KEY secret.
// Auth (outgoing to AlixSmart): x-api-key = ALIXSMART_API_KEY.
//
// Body: { ticket_id: uuid, event: 'status_change' | 'comment' | 'update', message_id?: uuid }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-alix-sync-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const rateBucket = new Map<string, number[]>();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 60;
function rateLimited(key: string): boolean {
  const now = Date.now();
  const arr = (rateBucket.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  arr.push(now);
  rateBucket.set(key, arr);
  return arr.length > RATE_MAX;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const expected = Deno.env.get('ALIX_SYNC_KEY');
  const provided = req.headers.get('x-alix-sync-key');
  if (!expected || provided !== expected) {
    return json({ error: 'unauthorized' }, 401);
  }
  if (rateLimited(provided)) {
    return json({ error: 'rate_limited', limit: RATE_MAX, window_s: 60 }, 429);
  }

  const ALIXSMART_API_URL = Deno.env.get('ALIXSMART_API_URL');
  const ALIXSMART_API_KEY = Deno.env.get('ALIXSMART_API_KEY');

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let body: { ticket_id?: string; event?: string; message_id?: string };
  try { body = await req.json(); } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  if (!body.ticket_id) return json({ error: 'ticket_id_required' }, 400);

  const { data: ticket, error: tErr } = await supabase
    .from('tickets')
    .select('id, external_ticket_id, source_system, status, priority, customer_visible_status, internal_note, title, description, updated_at')
    .eq('id', body.ticket_id)
    .maybeSingle();

  if (tErr || !ticket) return json({ error: 'ticket_not_found' }, 404);
  if (!ticket.external_ticket_id) {
    return json({ ok: true, skipped: 'no_external_id' });
  }

  let messagePayload: Record<string, unknown> | null = null;
  if (body.message_id) {
    const { data: msg } = await supabase
      .from('ticket_messages')
      .select('id, sender_type, sender_name, sender_email, message, is_internal, created_at')
      .eq('id', body.message_id)
      .maybeSingle();
    if (msg) messagePayload = msg as Record<string, unknown>;
  }

  const payload = {
    external_ticket_id: ticket.external_ticket_id,
    event: body.event || 'update',
    ticket: {
      status: ticket.status,
      priority: ticket.priority,
      customer_visible_status: ticket.customer_visible_status,
      internal_note: ticket.internal_note,
      title: ticket.title,
      description: ticket.description,
      updated_at: ticket.updated_at,
    },
    message: messagePayload,
    source: 'alixwork',
  };

  if (!ALIXSMART_API_URL || !ALIXSMART_API_KEY) {
    await supabase.from('ticket_sync_logs').insert({
      external_ticket_id: ticket.external_ticket_id,
      direction: 'outbound',
      action: body.event || 'update',
      status: 'error',
      error_message: 'ALIXSMART_API_URL or ALIXSMART_API_KEY missing',
      payload,
    });
    return json({ error: 'push_target_not_configured', fallback: 'polling_via_readapi' }, 200);
  }

  try {
    const resp = await fetch(ALIXSMART_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ALIXSMART_API_KEY,
      },
      body: JSON.stringify(payload),
    });
    const text = await resp.text();
    const ok = resp.ok;

    await supabase.from('ticket_sync_logs').insert({
      external_ticket_id: ticket.external_ticket_id,
      direction: 'outbound',
      action: body.event || 'update',
      status: ok ? 'success' : 'error',
      error_message: ok ? null : `HTTP ${resp.status}: ${text.slice(0, 500)}`,
      payload,
    });

    if (ok) {
      await supabase
        .from('tickets')
        .update({ last_outbound_sync_at: new Date().toISOString() })
        .eq('id', ticket.id);
    }

    return json({ ok, status: resp.status, fallback_available: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase.from('ticket_sync_logs').insert({
      external_ticket_id: ticket.external_ticket_id,
      direction: 'outbound',
      action: body.event || 'update',
      status: 'error',
      error_message: `push_failed: ${msg}. Polling fallback active.`,
      payload,
    });
    return json({ ok: false, error: msg, fallback: 'polling_via_readapi' }, 200);
  }

  function json(b: unknown, status = 200) {
    return new Response(JSON.stringify(b), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

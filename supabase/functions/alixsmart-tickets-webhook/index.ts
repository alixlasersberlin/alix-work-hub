// AlixSmart → AlixWork inbound webhook
// POST a ticket payload to create or update a ticket plus messages/attachments.
// Auth: shared secret in `x-alixsmart-secret` header (Supabase secret ALIXSMART_WEBHOOK_SECRET).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-alixsmart-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface Payload {
  external_ticket_id: string;
  source_system?: string;
  customer_name?: string;
  company_name?: string;
  customer_email?: string;
  customer_phone?: string;
  customer_address?: string;
  order_number?: string;
  device_name?: string;
  serial_number?: string;
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  department?: string;
  customer_visible_status?: string;
  internal_note?: string;
  messages?: Array<{
    external_message_id?: string;
    sender_type?: string;
    sender_name?: string;
    sender_email?: string;
    message?: string;
    is_internal?: boolean;
    created_at?: string;
  }>;
  attachments?: Array<{
    file_url?: string;
    file_name?: string;
    file_type?: string;
    file_size?: number;
  }>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const expectedSecret = Deno.env.get('ALIXSMART_WEBHOOK_SECRET');
  const provided = req.headers.get('x-alixsmart-secret');
  if (!expectedSecret || provided !== expectedSecret) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let body: Payload;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!body.external_ticket_id) {
    return new Response(JSON.stringify({ error: 'external_ticket_id_required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const now = new Date().toISOString();
  const ticketRow = {
    external_ticket_id: body.external_ticket_id,
    source_system: body.source_system || 'alixsmart',
    customer_name: body.customer_name ?? null,
    company_name: body.company_name ?? null,
    customer_email: body.customer_email ?? null,
    customer_phone: body.customer_phone ?? null,
    customer_address: body.customer_address ?? null,
    order_number: body.order_number ?? null,
    device_name: body.device_name ?? null,
    serial_number: body.serial_number ?? null,
    title: body.title ?? null,
    description: body.description ?? null,
    status: body.status || 'offen',
    priority: body.priority || 'normal',
    department: body.department || 'service',
    customer_visible_status: body.customer_visible_status || 'Ticket eingegangen',
    internal_note: body.internal_note ?? null,
    last_synced_at: now,
  };

  const { data: ticket, error: upsertErr } = await supabase
    .from('tickets')
    .upsert(ticketRow, { onConflict: 'external_ticket_id' })
    .select('id')
    .single();

  if (upsertErr || !ticket) {
    await supabase.from('ticket_sync_logs').insert({
      external_ticket_id: body.external_ticket_id,
      direction: 'inbound',
      action: 'upsert_ticket',
      status: 'error',
      error_message: upsertErr?.message || 'unknown',
      payload: body as unknown as Record<string, unknown>,
    });
    return new Response(JSON.stringify({ error: upsertErr?.message || 'upsert_failed' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Messages
  if (Array.isArray(body.messages) && body.messages.length > 0) {
    const rows = body.messages.map(m => ({
      ticket_id: ticket.id,
      external_message_id: m.external_message_id ?? null,
      sender_type: m.sender_type ?? null,
      sender_name: m.sender_name ?? null,
      sender_email: m.sender_email ?? null,
      message: m.message ?? null,
      is_internal: !!m.is_internal,
      source_system: body.source_system || 'alixsmart',
      created_at: m.created_at || now,
    }));
    await supabase.from('ticket_messages').insert(rows);
  }

  // Attachments
  if (Array.isArray(body.attachments) && body.attachments.length > 0) {
    const rows = body.attachments.map(a => ({
      ticket_id: ticket.id,
      file_url: a.file_url ?? null,
      file_name: a.file_name ?? null,
      file_type: a.file_type ?? null,
      file_size: a.file_size ?? null,
      source_system: body.source_system || 'alixsmart',
    }));
    await supabase.from('ticket_attachments').insert(rows);
  }

  await supabase.from('ticket_sync_logs').insert({
    external_ticket_id: body.external_ticket_id,
    direction: 'inbound',
    action: 'upsert_ticket',
    status: 'success',
    payload: body as unknown as Record<string, unknown>,
  });

  return new Response(JSON.stringify({ ok: true, ticket_id: ticket.id }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

// receive-alixsmart-ticket
// Inbound API: POST von AlixSmart. Header `x-alix-sync-key` muss mit Secret ALIX_SYNC_KEY übereinstimmen.
// Upsert in tickets (per external_ticket_id), dedup von messages (external_message_id) und attachments (file_url).
// Loggt jeden Aufruf in ticket_sync_logs.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-alix-sync-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const STATUS_MAP: Record<string, string> = {
  neu: 'offen',
  in_pruefung: 'serviceprüfung',
  in_bearbeitung: 'technik',
  ersatzteil_benoetigt: 'ersatzteile benötigt',
  rechnung_offen: 'finance',
  abholung_geplant: 'tourenplanung',
  geloest: 'abgeschlossen',
  geschlossen: 'archiviert',
};

interface MessageIn {
  external_message_id?: string;
  sender_type?: string;
  sender_name?: string;
  sender_email?: string;
  message?: string;
  is_internal?: boolean;
  created_at?: string;
}
interface AttachmentIn {
  file_url?: string;
  file_name?: string;
  file_type?: string;
  file_size?: number;
}
interface Payload {
  external_ticket_id?: string;
  customer_name?: string;
  customer_email?: string;
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  source_system?: string;
  company_name?: string;
  customer_phone?: string;
  customer_address?: string;
  order_number?: string;
  device_name?: string;
  serial_number?: string;
  department?: string;
  customer_visible_status?: string;
  internal_note?: string;
  messages?: MessageIn[];
  attachments?: AttachmentIn[];
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Test-Endpoint: GET liefert nur "alive" zurück (für UI-Testbutton)
  if (req.method === 'GET') {
    return json({ ok: true, service: 'receive-alixsmart-ticket', alive: true });
  }

  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  // --- Auth ---
  const expected = Deno.env.get('ALIX_SYNC_KEY');
  const provided = req.headers.get('x-alix-sync-key');
  if (!expected || !provided || provided !== expected) {
    // ohne external_ticket_id loggen wir trotzdem (best-effort)
    try {
      await supabase.from('ticket_sync_logs').insert({
        direction: 'inbound',
        action: 'auth',
        status: 'error',
        error_message: 'invalid_or_missing_x-alix-sync-key',
      });
    } catch { /* ignore */ }
    return json({ error: 'unauthorized' }, 401);
  }

  // --- Body ---
  let body: Payload;
  try {
    body = await req.json();
  } catch {
    await supabase.from('ticket_sync_logs').insert({
      direction: 'inbound', action: 'parse', status: 'error',
      error_message: 'invalid_json',
    });
    return json({ error: 'invalid_json' }, 400);
  }

  // --- Pflichtfelder ---
  const required: (keyof Payload)[] = [
    'external_ticket_id', 'customer_name', 'customer_email',
    'title', 'description', 'status', 'priority', 'source_system',
  ];
  const missing = required.filter(k => !body[k] || String(body[k]).trim() === '');
  if (missing.length > 0) {
    await supabase.from('ticket_sync_logs').insert({
      external_ticket_id: body.external_ticket_id ?? null,
      direction: 'inbound', action: 'validate', status: 'error',
      error_message: `missing_required_fields: ${missing.join(', ')}`,
      payload: body as unknown as Record<string, unknown>,
    });
    return json({ error: 'missing_required_fields', fields: missing }, 400);
  }

  const now = new Date().toISOString();
  const mappedStatus = STATUS_MAP[body.status!] ?? body.status!;

  const ticketRow = {
    external_ticket_id: body.external_ticket_id!,
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
    status: mappedStatus,
    priority: body.priority || 'normal',
    department: body.department || 'service',
    customer_visible_status: body.customer_visible_status || 'Ticket eingegangen',
    internal_note: body.internal_note ?? null,
    last_synced_at: now,
    updated_at: now,
  };

  // --- Upsert Ticket ---
  const { data: ticket, error: upsertErr } = await supabase
    .from('tickets')
    .upsert(ticketRow, { onConflict: 'external_ticket_id' })
    .select('id')
    .single();

  if (upsertErr || !ticket) {
    await supabase.from('ticket_sync_logs').insert({
      external_ticket_id: body.external_ticket_id!,
      direction: 'inbound', action: 'upsert_ticket', status: 'error',
      error_message: upsertErr?.message || 'unknown_upsert_error',
      payload: body as unknown as Record<string, unknown>,
    });
    return json({ error: upsertErr?.message || 'upsert_failed' }, 500);
  }

  const ticketId = ticket.id as string;
  const insertedCounts = { messages: 0, attachments: 0 };

  // --- Messages (Dedup via external_message_id) ---
  if (Array.isArray(body.messages) && body.messages.length > 0) {
    const incomingIds = body.messages.map(m => m.external_message_id).filter(Boolean) as string[];

    let existingIds = new Set<string>();
    if (incomingIds.length > 0) {
      const { data: existing } = await supabase
        .from('ticket_messages')
        .select('external_message_id')
        .eq('ticket_id', ticketId)
        .in('external_message_id', incomingIds);
      existingIds = new Set((existing ?? []).map((r: { external_message_id: string | null }) => r.external_message_id!).filter(Boolean));
    }

    const rows = body.messages
      .filter(m => !m.external_message_id || !existingIds.has(m.external_message_id))
      .map(m => ({
        ticket_id: ticketId,
        external_message_id: m.external_message_id ?? null,
        sender_type: m.sender_type ?? null,
        sender_name: m.sender_name ?? null,
        sender_email: m.sender_email ?? null,
        message: m.message ?? null,
        is_internal: !!m.is_internal,
        source_system: body.source_system || 'alixsmart',
        created_at: m.created_at || now,
      }));

    if (rows.length > 0) {
      const { error: mErr } = await supabase.from('ticket_messages').insert(rows);
      if (mErr) {
        await supabase.from('ticket_sync_logs').insert({
          external_ticket_id: body.external_ticket_id!,
          direction: 'inbound', action: 'insert_messages', status: 'error',
          error_message: mErr.message,
          payload: body as unknown as Record<string, unknown>,
        });
      } else {
        insertedCounts.messages = rows.length;
      }
    }
  }

  // --- Attachments (Dedup via file_url) ---
  if (Array.isArray(body.attachments) && body.attachments.length > 0) {
    const incomingUrls = body.attachments.map(a => a.file_url).filter(Boolean) as string[];

    let existingUrls = new Set<string>();
    if (incomingUrls.length > 0) {
      const { data: existing } = await supabase
        .from('ticket_attachments')
        .select('file_url')
        .eq('ticket_id', ticketId)
        .in('file_url', incomingUrls);
      existingUrls = new Set((existing ?? []).map((r: { file_url: string | null }) => r.file_url!).filter(Boolean));
    }

    const rows = body.attachments
      .filter(a => !a.file_url || !existingUrls.has(a.file_url))
      .map(a => ({
        ticket_id: ticketId,
        file_url: a.file_url ?? null,
        file_name: a.file_name ?? null,
        file_type: a.file_type ?? null,
        file_size: a.file_size ?? null,
        source_system: body.source_system || 'alixsmart',
      }));

    if (rows.length > 0) {
      const { error: aErr } = await supabase.from('ticket_attachments').insert(rows);
      if (aErr) {
        await supabase.from('ticket_sync_logs').insert({
          external_ticket_id: body.external_ticket_id!,
          direction: 'inbound', action: 'insert_attachments', status: 'error',
          error_message: aErr.message,
          payload: body as unknown as Record<string, unknown>,
        });
      } else {
        insertedCounts.attachments = rows.length;
      }
    }
  }

  // --- Success-Log ---
  await supabase.from('ticket_sync_logs').insert({
    external_ticket_id: body.external_ticket_id!,
    direction: 'inbound',
    action: 'upsert_ticket',
    status: 'success',
    payload: body as unknown as Record<string, unknown>,
  });

  return json({
    ok: true,
    ticket_id: ticketId,
    status_mapped_from: body.status,
    status_stored: mappedStatus,
    inserted: insertedCounts,
  });
});

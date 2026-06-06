// Resend webhook receiver for Alix MailCenter
// Verifies Svix signature (Resend uses Svix) and stores events in mail_events,
// and updates mail_messages status / timestamps accordingly.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { Webhook } from 'npm:svix@1.40.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, svix-id, svix-signature, svix-timestamp, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('RESEND_WEBHOOK_SECRET') ?? '';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

type StatusUpdate = {
  status?: string;
  field?: 'sent_at' | 'delivered_at' | 'opened_at' | 'clicked_at' | 'bounced_at' | 'unsubscribed_at';
};

function mapEvent(eventType: string): StatusUpdate {
  switch (eventType) {
    case 'email.sent':
      return { status: 'sent', field: 'sent_at' };
    case 'email.delivered':
      return { status: 'delivered', field: 'delivered_at' };
    case 'email.delivery_delayed':
      return { status: 'delayed' };
    case 'email.opened':
      return { status: 'opened', field: 'opened_at' };
    case 'email.clicked':
      return { status: 'clicked', field: 'clicked_at' };
    case 'email.bounced':
      return { status: 'bounced', field: 'bounced_at' };
    case 'email.complained':
      return { status: 'complained' };
    default:
      return {};
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const raw = await req.text();
  let payload: any;

  // 1) Verify
  try {
    if (WEBHOOK_SECRET.startsWith('whsec_')) {
      const wh = new Webhook(WEBHOOK_SECRET);
      const headers = {
        'svix-id': req.headers.get('svix-id') ?? '',
        'svix-timestamp': req.headers.get('svix-timestamp') ?? '',
        'svix-signature': req.headers.get('svix-signature') ?? '',
      };
      payload = wh.verify(raw, headers);
    } else if (WEBHOOK_SECRET) {
      // Fallback: shared secret header
      const token = req.headers.get('x-webhook-secret') ?? '';
      if (token !== WEBHOOK_SECRET) {
        return new Response(JSON.stringify({ error: 'invalid_signature' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      payload = JSON.parse(raw);
    } else {
      return new Response(JSON.stringify({ error: 'webhook_secret_not_configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (err) {
    console.error('Signature verification failed:', err);
    return new Response(JSON.stringify({ error: 'invalid_signature' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!payload || typeof payload !== 'object') {
    return new Response(JSON.stringify({ error: 'invalid_payload' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const eventType: string = payload.type ?? '';
  const data = payload.data ?? {};
  const providerMessageId: string | null =
    data.email_id ?? data.id ?? data.message_id ?? null;

  if (!eventType) {
    return new Response(JSON.stringify({ error: 'missing_event_type' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // 2) Find mail_messages row by provider_message_id
    let messageRowId: string | null = null;
    if (providerMessageId) {
      const { data: msg } = await supabase
        .from('mail_messages')
        .select('id')
        .eq('provider_message_id', providerMessageId)
        .maybeSingle();
      messageRowId = msg?.id ?? null;
    }

    // 3) Log event (only if we found a corresponding message — mail_events.message_id is uuid NOT NULL FK)
    if (messageRowId) {
      await supabase.from('mail_events').insert({
        message_id: messageRowId,
        event_type: eventType,
        event_data: payload,
        ip_address:
          req.headers.get('x-forwarded-for') ?? req.headers.get('cf-connecting-ip') ?? null,
        user_agent: req.headers.get('user-agent') ?? null,
      });

      // 4) Update message status + timestamp
      const mapping = mapEvent(eventType);
      if (mapping.status || mapping.field) {
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (mapping.status) patch.status = mapping.status;
        if (mapping.field) patch[mapping.field] = new Date().toISOString();
        await supabase.from('mail_messages').update(patch).eq('id', messageRowId);
      }
    } else {
      console.warn('No mail_messages row for provider_message_id:', providerMessageId, eventType);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Webhook processing error:', err);
    // Return 200 so Resend does not retry indefinitely on a logic bug; we logged it.
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

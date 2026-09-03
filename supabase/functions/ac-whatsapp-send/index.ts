// ALIXWORK MOBILE – Outbound WhatsApp (Prompt 4)
// Serverseitig autorisierter Versand über den Provider-Adapter.
// Keine Secrets im Frontend, keine Fake-Erfolgsmeldung: Der UI-Status folgt
// ausschliesslich dem tatsächlichen Provider-Ergebnis.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { sendOutbound, providerConfigStatus, ERROR_TEXT, type ErrorCode } from './outbound.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const admin = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const MAX_BYTES: Record<string, number> = { IMAGE: 5e6, VIDEO: 16e6, AUDIO: 16e6, DOCUMENT: 100e6 };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function fail(code: ErrorCode, detail?: string, status = 400) {
  return json({ ok: false, error_code: code, error: ERROR_TEXT[code], detail }, status);
}

async function flag(key: string, fallback = false) {
  const { data } = await admin.from('app_settings').select('value').eq('key', key).maybeSingle();
  if (!data) return fallback;
  return String(data.value).toLowerCase() === 'true';
}

async function logEvent(conversationId: string, type: string, userId: string | null, value: unknown) {
  await admin.from('ac_conversation_events').insert({
    conversation_id: conversationId, event_type: type, user_id: userId, new_value: value as any,
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  try {
    // 1) Authentifizierung – Identität NIE aus dem Client übernehmen
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: auth } = await userClient.auth.getUser();
    const user = auth?.user;
    if (!user) return json({ ok: false, error: 'Nicht angemeldet.' }, 401);

    const body = await req.json().catch(() => ({}));
    const conversationId = String(body.conversation_id ?? '');
    const messageType = String(body.message_type ?? 'TEXT').toUpperCase();
    const text: string | null = body.body ? String(body.body).slice(0, 4000) : null;
    const clientMessageId: string | null = body.client_message_id ?? null;
    if (!conversationId) return json({ ok: false, error: 'conversation_id fehlt.' }, 400);
    if (!['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'TEMPLATE'].includes(messageType)) {
      return json({ ok: false, error: 'message_type ungültig.' }, 400);
    }

    // 2) Berechtigung: aktives Mitarbeiterprofil
    const { data: profile } = await admin.from('user_profiles')
      .select('id, full_name, is_active').eq('id', user.id).maybeSingle();
    if (!profile || profile.is_active === false) {
      return json({ ok: false, error: 'Kein aktives Mitarbeiterprofil.' }, 403);
    }

    // 3) Idempotenz
    if (clientMessageId) {
      const { data: dupe } = await admin.from('ac_messages')
        .select('id, delivery_status, provider_message_id')
        .eq('client_message_id', clientMessageId).maybeSingle();
      if (dupe) return json({ ok: true, duplicate: true, message_id: dupe.id, status: dupe.delivery_status });
    }

    if (!(await flag('whatsapp_outbound_enabled'))) {
      return json({
        ok: false, error_code: 'OUTBOUND_DISABLED',
        error: 'WhatsApp-Versand ist derzeit deaktiviert (Feature-Flag whatsapp_outbound_enabled).',
      }, 409);
    }

    // 4) Conversation + Kanal
    const { data: conv } = await admin.from('ac_conversations')
      .select('id, tenant_id, channel_id, channel_type, external_thread_id, contact_id, first_response_at, is_test, priority')
      .eq('id', conversationId).maybeSingle();
    if (!conv) return json({ ok: false, error: 'Chat nicht gefunden.' }, 404);

    const { data: channel } = conv.channel_id
      ? await admin.from('ac_channels').select('id, provider, provider_phone_id, is_test, is_active').eq('id', conv.channel_id).maybeSingle()
      : { data: null as any };
    const provider = (channel?.provider ?? 'META').toUpperCase();
    const cfg = providerConfigStatus(provider);
    if (!cfg.ok) return fail('CONFIG_REQUIRED', `${provider} CONFIGURATION REQUIRED: ${cfg.missing.join(', ')}`, 409);

    // 5) Empfänger
    const { data: contact } = conv.contact_id
      ? await admin.from('ac_contacts').select('whatsapp_number, phone, full_name').eq('id', conv.contact_id).maybeSingle()
      : { data: null as any };
    const to = (contact?.whatsapp_number || contact?.phone || conv.external_thread_id || '').trim();
    if (!/^\+\d{7,15}$/.test(to)) return fail('INVALID_RECIPIENT', to);

    // 6) 24-Stunden-Fenster
    const { data: lastInbound } = await admin.from('ac_messages')
      .select('created_at').eq('conversation_id', conversationId).eq('direction', 'inbound')
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    const windowOpen = lastInbound?.created_at
      ? Date.now() - new Date(lastInbound.created_at).getTime() < 24 * 3600_000
      : false;
    if (!windowOpen && messageType !== 'TEMPLATE') {
      return fail('TEMPLATE_REQUIRED', 'Letzte Kundennachricht liegt länger als 24 Stunden zurück.', 409);
    }

    // 7) Medien: signierte, temporäre URL (privater Bucket, keine dauerhaft öffentliche URL)
    let mediaUrl: string | null = null;
    const storagePath: string | null = body.storage_path ?? null;
    if (messageType !== 'TEXT' && messageType !== 'TEMPLATE') {
      if (!storagePath) return json({ ok: false, error: 'storage_path fehlt.' }, 400);
      const size = Number(body.file_size ?? 0);
      if (size && size > (MAX_BYTES[messageType] ?? 100e6)) return fail('FILE_TOO_LARGE');
      const { data: signed, error: sErr } = await admin.storage
        .from('inbox-media').createSignedUrl(storagePath, 900);
      if (sErr || !signed?.signedUrl) return fail('UNSUPPORTED_FILE', sErr?.message, 400);
      mediaUrl = signed.signedUrl;
    }

    // 8) Template auflösen
    let template: { name: string; language: string; params: string[] } | null = null;
    if (messageType === 'TEMPLATE') {
      const { data: tpl } = await admin.from('whatsapp_templates')
        .select('id, name, language, meta_template_name, provider_template_id, body')
        .eq('id', String(body.template_id ?? '')).maybeSingle();
      if (!tpl) return json({ ok: false, error: 'Vorlage nicht gefunden.' }, 404);
      template = {
        name: tpl.meta_template_name || tpl.provider_template_id || tpl.name,
        language: tpl.language || 'de',
        params: Array.isArray(body.template_params) ? body.template_params.map(String) : [],
      };
    }

    // 9) Reply-Kontext
    let replyToProviderId: string | null = null;
    const replyToId: string | null = body.reply_to_message_id ?? null;
    if (replyToId) {
      const { data: rep } = await admin.from('ac_messages')
        .select('external_message_id, provider_message_id').eq('id', replyToId).maybeSingle();
      replyToProviderId = rep?.external_message_id ?? rep?.provider_message_id ?? null;
    }

    // 10) Nachricht als QUEUED speichern
    const previewBody = messageType === 'TEMPLATE'
      ? (text ?? `(Vorlage ${template?.name})`)
      : (text ?? `(${messageType})`);
    const { data: inserted, error: insErr } = await admin.from('ac_messages').insert({
      tenant_id: conv.tenant_id,
      channel_id: conv.channel_id,
      conversation_id: conversationId,
      direction: 'outbound',
      sender_type: 'user',
      sender_user_id: user.id,
      sender_name: profile.full_name ?? null,
      body: text,
      message_type: messageType,
      client_message_id: clientMessageId,
      reply_to_message_id: replyToId,
      delivery_status: 'queued',
      attachments: storagePath
        ? [{ storage_path: storagePath, file_name: body.file_name ?? null, mime_type: body.mime_type ?? null, file_size: body.file_size ?? null }]
        : null,
      metadata: { provider, is_test: !!(conv.is_test || channel?.is_test) },
    }).select('id').single();
    if (insErr || !inserted) return json({ ok: false, error: insErr?.message ?? 'Speichern fehlgeschlagen.' }, 500);
    await logEvent(conversationId, 'MESSAGE_QUEUED', user.id, { message_id: inserted.id, message_type: messageType });

    // 11) Provider aufrufen
    const result = await sendOutbound(provider, {
      to,
      type: messageType as any,
      body: text,
      mediaUrl,
      fileName: body.file_name ?? null,
      replyToProviderId,
      template,
    }, channel?.provider_phone_id);

    if (!result.ok) {
      await admin.from('ac_messages').update({
        delivery_status: 'failed', error_code: result.code, failed_reason: result.message,
      }).eq('id', inserted.id);
      await admin.from('ac_channels').update({ last_error: `${result.code}: ${result.message}`, last_error_at: new Date().toISOString() })
        .eq('id', conv.channel_id ?? '00000000-0000-0000-0000-000000000000');
      await logEvent(conversationId, 'MESSAGE_FAILED', user.id, { message_id: inserted.id, code: result.code });
      console.error('whatsapp send failed', result.code, result.message);
      return json({
        ok: false, message_id: inserted.id, error_code: result.code,
        error: ERROR_TEXT[result.code], detail: result.message,
      }, 502);
    }

    const now = new Date().toISOString();
    await admin.from('ac_messages').update({
      delivery_status: 'sent', provider_message_id: result.providerMessageId,
      external_message_id: result.providerMessageId, sent_at: now,
    }).eq('id', inserted.id);

    // 12/13/14) Conversation aktualisieren + SLA
    const patch: Record<string, unknown> = {
      last_message_at: now,
      last_agent_message_at: now,
      last_message_preview: previewBody.slice(0, 200),
    };
    if (!conv.first_response_at) patch.first_response_at = now;
    await admin.from('ac_conversations').update(patch).eq('id', conversationId);
    if (conv.channel_id) await admin.from('ac_channels').update({ last_outbound_at: now }).eq('id', conv.channel_id);

    // 15) Events + Eskalationen stoppen (Prompt 3)
    await logEvent(conversationId, 'MESSAGE_SENT', user.id, {
      message_id: inserted.id, provider, provider_message_id: result.providerMessageId,
    });
    const { data: esc } = await admin.from('conversation_escalations')
      .update({ status: 'CANCELLED', cancelled_at: now })
      .eq('conversation_id', conversationId).eq('status', 'SCHEDULED').select('id');
    if (esc?.length) await logEvent(conversationId, 'ESCALATION_CANCELLED', user.id, { reason: 'AGENT_RESPONSE', count: esc.length });

    return json({ ok: true, message_id: inserted.id, provider_message_id: result.providerMessageId, status: 'sent' });
  } catch (e) {
    console.error('ac-whatsapp-send error', e);
    return json({ ok: false, error: String((e as Error)?.message ?? e) }, 500);
  }
});

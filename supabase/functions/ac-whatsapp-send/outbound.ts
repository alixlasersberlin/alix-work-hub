// Outbound WhatsApp Provider Adapter (META / TWILIO).
// Secrets bleiben ausschliesslich serverseitig.

export type OutboundInput = {
  to: string;                    // E.164
  type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'TEMPLATE';
  body?: string | null;
  mediaUrl?: string | null;      // signierte, temporäre URL
  fileName?: string | null;
  replyToProviderId?: string | null;
  template?: { name: string; language: string; params: string[] } | null;
};

export type OutboundResult =
  | { ok: true; providerMessageId: string; raw: unknown }
  | { ok: false; code: ErrorCode; message: string; status?: number; raw?: unknown };

export type ErrorCode =
  | 'INVALID_RECIPIENT' | 'TEMPLATE_REQUIRED' | 'UNSUPPORTED_FILE' | 'FILE_TOO_LARGE'
  | 'PROVIDER_UNREACHABLE' | 'RATE_LIMIT' | 'AUTH_ERROR' | 'CONFIG_REQUIRED' | 'UNKNOWN';

export const ERROR_TEXT: Record<ErrorCode, string> = {
  INVALID_RECIPIENT: 'Empfängernummer ist für WhatsApp ungültig.',
  TEMPLATE_REQUIRED: 'Für diesen Chat ist eine WhatsApp-Vorlage erforderlich.',
  UNSUPPORTED_FILE: 'Dieser Dateityp wird von WhatsApp nicht unterstützt.',
  FILE_TOO_LARGE: 'Die Datei ist für WhatsApp zu groß.',
  PROVIDER_UNREACHABLE: 'WhatsApp-Anbieter ist derzeit nicht erreichbar.',
  RATE_LIMIT: 'Zu viele Nachrichten – der Versand wird erneut versucht.',
  AUTH_ERROR: 'Authentifizierung beim WhatsApp-Anbieter fehlgeschlagen.',
  CONFIG_REQUIRED: 'WhatsApp-Kanal ist noch nicht vollständig konfiguriert.',
  UNKNOWN: 'Unbekannter Fehler beim WhatsApp-Versand.',
};

function mapHttp(status: number): ErrorCode {
  if (status === 401 || status === 403) return 'AUTH_ERROR';
  if (status === 429) return 'RATE_LIMIT';
  if (status >= 500) return 'PROVIDER_UNREACHABLE';
  return 'UNKNOWN';
}

export function providerConfigStatus(provider: string) {
  if (provider === 'TWILIO') {
    const ok = !!(Deno.env.get('TWILIO_ACCOUNT_SID') && Deno.env.get('TWILIO_AUTH_TOKEN')
      && Deno.env.get('TWILIO_WHATSAPP_FROM_NUMBER'));
    return { ok, missing: ok ? [] : ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_WHATSAPP_FROM_NUMBER'] };
  }
  const token = Deno.env.get('WHATSAPP_ACCESS_TOKEN') ?? Deno.env.get('WHATSAPP_CLOUD_TOKEN');
  const ok = !!(token && Deno.env.get('WHATSAPP_PHONE_NUMBER_ID'));
  return { ok, missing: ok ? [] : ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID'] };
}

async function sendMeta(input: OutboundInput, phoneNumberId?: string | null): Promise<OutboundResult> {
  const token = Deno.env.get('WHATSAPP_ACCESS_TOKEN') ?? Deno.env.get('WHATSAPP_CLOUD_TOKEN');
  const phoneId = phoneNumberId || Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  if (!token || !phoneId) {
    return { ok: false, code: 'CONFIG_REQUIRED', message: 'META CONFIGURATION REQUIRED: WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID' };
  }
  const payload: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: input.to.replace('+', ''),
  };
  if (input.replyToProviderId) payload.context = { message_id: input.replyToProviderId };

  if (input.type === 'TEMPLATE' && input.template) {
    payload.type = 'template';
    payload.template = {
      name: input.template.name,
      language: { code: input.template.language || 'de' },
      ...(input.template.params.length
        ? { components: [{ type: 'body', parameters: input.template.params.map((t) => ({ type: 'text', text: t })) }] }
        : {}),
    };
  } else if (input.type === 'TEXT') {
    payload.type = 'text';
    payload.text = { preview_url: true, body: input.body ?? '' };
  } else {
    const key = input.type.toLowerCase(); // image | video | audio | document
    payload.type = key;
    payload[key] = {
      link: input.mediaUrl,
      ...(input.body && input.type !== 'AUDIO' ? { caption: input.body } : {}),
      ...(input.type === 'DOCUMENT' && input.fileName ? { filename: input.fileName } : {}),
    };
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errCode = String(raw?.error?.code ?? '');
      const code: ErrorCode = errCode === '131047' || errCode === '131051'
        ? 'TEMPLATE_REQUIRED'
        : errCode === '131026' ? 'INVALID_RECIPIENT' : mapHttp(res.status);
      return { ok: false, code, message: raw?.error?.message ?? `HTTP ${res.status}`, status: res.status, raw };
    }
    const id = raw?.messages?.[0]?.id;
    if (!id) return { ok: false, code: 'UNKNOWN', message: 'Provider lieferte keine Nachrichten-ID.', raw };
    return { ok: true, providerMessageId: id, raw };
  } catch (e) {
    return { ok: false, code: 'PROVIDER_UNREACHABLE', message: String((e as Error)?.message ?? e) };
  }
}

async function sendTwilio(input: OutboundInput): Promise<OutboundResult> {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const token = Deno.env.get('TWILIO_AUTH_TOKEN');
  const from = Deno.env.get('TWILIO_WHATSAPP_FROM_NUMBER');
  if (!sid || !token || !from) {
    return { ok: false, code: 'CONFIG_REQUIRED', message: 'TWILIO CONFIGURATION REQUIRED: TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_WHATSAPP_FROM_NUMBER' };
  }
  const form = new URLSearchParams({
    To: `whatsapp:${input.to}`,
    From: from.startsWith('whatsapp:') ? from : `whatsapp:${from}`,
  });
  if (input.body) form.set('Body', input.body);
  if (input.mediaUrl) form.set('MediaUrl', input.mediaUrl);
  if (!input.body && !input.mediaUrl) return { ok: false, code: 'UNKNOWN', message: 'Leere Nachricht.' };

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form,
    });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      const c = Number(raw?.code ?? 0);
      const code: ErrorCode = c === 63016 ? 'TEMPLATE_REQUIRED'
        : c === 21211 || c === 21614 ? 'INVALID_RECIPIENT' : mapHttp(res.status);
      return { ok: false, code, message: raw?.message ?? `HTTP ${res.status}`, status: res.status, raw };
    }
    return { ok: true, providerMessageId: raw?.sid, raw };
  } catch (e) {
    return { ok: false, code: 'PROVIDER_UNREACHABLE', message: String((e as Error)?.message ?? e) };
  }
}

export async function sendOutbound(
  provider: string,
  input: OutboundInput,
  phoneNumberId?: string | null,
): Promise<OutboundResult> {
  return (provider || '').toUpperCase() === 'TWILIO'
    ? await sendTwilio(input)
    : await sendMeta(input, phoneNumberId);
}

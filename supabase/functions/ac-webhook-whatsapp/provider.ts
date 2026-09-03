/**
 * WhatsApp Provider Adapter — normalisiert Provider-Payloads auf ein
 * einheitliches internes Nachrichtenmodell. Neue Provider können ergänzt
 * werden, ohne die Inbox-Logik anzufassen.
 */
export type NormalizedMessage = {
  provider: 'META' | 'TWILIO' | 'OTHER';
  provider_message_id: string;
  from: string;              // E.164
  to: string | null;         // E.164 (Alix-Nummer)
  provider_phone_id: string | null;
  direction: 'INBOUND' | 'OUTBOUND';
  message_type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'LOCATION' | 'CONTACT' | 'SYSTEM' | 'TEMPLATE';
  body: string | null;
  contact_name: string | null;
  media: Array<{ external_media_id?: string; mime_type?: string; file_name?: string; url?: string }>;
  timestamp: string;         // ISO
  raw_metadata: unknown;
};

export interface WhatsAppProviderAdapter {
  readonly name: 'META' | 'TWILIO';
  matches(payload: unknown, contentType: string): boolean;
  parse(payload: any): NormalizedMessage[];
}

export function toE164(raw: string | null | undefined): string {
  const s = String(raw ?? '').replace(/^whatsapp:/i, '').replace(/[^\d+]/g, '');
  if (!s) return '';
  if (s.startsWith('+')) return s;
  if (s.startsWith('00')) return `+${s.slice(2)}`;
  if (s.startsWith('0')) return `+49${s.slice(1)}`;
  return `+${s}`;
}

const META_TYPES: Record<string, NormalizedMessage['message_type']> = {
  text: 'TEXT', image: 'IMAGE', video: 'VIDEO', audio: 'AUDIO', voice: 'AUDIO',
  document: 'DOCUMENT', location: 'LOCATION', contacts: 'CONTACT',
  sticker: 'IMAGE', template: 'TEMPLATE', system: 'SYSTEM',
};

export const MetaWhatsAppProvider: WhatsAppProviderAdapter = {
  name: 'META',
  matches: (payload: any) => payload?.object === 'whatsapp_business_account' || Array.isArray(payload?.entry),
  parse(payload: any): NormalizedMessage[] {
    const out: NormalizedMessage[] = [];
    for (const entry of payload?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        const value = change?.value ?? {};
        const contacts = value.contacts ?? [];
        const phoneId = value.metadata?.phone_number_id ?? null;
        const toNumber = value.metadata?.display_phone_number ?? null;
        for (const msg of value.messages ?? []) {
          const type = META_TYPES[msg.type] ?? 'TEXT';
          const media: NormalizedMessage['media'] = [];
          for (const key of ['image', 'video', 'audio', 'voice', 'document', 'sticker']) {
            if (msg[key]?.id) {
              media.push({
                external_media_id: msg[key].id,
                mime_type: msg[key].mime_type,
                file_name: msg[key].filename,
              });
            }
          }
          out.push({
            provider: 'META',
            provider_message_id: msg.id,
            from: toE164(msg.from),
            to: toE164(toNumber) || null,
            provider_phone_id: phoneId,
            direction: 'INBOUND',
            message_type: type,
            body: msg.text?.body ?? msg.button?.text ?? msg.interactive?.button_reply?.title
              ?? msg[msg.type]?.caption ?? null,
            contact_name: contacts.find((c: any) => c.wa_id === msg.from)?.profile?.name ?? null,
            media,
            timestamp: msg.timestamp
              ? new Date(Number(msg.timestamp) * 1000).toISOString()
              : new Date().toISOString(),
            raw_metadata: msg,
          });
        }
      }
    }
    return out;
  },
};

export const TwilioWhatsAppProvider: WhatsAppProviderAdapter = {
  name: 'TWILIO',
  matches: (payload: any) => typeof payload?.MessageSid === 'string' || typeof payload?.SmsMessageSid === 'string',
  parse(p: any): NormalizedMessage[] {
    const numMedia = Number(p.NumMedia ?? 0);
    const media: NormalizedMessage['media'] = [];
    for (let i = 0; i < numMedia; i++) {
      media.push({ url: p[`MediaUrl${i}`], mime_type: p[`MediaContentType${i}`] });
    }
    let type: NormalizedMessage['message_type'] = 'TEXT';
    if (numMedia > 0) {
      const mt = String(p.MediaContentType0 ?? '');
      type = mt.startsWith('image/') ? 'IMAGE'
        : mt.startsWith('video/') ? 'VIDEO'
        : mt.startsWith('audio/') ? 'AUDIO' : 'DOCUMENT';
    }
    return [{
      provider: 'TWILIO',
      provider_message_id: p.MessageSid ?? p.SmsMessageSid,
      from: toE164(p.From),
      to: toE164(p.To) || null,
      provider_phone_id: null,
      direction: 'INBOUND',
      message_type: type,
      body: p.Body ?? null,
      contact_name: p.ProfileName ?? null,
      media,
      timestamp: new Date().toISOString(),
      raw_metadata: p,
    }];
  },
};

export const PROVIDERS: WhatsAppProviderAdapter[] = [MetaWhatsAppProvider, TwilioWhatsAppProvider];

export function normalizePayload(payload: any): NormalizedMessage[] {
  for (const adapter of PROVIDERS) {
    try {
      if (adapter.matches(payload, '')) return adapter.parse(payload);
    } catch (e) {
      console.error(`provider ${adapter.name} parse failed`, e);
    }
  }
  return [];
}

// ---- Status-Webhooks (sent / delivered / read / failed) -------------------
export type NormalizedStatus = {
  provider: 'META' | 'TWILIO';
  provider_message_id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  error?: string | null;
  timestamp: string;
};

const META_STATUS: Record<string, NormalizedStatus['status']> = {
  sent: 'sent', delivered: 'delivered', read: 'read', failed: 'failed',
};
const TWILIO_STATUS: Record<string, NormalizedStatus['status']> = {
  sent: 'sent', delivered: 'delivered', read: 'read',
  failed: 'failed', undelivered: 'failed',
};

export function normalizeStatuses(payload: any): NormalizedStatus[] {
  const out: NormalizedStatus[] = [];
  for (const entry of payload?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      for (const st of change?.value?.statuses ?? []) {
        const mapped = META_STATUS[String(st.status)];
        if (!mapped || !st.id) continue;
        out.push({
          provider: 'META',
          provider_message_id: st.id,
          status: mapped,
          error: st.errors?.[0]?.title ?? null,
          timestamp: st.timestamp ? new Date(Number(st.timestamp) * 1000).toISOString() : new Date().toISOString(),
        });
      }
    }
  }
  const twStatus = payload?.MessageStatus ?? payload?.SmsStatus;
  const twSid = payload?.MessageSid ?? payload?.SmsSid;
  if (twStatus && twSid && TWILIO_STATUS[String(twStatus)]) {
    out.push({
      provider: 'TWILIO',
      provider_message_id: twSid,
      status: TWILIO_STATUS[String(twStatus)],
      error: payload?.ErrorMessage ?? payload?.ErrorCode ?? null,
      timestamp: new Date().toISOString(),
    });
  }
  return out;
}

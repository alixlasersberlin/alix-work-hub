import { z } from 'npm:zod@3';

export const WhatsAppLeadEvent = z.object({
  event: z.literal('sales.whatsapp.inbound'),
  event_id: z.string().min(1).max(200),
  occurred_at: z.string().datetime({ offset: true }),
  source: z.literal('alixsmart'),
  version: z.literal(1),
  data: z.object({
    tenant_id: z.string().uuid(),
    contact_id: z.string().min(1).max(200),
    conversation_id: z.string().min(1).max(200),
    message_id: z.string().min(1).max(200),
    phone: z.string().regex(/^\+[1-9]\d{7,14}$/),
    name: z.string().max(250).optional(),
    text: z.string().max(10000),
    language: z.string().max(20).optional(),
    area: z.literal('sales'),
    direction: z.literal('inbound'),
    relevance: z.enum(['sales', 'service', 'spam', 'internal', 'unknown']),
  }).strict(),
}).strict();

export function recommendedPriority(text: string): 'Hoch' | 'Normal' | 'Niedrig' {
  if (/\b(kaufen|kauf|bestellen|preis|kostet|kosten|finanzierung|finanzieren|liefertermin|lieferung|price|buy|purchase|financing|delivery)\b/i.test(text)) return 'Hoch';
  if (/\b(interesse|beratung|beraten|information|infos|produkt|interested|consultation)\b/i.test(text)) return 'Normal';
  return 'Niedrig';
}

export function detectProduct(text: string, products: { id: string; name?: string | null; model?: string | null; sku?: string | null }[]): string | undefined {
  const normalize = (s: string) => s.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const input = ` ${normalize(text)} `;
  const hits = products.filter(p => [p.name, p.model, p.sku].some(v => v && normalize(v).length >= 4 && input.includes(` ${normalize(v)} `)));
  return hits.length === 1 ? hits[0].name || hits[0].model || undefined : undefined;
}

export async function verifyTimestampedSignature(raw: string, signature: string | null, timestamp: string | null, secret: string, now = Date.now()): Promise<boolean> {
  if (!secret || !signature || !timestamp || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(Math.floor(now / 1000) - Number(timestamp)) > 300) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${raw}`));
  const expected = Array.from(new Uint8Array(bytes)).map(b => b.toString(16).padStart(2, '0')).join('');
  const provided = signature.replace(/^sha256=/, '').toLowerCase();
  if (expected.length !== provided.length) return false;
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  return difference === 0;
}
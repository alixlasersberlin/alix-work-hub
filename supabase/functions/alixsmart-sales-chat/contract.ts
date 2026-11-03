import { z } from 'npm:zod@3';

export const ChatRequest = z.discriminatedUnion('action', [
  z.object({ action: z.literal('status'), lead_id: z.string().uuid() }).strict(),
  z.object({ action: z.literal('read'), lead_id: z.string().uuid(), before: z.string().max(300).optional() }).strict(),
  z.object({ action: z.literal('send'), lead_id: z.string().uuid(), text: z.string().trim().min(1).max(4000), request_id: z.string().uuid() }).strict(),
  z.object({ action: z.literal('mark_read'), lead_id: z.string().uuid(), message_id: z.string().min(1).max(200) }).strict(),
  z.object({ action: z.literal('media'), lead_id: z.string().uuid(), message_id: z.string().min(1).max(200), media_id: z.string().min(1).max(200) }).strict(),
]);
export const Media = z.object({ id: z.string().min(1).max(200), name: z.string().max(250), mime: z.string().max(100) }).strict();
export const Message = z.object({ id: z.string().min(1).max(200), direction: z.enum(['inbound', 'outbound']), text: z.string().max(10000), at: z.string().datetime({ offset: true }), status: z.enum(['received', 'queued', 'sent', 'delivered', 'read', 'failed', 'undelivered']), media: z.array(Media).max(10).default([]) }).strict();
export const RemoteReply = z.object({
  ok: z.literal(true), protocol: z.literal('alixwork-sales-v1'),
  lead_id: z.string().uuid(), tenant_id: z.string().uuid(), contact_id: z.string().min(1), conversation_id: z.string().min(1),
  messages: z.array(Message).max(100).optional(), next_cursor: z.string().max(300).nullable().optional(),
  can_send: z.boolean().optional(), freeform_until: z.string().datetime({ offset: true }).nullable().optional(),
  message: Message.optional(), media_url: z.string().url().optional(),
}).strict();
export function matchesChatScope(scope: { tenant_id: string; contact_id: string; conversation_id: string }, reply: { tenant_id: string; contact_id: string; conversation_id: string }) {
  return scope.tenant_id === reply.tenant_id && scope.contact_id === reply.contact_id && scope.conversation_id === reply.conversation_id;
}
export async function signChatBody(raw: string, timestamp: string, secret: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${raw}`));
  return `sha256=${Array.from(new Uint8Array(bytes)).map(v => v.toString(16).padStart(2, '0')).join('')}`;
}
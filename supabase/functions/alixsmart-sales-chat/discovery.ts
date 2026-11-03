import { z } from 'npm:zod@3';

export const DiscoveryRequest = z.object({ action: z.literal('list'), tenant_id: z.string().uuid(), before: z.string().max(300).optional() }).strict();
export const Conversation = z.object({
  id: z.string().uuid(), contact_id: z.string().uuid(), status: z.string().max(100).nullable(),
  triage_state: z.string().max(100).nullable(), assigned_user_id: z.string().uuid().nullable(),
  last_message_at: z.string().datetime({ offset: true }).nullable(),
}).strict();
export const DiscoveryReply = z.object({ ok: z.literal(true), protocol: z.literal('alixwork-sales-v1'), tenant_id: z.string().uuid(), conversations: z.array(Conversation).max(100), next_cursor: z.string().max(300).nullable() }).strict();
export function activeDiscoveryProfile(profile: { is_active?: boolean; account_status?: string; invitation_status?: string; password_reset_required?: boolean } | null) {
  return profile?.is_active === true && profile.account_status === 'active' && profile.invitation_status === 'accepted' && profile.password_reset_required === false;
}
export function restrictDiscovery<T extends { id: string }>(rows: T[], admin: boolean, assignedConversationIds: string[]) {
  const allowed = new Set(assignedConversationIds);
  return admin ? rows : rows.filter(row => allowed.has(row.id));
}
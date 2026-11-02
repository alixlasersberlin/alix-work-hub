import { supabase } from '@/integrations/supabase/client';
import type { MyLead } from './my-leads';

export type WhatsAppInboxLead = MyLead & { whatsapp?: { last_message?: string; last_message_at?: string; contact_id?: string; conversation_id?: string } };
export type LeadAssignee = { id: string; name: string };
export type WhatsAppReview = { event_id: string; at: string; reason: string; name?: string; phone?: string };
async function call<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await (supabase as any).rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}
export async function loadWhatsAppInbox(): Promise<WhatsAppInboxLead[]> {
  const result: WhatsAppInboxLead[] = [];
  for (let offset = 0; ; offset += 200) {
    const page = await call<WhatsAppInboxLead[]>('ml_wa_inbox', { _offset: offset });
    result.push(...page);
    if (page.length < 200) return result;
  }
}
export const loadWhatsAppAssignees = (tenant: string) => call<LeadAssignee[]>('ml_wa_assignees', { _tenant: tenant });
export const assignWhatsAppLead = (lead: string, user: string) => call<{ ok: boolean }>('ml_wa_assign', { _lead: lead, _user: user });
export const loadWhatsAppReview = () => call<WhatsAppReview[]>('ml_wa_review');
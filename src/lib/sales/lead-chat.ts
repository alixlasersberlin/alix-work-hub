import { supabase } from '@/integrations/supabase/client';
export type LeadChatMessage = { id: string; direction: 'inbound' | 'outbound'; text: string; at: string; status: string; media: { id: string; name: string; mime: string }[] };
export type LeadChatPage = { linked: boolean; messages: LeadChatMessage[]; has_more: boolean };
export async function readLeadChat(lead: string, offset = 0): Promise<LeadChatPage> {
  const { data, error } = await supabase.rpc('ml_wa_chat_page', { _lead_id: lead, _offset: offset, _limit: 50 });
  if (error) throw new Error(error.message);
  return data as unknown as LeadChatPage;
}
export async function remoteLeadChat(lead: string, action: 'status' | 'read' | 'send' | 'mark_read', extra: Record<string, string> = {}) {
  const { data, error } = await supabase.functions.invoke('alixsmart-sales-chat', { body: { action, lead_id: lead, ...extra } });
  if (error) throw new Error('ALIXSMART ist derzeit nicht erreichbar.');
  return data as { ok: boolean; connected: boolean; error?: string; can_send?: boolean; messages?: LeadChatMessage[]; message?: LeadChatMessage; next_cursor?: string | null };
}
export function mergeChatMessages(messages: LeadChatMessage[]): LeadChatMessage[] {
  return [...new Map(messages.map(m => [m.id, m])).values()].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
}
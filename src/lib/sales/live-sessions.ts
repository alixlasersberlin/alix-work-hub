import { supabase } from '@/integrations/supabase/client';
export type LiveSession = { id: string; contact_id: string; status: string | null; triage_state: string | null; assigned_user_id: string | null; last_message_at: string | null };
export function defaultWhatsAppTenant(allowed: { id: string; code: string }[], currentId?: string) {
  return allowed.find(tenant => tenant.code === 'DE')?.id || allowed.find(tenant => tenant.id === currentId)?.id || '';
}
export async function loadLiveSessions(tenant: string, before?: string): Promise<{ conversations: LiveSession[]; next_cursor: string | null }> {
  const { data, error } = await supabase.functions.invoke('alixsmart-sales-chat', { body: { action: 'list', tenant_id: tenant, ...(before ? { before } : {}) } });
  if (error) throw new Error('ALIXSMART ist derzeit nicht erreichbar.');
  if (!data?.ok || !data?.connected) throw new Error(data?.error || 'Die ALIXSMART-Verbindung ist noch nicht bestätigt.');
  return { conversations: data.conversations, next_cursor: data.next_cursor };
}
export function filterLiveSessions(rows: LiveSession[], status: string, query: string) {
  const search = query.toLowerCase().trim();
  return rows.filter(row => (!status || row.status === status) && (!search || [row.id, row.contact_id, row.status].join(' ').toLowerCase().includes(search)));
}
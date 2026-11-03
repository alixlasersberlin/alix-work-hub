import { supabase } from '@/integrations/supabase/client';
import type { MyLead } from './my-leads';

export const canReassignLeads = (roles: string[]) => roles.includes('Super Admin');
export type LeadUser = { id: string; full_name: string | null; is_active: boolean | null };
export async function loadLeadUsers(): Promise<LeadUser[]> {
  const users: LeadUser[] = [];
  for (let offset = 0; ; offset += 200) {
    const { data, error } = await supabase.from('user_profiles').select('id, full_name, is_active').order('id').range(offset, offset + 199);
    if (error) throw new Error('Benutzer konnten nicht geladen werden.');
    users.push(...(data || []));
    if (!data || data.length < 200) return users.sort((a, b) => (a.full_name || a.id).localeCompare(b.full_name || b.id, 'de'));
  }
}
export function matchesLeadUser(lead: MyLead, filter: string): boolean {
  return !filter || (filter === 'unassigned' ? !lead.assigned_user : lead.assigned_user === filter);
}
export const WHATSAPP_SESSION_STATUSES = [
  { value: 'open', label: 'Offen' }, { value: 'pending', label: 'Ausstehend' },
  { value: 'resolved', label: 'Erledigt' }, { value: 'closed', label: 'Geschlossen' },
  { value: 'snoozed', label: 'Zurückgestellt' },
];
export const isWhatsAppLead = (lead: MyLead) => lead.source === 'whatsapp_sales' || lead.whatsapp_session?.linked === true;
export function sessionStatusLabel(status?: string | null): string {
  return WHATSAPP_SESSION_STATUSES.find(s => s.value === status)?.label || status || 'Nicht übermittelt';
}
export function matchesSessionStatus(lead: MyLead, filter: string): boolean {
  return !filter || (filter === 'unknown' ? !lead.whatsapp_session?.status : lead.whatsapp_session?.status === filter);
}
export function leadInWorkspace(lead: MyLead, userId: string | undefined, admin: boolean, all: boolean, tenantId?: string): boolean {
  if (admin && all) return true;
  return lead.assigned_user === userId && (!tenantId || lead.tenant_id === tenantId);
}
export async function reassignLead(lead: string, user: string) {
  const { data, error } = await (supabase as any).rpc('ml_reassign', { _lead: lead, _user: user });
  if (error) throw new Error(error.message);
  return data as { ok: boolean; linked_offers?: number };
}
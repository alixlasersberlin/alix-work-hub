import { supabase } from '@/integrations/supabase/client';
import type { MyLead } from './my-leads';

export const canReassignLeads = (roles: string[]) => roles.includes('Super Admin');
export function leadInWorkspace(lead: MyLead, userId: string | undefined, admin: boolean, all: boolean, tenantId?: string): boolean {
  if (admin && all) return true;
  return lead.assigned_user === userId && (!tenantId || lead.tenant_id === tenantId);
}
export async function reassignLead(lead: string, user: string) {
  const { data, error } = await (supabase as any).rpc('ml_reassign', { _lead: lead, _user: user });
  if (error) throw new Error(error.message);
  return data as { ok: boolean; linked_offers?: number };
}
import { supabase } from '@/integrations/supabase/client';

export const MY_LEAD_STATUSES = ['Neu', 'Kontaktaufnahme läuft', 'Kunde erreicht', 'Beratung läuft', 'Angebot in Vorbereitung', 'Angebot versendet', 'Nachverhandlung', 'Auftrag erhalten', 'Gewonnen', 'Verloren'];
export type LeadWorkspace = { priority?: string; next_action?: string; last_activity_at?: string; offer_information?: Record<string, string>; documents?: { path: string; name: string; at: string }[] };
export type MyLead = { id: string; created_at: string; lead_number?: string; company?: string; first_name?: string; last_name?: string; email?: string; phone?: string; street?: string; zip?: string; city?: string; country?: string; source?: string; form_name?: string; requested_products?: string; message?: string; lead_status: string; assigned_user?: string; tenant_id?: string; converted_customer_id?: string; workspace?: LeadWorkspace; followups?: Followup[] };
export type Followup = { id: string; title: string; description?: string; due_at?: string; status?: string; done_at?: string };
export type LeadDetail = { lead: MyLead; workspace: LeadWorkspace; history: { id: string; action: string; note: string; user_id?: string; created_at: string }[]; followups: Followup[]; offers: { id: string; offer_number: string; offer_date: string; total_gross: number; status: string; approval_status: string; payload?: Record<string, any> }[]; orders: { id: string; order_number: string; total_amount: number; order_date: string; order_status: string; payment_status?: string; delivery_status?: string; source_system?: string }[] };
export const leadTitle = (lead: MyLead) => lead.company || [lead.first_name, lead.last_name].filter(Boolean).join(' ') || lead.lead_number || 'Anfrage';
export function isUnworked48h(lead: MyLead, now = Date.now()): boolean {
  return !lead.workspace?.last_activity_at && !['Gewonnen', 'Verloren', 'Archiviert'].includes(lead.lead_status) && now - Date.parse(lead.created_at) >= 48 * 60 * 60 * 1000;
}
export function followupState(item: Followup, now = new Date()): 'done' | 'overdue' | 'today' | 'planned' {
  if (item.done_at || ['Erledigt', 'done', 'completed'].includes(item.status || '')) return 'done';
  if (!item.due_at) return 'planned';
  const due = new Date(item.due_at);
  if (due.getTime() < now.getTime()) return 'overdue';
  return due.toDateString() === now.toDateString() ? 'today' : 'planned';
}
export function leadVisibleTo(userId: string, admin: boolean, lead: Pick<MyLead, 'assigned_user' | 'tenant_id'>, tenantIds: string[]): boolean {
  return admin || (lead.assigned_user === userId && !!lead.tenant_id && tenantIds.includes(lead.tenant_id));
}
async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase as any).rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}
export async function loadMyLeads(): Promise<MyLead[]> {
  const all: MyLead[] = [];
  for (let offset = 0; ; offset += 200) {
    const page = await rpc<MyLead[]>('ml_list', { _offset: offset, _limit: 200 });
    all.push(...page);
    if (page.length < 200) return all;
  }
}
export const loadLeadDetail = (id: string) => rpc<LeadDetail>('ml_detail', { _lead_id: id });
export const loadLeadStats = (all = false, tenant: string | null = null) => rpc<{ open_offers: number; order_value: number; orders: number }>('ml_scoped_stats', { _all: all, _tenant: tenant });
export const leadAction = (id: string, action: string, data: Record<string, unknown>) => rpc<LeadDetail>('ml_action', { _lead_id: id, _action: action, _data: data });
export const prepareLeadCustomer = (id: string, create = false) => rpc<string>('ml_prepare_customer', { _lead_id: id, _create: create });
export async function uploadLeadDocument(id: string, file: File): Promise<LeadDetail> {
  if (file.size > 20 * 1024 * 1024) throw new Error('Datei darf höchstens 20 MB groß sein.');
  if (!/\.(pdf|png|jpe?g|webp|docx?|xlsx?|txt)$/i.test(file.name)) throw new Error('Dieser Dateityp ist nicht zugelassen.');
  const suffix = file.name.split('.').pop()?.toLowerCase() || 'bin';
  const path = `leads/${id}/${crypto.randomUUID()}.${suffix}`;
  const { error } = await supabase.storage.from('inbox-media').upload(path, file, { upsert: false });
  if (error) throw error;
  return leadAction(id, 'document', { name: file.name, path });
}
export async function downloadLeadDocument(path: string, name: string) {
  const { data, error } = await supabase.storage.from('inbox-media').download(path);
  if (error || !data) throw error || new Error('Download fehlgeschlagen');
  const url = URL.createObjectURL(data);
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
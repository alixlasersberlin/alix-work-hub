import { z } from 'npm:zod@3';
export const TicketAiInput = z.object({
  ticket_id: z.string().uuid(), mode: z.enum(['reply', 'insights']).default('reply'),
  tone: z.string().trim().min(1).max(100).default('freundlich, professionell, lösungsorientiert'),
  hint: z.string().max(500).default(''),
});
export const TicketSyncInput = z.object({
  ticket_id: z.string().uuid(), message_id: z.string().uuid().nullable().optional(),
  action: z.enum(['manual','status_change','priority_change','assignment_change','customer_status_change','new_public_message','ticket_closed']).default('manual'),
});
export const FinanceAiInput = z.object({
  scope: z.enum(['cockpit','bwa','forecast','soll-ist','soll_ist']).default('cockpit'),
  tenant_id: z.string().uuid().nullable().optional(),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  kpis: z.record(z.unknown()).default({}).refine(v => JSON.stringify(v).length <= 40000, 'Kennzahlen zu umfangreich'),
});
/** Null is an aggregate over assigned tenants, never unrestricted global access. */
export function selectedTenantIds(assigned: string[], requested: unknown): string[] | null {
  if (!assigned.length) return null;
  if (requested == null) return [...new Set(assigned)];
  return typeof requested === 'string' && assigned.includes(requested) ? [requested] : null;
}
export function allActiveTenantsAssigned(assigned:string[],active:string[]):boolean {
  return active.length>0 && active.every(id=>assigned.includes(id));
}
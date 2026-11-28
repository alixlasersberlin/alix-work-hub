import { z } from 'npm:zod@3.25.76';

export const ManagementPackBody = z.object({
  pack_id: z.string().uuid(),
  action: z.enum(['generate', 'send']),
  recipients: z.array(z.string().trim().email()).min(1).max(50).optional(),
}).strict().refine((body) => body.action !== 'send' || !!body.recipients?.length, 'Recipients required');

export const ForecastBody = z.object({
  tenant_id: z.string().uuid().optional(),
  category: z.string().trim().min(1).max(100).default('Umsatz'),
  months: z.number().int().min(1).max(12).default(6),
  accounting_region: z.enum(['EU', 'CH']).default('EU'),
}).strict();

/** No implicit global write when a person has more than one company. */
export function forecastTenant(ids: string[], requested?: string): string | null {
  if (requested) return ids.includes(requested) ? requested : null;
  return ids.length === 1 ? ids[0] : null;
}
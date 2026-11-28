import { z } from 'npm:zod@3';
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => {
  const parsed = new Date(`${v}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === v;
}, 'Ungültiges Datum');
export const ImportInput = z.object({
  sources: z.array(z.enum(['zoho_eu_1', 'zoho_eu_2', 'zoho_us_1'])).min(1).max(3).optional(),
  date_from: date.optional(), date_to: date.optional(),
  per_page: z.number().int().min(1).max(200).optional(),
  max_pages: z.number().int().min(1).max(40).optional(),
  trigger_type: z.enum(['cron', 'manual']).optional(),
  test_email: z.boolean().optional(), dry_run: z.boolean().optional(),
  // Legacy fields accepted for compatibility but never used as destinations.
  to: z.string().max(255).optional(), cc: z.string().max(255).optional(),
}).refine(v => !v.date_to || v.date_to >= (v.date_from ?? '2025-01-01'), 'Ungültiger Zeitraum')
  .refine(v => !(v.dry_run && v.test_email), 'Testlauf darf keine E-Mail senden');
export function sourcesAllowed(requested: string[], assignedSources: (string | null)[]): boolean {
  return requested.length > 0 && requested.every(s => assignedSources.includes(s));
}
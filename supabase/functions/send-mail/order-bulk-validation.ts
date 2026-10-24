import { z } from 'npm:zod@3.25.76';

export const bulkOrderMailSchema = z.object({
  order_id: z.string().uuid(), customer_id: z.string().uuid(),
  to_email: z.string().trim().email().max(254), to_name: z.string().max(200).optional(),
  from_email: z.enum(['service@alix-lasers.com', 'vertrieb@alixwork.de', 'finance@alixwork.de', 'service@alixwork.de', 'news@alixwork.de']),
  subject: z.string().trim().min(1).max(200), body_text: z.string().trim().min(1).max(30000),
  attachments: z.array(z.object({
    filename: z.string().min(1).max(200).refine(s => !/[\r\n\\/]/.test(s)),
    content: z.string().regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
    contentType: z.string().max(150).regex(/^[\w.+-]+\/[\w.+-]+$/),
  })).max(10).default([]),
}).refine(b => b.attachments.reduce((sum, a) => sum + a.content.length * 3 / 4, 0) <= 10 * 1024 * 1024, 'Anhänge überschreiten 10 MB');
import { z } from 'npm:zod@3';

export const PurchaseOrderSendBody = z.object({
  po_id: z.string().uuid(),
  pdf_base64: z.string().max(14_000_000).refine((value) => {
    if (!value) return true;
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 !== 0) return false;
    try { return atob(value.slice(0, 8)).startsWith('%PDF-'); } catch { return false; }
  }, 'pdf_base64 must contain a PDF').optional(),
});
export const RepairQuoteSendBody = z.object({ quote_id: z.string().uuid() });
export const PURCHASE_SEND_ROLES = ['Super Admin', 'Admin', 'Geschäftsführung', 'Medical', 'Produktion', 'QM'];
export const REPAIR_SEND_ROLES = ['Super Admin', 'Admin', 'Order', 'Technik', 'Reparaturannahme', 'Österreich', 'SACHBEARBEITUNG', 'Auftragsverwaltung', 'Tourenplanung', 'Kundenservice', 'Serviceleitung', 'Finance'];

export function escapeMailText(value: unknown): string {
  const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value ?? '').replace(/[&<>"']/g, (character) => entities[character] ?? character);
}
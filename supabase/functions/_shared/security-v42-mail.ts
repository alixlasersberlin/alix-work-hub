import { z } from 'npm:zod@3';
export const OrderConfirmationBody = z.object({ signature_id: z.string().uuid().optional(), order_id: z.string().uuid().optional(), recipient_email: z.string().email().max(254).optional(), cc_creator: z.boolean().optional() }).refine(value => value.signature_id || value.order_id, 'signature_id or order_id required');
export const ORDER_CONFIRMATION_ROLES = ['Super Admin', 'Admin', 'Order', 'Auftragsverwaltung', 'SACHBEARBEITUNG', 'Vertrieb', 'Vertriebsleitung', 'Angebotsersteller', 'Österreich', 'Finance', 'Buchhaltung Admin'];
export const CatalogShareBody = z.object({ link_id: z.string().uuid(), channel: z.enum(['email', 'whatsapp', 'sms']), from_email: z.string().email().max(254).optional(), base_url: z.string().url().max(1000).optional(), subject: z.string().min(1).max(998).optional(), body: z.string().min(1).max(20_000).optional() });
export const CATALOG_SEND_ROLES = ['Super Admin', 'Admin', 'Katalog', 'Vertrieb', 'Vertriebsleitung'];
export function sameMailRecipient(requested: string | undefined, stored: unknown): boolean {
  return typeof stored === 'string' && !!stored.trim() && (requested === undefined || requested.trim().toLowerCase() === stored.trim().toLowerCase());
}
export function catalogShareOwned(userId: string, createdBy: unknown, roles: string[]): boolean {
  return createdBy === userId || roles.some(role => ['Super Admin', 'Admin', 'Katalog'].includes(role));
}
export function approvedCatalogBase(value?: string): string | null {
  const defaultBase = 'https://alixwork.de/catalog/share/';
  if (value === undefined) return defaultBase;
  try {
    const url = new URL(value);
    const hosts = ['alixwork.de', 'www.alixwork.de', 'app.alixwork.de', 'alix-pro-hub.lovable.app', 'id-preview--13914134-4b95-4f3f-a064-71f725c7d887.lovable.app'];
    if (url.protocol !== 'https:' || !hosts.includes(url.hostname) || url.port || url.username || url.password || url.search || url.hash || url.pathname !== '/catalog/share/') return null;
    return url.href;
  } catch { return null; }
}
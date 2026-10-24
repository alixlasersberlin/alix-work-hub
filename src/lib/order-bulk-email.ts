import { z } from 'zod';

export type OrderMailRecipient = {
  orderId: string; customerId: string; orderNumber: string; name: string; email: string;
};

export const orderMailSchema = z.object({
  subject: z.string().trim().min(1, 'Betreff fehlt').max(200),
  text: z.string().trim().min(1, 'Nachricht fehlt').max(30000),
  from: z.string().email(),
});

export function orderMailRecipients(orders: Array<{
  id: string; customer_id?: string | null; order_number?: string | null; _displayNumber?: string;
  customers?: { company_name?: string | null; contact_name?: string | null; email?: string | null } | null;
}>, selected: Set<string>): OrderMailRecipient[] {
  return orders.filter(o => selected.has(o.id)).map(o => ({
    orderId: o.id, customerId: o.customer_id ?? '', orderNumber: o._displayNumber || o.order_number || '',
    name: o.customers?.contact_name || o.customers?.company_name || '', email: o.customers?.email?.trim() ?? '',
  }));
}

export function validOrderRecipient(r: OrderMailRecipient) {
  return z.string().uuid().safeParse(r.customerId).success && z.string().email().safeParse(r.email).success;
}

export function personalizeOrderMail(text: string, r: OrderMailRecipient) {
  return text.replace(/\{\{\s*(kunde|auftrag)\s*\}\}/g, (_, key: string) => key === 'kunde' ? r.name : r.orderNumber);
}

export async function encodeMailFiles(files: File[]) {
  if (files.length > 10 || files.reduce((sum, f) => sum + f.size, 0) > 10 * 1024 * 1024) {
    throw new Error('Maximal 10 Anhänge mit zusammen 10 MB');
  }
  return Promise.all(files.map(async file => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return { filename: file.name, content: btoa(binary), contentType: file.type || 'application/octet-stream' };
  }));
}
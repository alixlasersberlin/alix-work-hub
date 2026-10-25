import { z } from 'npm:zod@3.25.76';

const externalId = z.string().min(1).max(128).regex(/^[A-Za-z0-9_.-]+$/);
const address = z.object({ street: z.string().min(1).max(200), postal_code: z.string().min(1).max(20), city: z.string().min(1).max(100), country: z.literal('DE') }).strict();
export const customerSchema = z.object({ external_customer_id: externalId, name: z.string().trim().min(1).max(200), email: z.string().trim().email().max(254).transform(s => s.toLowerCase()), company: z.string().max(200).optional(), phone: z.string().max(40).optional(), billing_address: address, shipping_address: address }).strict();
export const orderSchema = z.object({ shop_id: z.literal('hollywood-secret'), external_order_id: externalId, currency: z.literal('EUR'), customer: customerSchema, items: z.array(z.object({ sku: z.string().min(1).max(100).regex(/^[A-Za-z0-9_.-]+$/), quantity: z.number().int().min(1).max(1000), unit_price_cents: z.number().int().min(0).max(100000000) }).strict()).min(1).max(100), shipping_cents: z.number().int().min(0).max(10000000), total_cents: z.number().int().min(1).max(1000000000), payment_report: z.object({ method: z.enum(['bank_transfer','invoice','card']), provider_reference: z.string().max(150).optional(), reported_status: z.enum(['pending','paid','failed']) }).strict().optional() }).strict().superRefine((v, ctx) => { if (new Set(v.items.map(i => i.sku)).size !== v.items.length) ctx.addIssue({ code: 'custom', message: 'Duplicate SKU' }); });
export const createCustomerSchema = z.object({ shop_id: z.literal('hollywood-secret'), customer: customerSchema }).strict();
export const findCustomerSchema = z.object({ shop_id: z.literal('hollywood-secret'), email: z.string().email().max(254).transform(s => s.toLowerCase()) }).strict();
export const getOrderSchema = z.object({ shop_id: z.literal('hollywood-secret'), external_order_id: externalId }).strict();
export const adminSchema = z.object({ action: z.enum(['overview','logs','prices','mapping','remove_mapping','shipping','test_enabled','disable_production','self_test']), payload: z.record(z.unknown()).default({}) }).strict();

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.entries(value).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  return JSON.stringify(value);
}
export async function sha256(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes),b => b.toString(16).padStart(2,'0')).join('');
}
export async function keyMatches(candidate: string | null, expected: string | undefined) {
  if (!candidate || !expected || expected.length < 32) return false;
  const [a,b] = await Promise.all([sha256(candidate),sha256(expected)]);
  let diff = 0;
  for (let i=0;i<a.length;i++) diff |= a.charCodeAt(i)^b.charCodeAt(i);
  return diff === 0;
}
export function testOrder(id: string) {
  const a = { street: 'Teststraße 1', postal_code: '10115', city: 'Berlin', country: 'DE' };
  return { shop_id: 'hollywood-secret', external_order_id: id, currency: 'EUR', customer: { external_customer_id: id, name: 'Isolierter Schnittstellentest', email: `${id.toLowerCase()}@example.invalid`, billing_address: a, shipping_address: a }, items: [{sku:'HS-TEST-10',quantity:2,unit_price_cents:1000}], shipping_cents:0,total_cents:2000 };
}

const messages: Record<string,string> = {
  FORBIDDEN:'Zugriff nicht erlaubt.', INVALID_INPUT:'Ungültige Angaben.', SETUP_REQUIRED:'Zugang noch nicht eingerichtet.',
  PRODUCTION_DISABLED:'Produktive Übertragungen sind gesperrt.', TEST_DISABLED:'Testzugang ist gesperrt.', NOT_FOUND:'Shop-Vorgang nicht gefunden.',
  IDEMPOTENCY_CONFLICT:'Bestell-ID wurde bereits mit anderem Inhalt übertragen.', CUSTOMER_CONFLICT:'Kundenzuordnung widerspricht dem vorhandenen Shop-Kunden.',
  UNKNOWN_ARTICLE:'Keine freigegebene Artikelzuordnung.', PRICE_NOT_APPROVED:'Artikelpreis oder Steuer ist nicht freigegeben.', PRICE_MISMATCH:'Beträge stimmen nicht mit den freigegebenen Preisen überein.', SHIPPING_NOT_APPROVED:'Versandregel ist nicht freigegeben.',
};
export function safeDatabaseError(message: string) {
  const code = message.match(/HS_([A-Z_]+)/)?.[1] ?? 'INTERNAL_ERROR';
  const status = code === 'FORBIDDEN' ? 403 : code === 'NOT_FOUND' ? 404 : ['IDEMPOTENCY_CONFLICT','CUSTOMER_CONFLICT'].includes(code) ? 409 : ['PRODUCTION_DISABLED','TEST_DISABLED'].includes(code) ? 403 : code === 'INTERNAL_ERROR' ? 500 : code === 'SETUP_REQUIRED' ? 503 : 422;
  return { code, message: messages[code] ?? 'Verarbeitung fehlgeschlagen. Keine erneute Übertragung mit neuer Bestell-ID starten.', status };
}
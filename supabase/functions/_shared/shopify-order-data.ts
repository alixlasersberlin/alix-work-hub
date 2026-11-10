import { z } from 'npm:zod@3';

const money = z.object({ shopMoney: z.object({ amount: z.string().regex(/^\d+(\.\d+)?$/), currencyCode: z.string().length(3) }) });
const address = z.object({ name: z.string().nullable(), company: z.string().nullable(), address1: z.string().nullable(), address2: z.string().nullable(), city: z.string().nullable(), zip: z.string().nullable(), countryCodeV2: z.string().nullable(), phone: z.string().nullable() }).nullable();
export const orderSchema = z.object({
  id: z.string().regex(/^gid:\/\/shopify\/Order\/\d+$/), name: z.string().min(1), createdAt: z.string().datetime(), updatedAt: z.string().datetime(), cancelledAt: z.string().nullable(),
  email: z.string().nullable(), phone: z.string().nullable(), displayFinancialStatus: z.string(), displayFulfillmentStatus: z.string(),
  customer: z.object({ id: z.string(), displayName: z.string(), email: z.string().nullable(), phone: z.string().nullable() }).nullable(),
  billingAddress: address, shippingAddress: address, currentTotalPriceSet: money, totalReceivedSet: money, totalRefundedSet: money, totalOutstandingSet: money,
  lineItems: z.object({ nodes: z.array(z.object({ id: z.string(), name: z.string(), sku: z.string().nullable(), quantity: z.number().int().nonnegative(), currentQuantity: z.number().int().nonnegative(), originalUnitPriceSet: money, discountedTotalSet: money })), pageInfo: z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() }) }),
});
export const ORDER_FIELDS = `id name createdAt updatedAt cancelledAt email phone displayFinancialStatus displayFulfillmentStatus
customer { id displayName email phone }
billingAddress { name company address1 address2 city zip countryCodeV2 phone }
shippingAddress { name company address1 address2 city zip countryCodeV2 phone }
currentTotalPriceSet { shopMoney { amount currencyCode } }
totalReceivedSet { shopMoney { amount currencyCode } }
totalRefundedSet { shopMoney { amount currencyCode } }
totalOutstandingSet { shopMoney { amount currencyCode } }
lineItems(first: 100) { nodes { id name sku quantity currentQuantity originalUnitPriceSet { shopMoney { amount currencyCode } } discountedTotalSet(withCodeDiscounts: true) { shopMoney { amount currencyCode } } } pageInfo { hasNextPage endCursor } }`;

export function normalizeOrder(input: unknown) {
  const o = orderSchema.parse(input);
  if (o.lineItems.pageInfo.hasNextPage) throw new Error('Bestellung enthält weitere, noch nicht geladene Positionen.');
  if (!o.lineItems.nodes.length) throw new Error('Bestellung ohne Positionen.');
  const addr = (a: typeof o.shippingAddress) => a ? { ...a, address: a.address1, street: a.address1, postal_code: a.zip, country: a.countryCodeV2 } : null;
  const amount = (m: z.infer<typeof money>) => Number(m.shopMoney.amount);
  return {
    external_id: o.id, name: o.name, created_at: o.createdAt, updated_at: o.updatedAt,
    customer_id: o.customer?.id ?? null, customer_name: o.customer?.displayName ?? o.billingAddress?.name ?? o.shippingAddress?.name ?? 'Shopify-Gast',
    company: o.billingAddress?.company ?? null, email: o.email ?? o.customer?.email ?? null, phone: o.phone ?? o.customer?.phone ?? null,
    shipping: addr(o.shippingAddress), billing: addr(o.billingAddress), currency: o.currentTotalPriceSet.shopMoney.currencyCode,
    total: amount(o.currentTotalPriceSet), paid: Math.max(0, amount(o.totalReceivedSet) - amount(o.totalRefundedSet)), outstanding: amount(o.totalOutstandingSet), refunded: amount(o.totalRefundedSet),
    payment_status: o.displayFinancialStatus, fulfillment_status: o.displayFulfillmentStatus,
    status: o.cancelledAt ? 'storniert' : o.displayFulfillmentStatus === 'FULFILLED' ? 'geliefert' : 'offen',
    items: o.lineItems.nodes.map((l, position) => ({ id: l.id, name: l.name, sku: l.sku, quantity: l.currentQuantity, original_quantity: l.quantity,
      rate: amount(l.originalUnitPriceSet), amount: l.quantity ? Math.round(amount(l.discountedTotalSet) / l.quantity * l.currentQuantity * 100) / 100 : 0,
      discount: Math.max(0, Math.round((amount(l.originalUnitPriceSet) * l.quantity - amount(l.discountedTotalSet)) * 100) / 100), position })),
  };
}

export async function verifyShopifySignature(raw: Uint8Array, signature: string | null, secret: string) {
  if (!signature) return false;
  try {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    return await crypto.subtle.verify('HMAC', key, Uint8Array.from(atob(signature), c => c.charCodeAt(0)), raw);
  } catch { return false; }
}
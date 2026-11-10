import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createAuditServiceClient } from '../_shared/audit-auth.ts';
import { createShopifyClient, SHOP } from '../_shared/shopify-client.ts';
import { normalizeOrder, ORDER_FIELDS, verifyShopifySignature } from '../_shared/shopify-order-data.ts';
import { z } from 'npm:zod@3';

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: corsHeaders });
let client: ReturnType<typeof createShopifyClient> | undefined;
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST required' }, 405);
  const secret = Deno.env.get('SHOPIFY_CLIENT_SECRET');
  if (!secret || req.headers.get('x-shopify-shop-domain') !== SHOP) return json({ error: 'Invalid shop' }, 401);
  const raw = new Uint8Array(await req.arrayBuffer());
  if (raw.length > 5_000_000) return json({ error: 'Payload too large' }, 413);
  if (!await verifyShopifySignature(raw, req.headers.get('x-shopify-hmac-sha256'), secret)) return json({ error: 'Invalid signature' }, 401);
  const topic = req.headers.get('x-shopify-topic');
  const event = req.headers.get('x-shopify-webhook-id');
  if (!event || !topic || !['orders/create','orders/updated','orders/cancelled','orders/paid','refunds/create'].includes(topic)) return json({ error: 'Unsupported event' }, 400);
  try {
    const body = z.object({ admin_graphql_api_id: z.string().optional(), id: z.union([z.number().int().safe(),z.string().regex(/^\d+$/)]), order_id: z.union([z.number().int().safe(),z.string().regex(/^\d+$/)]).optional() }).parse(JSON.parse(new TextDecoder().decode(raw)));
    const id = topic === 'refunds/create' ? (body.order_id ? `gid://shopify/Order/${body.order_id}` : null) : body.admin_graphql_api_id ?? `gid://shopify/Order/${body.id}`;
    if (!id || !/^gid:\/\/shopify\/Order\/\d+$/.test(id)) return json({ error: 'Invalid order identity' },400);
    const db = createAuditServiceClient();
    const { data: gate, error: gateError } = await db.from('integration_health').select('shop_config,tenant_id').eq('integration','shopify-orders').maybeSingle();
    if (gateError || gate?.shop_config?.production_enabled !== true) return json({ error: 'Import not approved' },503);
    const { data: duplicate, error: duplicateError } = await db.from('integration_logs').select('id').eq('source','shopify:webhook').eq('external_id',event).eq('status','ok').limit(1);
    if (duplicateError) throw new Error('Dedup check failed');
    if (duplicate?.length) return json({ ok:true, skipped:true });
    const clientId = Deno.env.get('SHOPIFY_CLIENT_ID');
    if (!clientId) throw new Error('Client unavailable');
    client ??= createShopifyClient(clientId,secret);
    // Read the latest source record so old or out-of-order deliveries cannot undo refunds/cancellations.
    const data = await client.graphql(`query($id:ID!){order(id:$id){${ORDER_FIELDS}}}`, { id });
    if (!data.order) throw new Error('Order unavailable');
    while (data.order.lineItems.pageInfo.hasNextPage) {
      const extra = await client.graphql('query($id:ID!,$after:String){order(id:$id){lineItems(first:100,after:$after){nodes{id name sku quantity currentQuantity originalUnitPriceSet{shopMoney{amount currencyCode}} discountedTotalSet(withCodeDiscounts:true){shopMoney{amount currencyCode}}} pageInfo{hasNextPage endCursor}}}}',{id,after:data.order.lineItems.pageInfo.endCursor});
      data.order.lineItems.nodes.push(...extra.order.lineItems.nodes); data.order.lineItems.pageInfo=extra.order.lineItems.pageInfo;
    }
    const { data: result, error } = await db.rpc('shopify_apply_order',{p_order:normalizeOrder(data.order),p_dry:false,p_update:true});
    if (error) throw new Error('Order conflict or write failure');
    const { error: logError } = await db.from('integration_logs').insert({source:'shopify:webhook',event:topic,external_id:event,status:'ok',tenant_id:gate.tenant_id,payload:{order_id:id,result},message:'Shopify-Ereignis verarbeitet'});
    if (logError) throw new Error('Log failure');
    return json({ok:true,result});
  } catch {
    try { await createAuditServiceClient().from('integration_logs').insert({source:'shopify:webhook',event:topic,external_id:event,status:'error',message:'Ereignis nicht verarbeitet; erneut zustellen oder manuell prüfen.'}); } catch { /* fail closed */ }
    return json({error:'Shopify event could not be processed safely'},503);
  }
});
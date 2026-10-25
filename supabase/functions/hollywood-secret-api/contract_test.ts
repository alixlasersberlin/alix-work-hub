import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { orderSchema, canonicalJson, keyMatches, safeDatabaseError, testOrder } from './contract.ts';

Deno.test('Hollywood Secret: shop scope rejects another shop',()=>{assertEquals(orderSchema.safeParse({...testOrder('one'),shop_id:'other-shop'}).success,false);});
Deno.test('Hollywood Secret: duplicate SKUs cannot bypass line uniqueness',()=>{const x=testOrder('two');assertEquals(orderSchema.safeParse({...x,items:[...x.items,...x.items]}).success,false);});
Deno.test('Hollywood Secret: quantities and currency are bounded',()=>{const x=testOrder('three');assertEquals(orderSchema.safeParse({...x,items:[{...x.items[0],quantity:1001}]}).success,false);assertEquals(orderSchema.safeParse({...x,currency:'USD'}).success,false);});
Deno.test('Hollywood Secret: internal customer and approval fields rejected',()=>{const x=testOrder('four');assertEquals(orderSchema.safeParse({...x,deposit_ok:true}).success,false);assertEquals(orderSchema.safeParse({...x,customer:{...x.customer,id:'internal-id'}}).success,false);});
Deno.test('Hollywood Secret: foreign tax jurisdiction is rejected',()=>{const x=testOrder('five');assertEquals(orderSchema.safeParse({...x,customer:{...x.customer,shipping_address:{...x.customer.shipping_address,country:'AT'}}}).success,false);});
Deno.test('Hollywood Secret: canonical request survives key reordering',()=>{assertEquals(canonicalJson({b:2,a:{d:4,c:3}}),canonicalJson({a:{c:3,d:4},b:2}));assert(canonicalJson({a:1})!==canonicalJson({a:2}));});
Deno.test('Hollywood Secret: missing and incorrect access denied',async()=>{assertEquals(await keyMatches(null,undefined),false);assertEquals(await keyMatches('invalid','fixed-unit-test-only-not-a-real-credential'),false);});
Deno.test('Hollywood Secret: production disabled maps to forbidden',()=>{assertEquals(safeDatabaseError('HS_PRODUCTION_DISABLED').status,403);assertEquals(safeDatabaseError('HS_IDEMPOTENCY_CONFLICT').status,409);assertEquals(safeDatabaseError('raw private provider information').code,'INTERNAL_ERROR');});

Deno.test('Hollywood Secret: deployed sandbox roundtrip, concurrency, scope and rollback',async()=>{
  const key=Deno.env.get('HOLLYWOOD_SECRET_TEST_KEY');
  const url=Deno.env.get('SUPABASE_URL')??Deno.env.get('VITE_SUPABASE_URL');
  assert(key&&url,'Test environment needs configured sandbox access');
  const id=`deno-${crypto.randomUUID()}`;
  const base=`${url}/functions/v1/hollywood-secret-api/v1`;
  const call=async(endpoint:string,payload:unknown,k=key,mode='sandbox')=>{const r=await fetch(`${base}/${mode}/${endpoint}`,{method:'POST',headers:{'Content-Type':'application/json','X-Shop-Key':k,'Idempotency-Key':`hollywood-secret:${id}`},body:JSON.stringify(payload)});return {status:r.status,data:await r.json()};};
  const order=testOrder(id);
  assertEquals((await call('orders',order,'invalid-test-token')).status,401);
  const bad=await call('orders',{...order,items:[{...order.items[0],sku:'INVALID-ARTICLE'}]});assertEquals(bad.status,422);
  const customer=await call('customers/find',{shop_id:'hollywood-secret',external_customer_id:id,email:order.customer.email});assertEquals(customer.data.customer,null,'Failed order must roll back customer');
  const price=await call('orders',{...order,total_cents:1999});assertEquals(price.status,422);
  const [a,b]=await Promise.all([call('orders',order),call('orders',order)]);
  assertEquals([a.status,b.status].sort(),[200,201]);assertEquals(a.data.order_id,b.data.order_id);
  const read=await call('orders/read',{shop_id:'hollywood-secret',external_order_id:id});assertEquals(read.status,200);assertEquals(read.data.order_id,a.data.order_id);assertEquals(read.data.total_cents,2000);
  const hidden=await call('customers/find',{shop_id:'hollywood-secret',external_customer_id:`other-${id}`,email:order.customer.email});assertEquals(hidden.status,200);assertEquals(hidden.data.customer,null);
  assertEquals((await call('customers/find',{shop_id:'hollywood-secret',email:order.customer.email})).status,400);
  const found=await call('customers/find',{shop_id:'hollywood-secret',external_customer_id:id,email:order.customer.email});assertEquals(found.data.customer.id,read.data.customer_id);
  assertEquals((await call('orders',{...order,total_cents:2001})).status,409);
  assertEquals((await call('orders/read',{shop_id:'other-shop',external_order_id:id})).status,400);
  assertEquals((await call('orders',order,key,'production')).status>=400,true);
});

Deno.test('Hollywood Secret: deployed authenticated requests stop at rate limit',async()=>{
  const key=Deno.env.get('HOLLYWOOD_SECRET_TEST_KEY');
  const url=Deno.env.get('SUPABASE_URL')??Deno.env.get('VITE_SUPABASE_URL');
  assert(key&&url,'Configured sandbox access required');
  let limited=false;
  for(let i=0;i<61;i++) {
    const r=await fetch(`${url}/functions/v1/hollywood-secret-api/v1/sandbox/health`,{method:'POST',headers:{'Content-Type':'application/json','X-Shop-Key':key},body:JSON.stringify({shop_id:'hollywood-secret'})});
    await r.text();
    if(r.status===429){limited=true;break;}
    assertEquals(r.status,200);
  }
  assertEquals(limited,true,'Sixty requests per minute must be enforced by the server');
});
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createAuditServiceClient, requireAuditUser } from '../_shared/audit-auth.ts';
import { orderSchema, createCustomerSchema, findCustomerSchema, getOrderSchema, adminSchema, canonicalJson, sha256, keyMatches, testOrder, safeDatabaseError } from './contract.ts';

const headers = { ...corsHeaders, 'Access-Control-Allow-Headers': `${corsHeaders['Access-Control-Allow-Headers']}, x-shop-key, idempotency-key`, 'Content-Type':'application/json','Cache-Control':'no-store' };
const json = (data: unknown, status=200) => new Response(JSON.stringify(data),{status,headers});
const fail = (code: string,message: string,status: number,requestId: string) => json({error:{code,message},request_id:requestId},status);

Deno.serve(async (req: Request) => {
  const requestId=crypto.randomUUID();
  if (req.method==='OPTIONS') return new Response('ok',{headers});
  if (req.method!=='POST') return fail('METHOD_NOT_ALLOWED','Nur POST erlaubt.',405,requestId);
  const path = new URL(req.url).pathname.split('/hollywood-secret-api')[1] ?? '';
  try {
    if (Number(req.headers.get('content-length') ?? '0')>65536) return fail('BODY_TOO_LARGE','Anfrage zu groß.',413,requestId);
    const reader=req.body?.getReader();
    if (!reader) return fail('INVALID_INPUT','Anfrage fehlt.',400,requestId);
    let size=0; const chunks: Uint8Array[]=[];
    while (true) { const {done,value}=await reader.read(); if (done) break; size+=value.byteLength; if(size>65536){await reader.cancel();return fail('BODY_TOO_LARGE','Anfrage zu groß.',413,requestId);} chunks.push(value); }
    const bytes=new Uint8Array(size); let offset=0; for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    let body: unknown;
    try { body=JSON.parse(new TextDecoder().decode(bytes)); } catch {return fail('INVALID_INPUT','Ungültiges JSON.',400,requestId);}
    const db=createAuditServiceClient();
    if(path==='/v1/admin') {
      const auth=await requireAuditUser(req);
      if('response' in auth) return fail('UNAUTHORIZED','Anmeldung erforderlich.',401,requestId);
      const parsed=adminSchema.safeParse(body);
      if(!parsed.success) return fail('INVALID_INPUT','Ungültige Verwaltungsaktion.',400,requestId);
      const {data:overview,error:permission}=await db.rpc('hs_admin',{p_action:'overview',p_payload:{},p_user_id:auth.user.id});
      if(permission) {const e=safeDatabaseError(permission.message);return fail(e.code,e.message,e.status,requestId);}
      const {data:adminAllowed,error:adminRateError}=await db.rpc('hs_admin_rate_limit',{p_user_id:auth.user.id,p_action:parsed.data.action});
      if(adminRateError) return fail('INTERNAL_ERROR','Anfrageprüfung fehlgeschlagen.',500,requestId);
      if(!adminAllowed) return fail('RATE_LIMIT','Zu viele Verwaltungsanfragen. Nach einer Minute erneut versuchen.',429,requestId);
      if(parsed.data.action==='self_test') {
        const key=Deno.env.get('HOLLYWOOD_SECRET_TEST_KEY');
        if(!key) return fail('SETUP_REQUIRED','Testzugang muss sicher eingerichtet werden.',503,requestId);
        const base=`${Deno.env.get('SUPABASE_URL')}/functions/v1/hollywood-secret-api/v1/sandbox`;
        const id=`check-${crypto.randomUUID()}`;
        const order=testOrder(id);
        const call=async(endpoint: string,payload: unknown,apiKey=key) => {
          const r=await fetch(`${base}/${endpoint}`,{method:'POST',headers:{'Content-Type':'application/json','X-Shop-Key':apiKey,'Idempotency-Key':`hollywood-secret:${id}`},body:JSON.stringify(payload)});
          return {status:r.status,data:await r.json()};
        };
        const denied=await call('orders',order,'invalid-self-test-key');
        const first=await call('orders',order);
        const [repeat,read,conflict]=await Promise.all([call('orders',order),call('orders/read',{shop_id:'hollywood-secret',external_order_id:id}),call('orders',{...order,total_cents:2001})]);
        const checks={authentication:denied.status===401&&first.status===201,creation:first.status===201&&first.data.mode==='sandbox',duplicate:repeat.status===200&&repeat.data.order_id===first.data.order_id,read_back:read.status===200&&read.data.order_id===first.data.order_id,conflict:conflict.status===409};
        const ok=Object.values(checks).every(Boolean);
        await db.from('integration_logs').insert({source:'hollywood-secret:admin',event:'self_test',external_id:id,status:ok?'ok':'error',tenant_id:overview.connection.tenant_id,user_id:auth.user.id,message:ok?'Isolierter Test mit externem Endpunkt bestanden':'Isolierter Test nicht vollständig bestanden',payload:{checks}});
        return json({ok,checks,mode:'sandbox',request_id:requestId});
      }
      const {data,error}=parsed.data.action==='overview' ? {data:overview,error:null} : await db.rpc('hs_admin',{p_action:parsed.data.action,p_payload:parsed.data.payload,p_user_id:auth.user.id});
      if(error){const e=safeDatabaseError(error.message);return fail(e.code,e.message,e.status,requestId);}
      return json({data,key_status:{sandbox:Boolean(Deno.env.get('HOLLYWOOD_SECRET_TEST_KEY')),production:Boolean(Deno.env.get('HOLLYWOOD_SECRET_LIVE_KEY'))},request_id:requestId});
    }
    const match=path.match(/^\/v1\/(sandbox|production)\/(health|customers\/find|customers|orders\/read|orders)$/);
    if(!match) return fail('NOT_FOUND','Endpunkt nicht gefunden.',404,requestId);
    const [,mode,endpoint]=match;
    const expected=Deno.env.get(mode==='sandbox'?'HOLLYWOOD_SECRET_TEST_KEY':'HOLLYWOOD_SECRET_LIVE_KEY');
    if(!expected) return fail('SETUP_REQUIRED','Zugang noch nicht eingerichtet.',503,requestId);
    if(!await keyMatches(req.headers.get('X-Shop-Key'),expected)) return fail('UNAUTHORIZED','Ungültiger Shop-Zugang.',401,requestId);
    const {data:allowed,error:rateError}=await db.rpc('hs_rate_limit',{p_mode:mode});
    if(rateError) return fail('INTERNAL_ERROR','Anfrageprüfung fehlgeschlagen.',500,requestId);
    if(!allowed) return fail('RATE_LIMIT','Zu viele Anfragen. Nach einer Minute erneut versuchen.',429,requestId);
    if(endpoint==='health') {
      if(!getOrderSchema.pick({shop_id:true}).safeParse(body).success) return fail('INVALID_INPUT','Ungültiger Shop.',400,requestId);
      const {data:h,error}=await db.from('integration_health').select('shop_config').eq('integration','hollywood-secret').single();
      if(error) return fail('SETUP_REQUIRED','Verbindung nicht eingerichtet.',503,requestId);
      if(!(mode==='sandbox'?h.shop_config?.test_enabled:h.shop_config?.production_enabled)) return fail(mode==='sandbox'?'TEST_DISABLED':'PRODUCTION_DISABLED','Zugang gesperrt.',403,requestId);
      return json({ok:true,shop_id:'hollywood-secret',mode,version:'1',request_id:requestId});
    }
    const schema=endpoint==='orders'?orderSchema:endpoint==='orders/read'?getOrderSchema:endpoint==='customers'?createCustomerSchema:findCustomerSchema;
    const parsed=schema.safeParse(body);
    if(!parsed.success) return fail('INVALID_INPUT','Ungültige oder nicht erlaubte Angaben.',400,requestId);
    const action=endpoint==='orders'?'create_order':endpoint==='orders/read'?'get_order':endpoint==='customers'?'create_customer':'find_customer';
    if(action==='create_order') {
      const order=orderSchema.parse(body);
      if(req.headers.get('Idempotency-Key')!==`hollywood-secret:${order.external_order_id}`) return fail('INVALID_IDEMPOTENCY_KEY','Idempotency-Key muss Shop und Bestell-ID entsprechen.',400,requestId);
    }
    const hash=action==='create_order'?await sha256(canonicalJson(parsed.data)):null;
    const {data,error}=await db.rpc('hs_api',{p_mode:mode,p_action:action,p_payload:parsed.data,p_hash:hash});
    if(error) {
      const e=safeDatabaseError(error.message);
      await db.from('integration_logs').insert({source:'hollywood-secret:api',event:action,status:'error',message:e.code,external_id:requestId});
      return fail(e.code,e.message,e.status,requestId);
    }
    await db.from('integration_logs').insert({source:'hollywood-secret:api',event:action,status:'ok',message:mode,external_id:requestId});
    return json({...data,request_id:requestId},action==='create_order'&&!data.replayed?201:200);
  } catch {
    console.error('Hollywood Secret request failed',requestId);
    return fail('INTERNAL_ERROR','Verarbeitung fehlgeschlagen.',500,requestId);
  }
});
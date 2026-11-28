import {assertEquals,assert} from 'https://deno.land/std@0.224.0/assert/mod.ts';

type Handler=(req:Request)=>Response|Promise<Response>;
const staff='11111111-1111-4111-8111-111111111111';
const tenant='22222222-2222-4222-8222-222222222222';
const customer='33333333-3333-4333-8333-333333333333';
const order='44444444-4444-4444-8444-444444444444';
const record='55555555-5555-4555-8555-555555555555';
const handlers=new Map<string,Handler>();
async function loadHandlers(){
  const values:Record<string,string>={SUPABASE_URL:'https://sms-boundary.example.test',SUPABASE_ANON_KEY:'boundary-public',SUPABASE_SERVICE_ROLE_KEY:'boundary-service',TWILIO_ACCOUNT_SID:'boundary-account',TWILIO_AUTH_TOKEN:'boundary-token',TWILIO_SMS_FROM_NUMBER:'FIXTURE',LOVABLE_API_KEY:'',TWILIO_API_KEY:''};
  for(const [name,value] of Object.entries(values)) Deno.env.set(name,value);
  const original=Deno.serve;let captured:Handler|undefined;
  Deno.serve=((handler:Handler)=>{captured=handler;return {finished:Promise.resolve()};}) as unknown as typeof Deno.serve;
  try{for(const name of ['send-customer-sms','op-light-send-sms']){captured=undefined;await import(`../${name}/index.ts`);if(!captured)throw new Error('Missing SMS handler');handlers.set(name,captured);}}finally{Deno.serve=original;}
}
type State={active:boolean;role:string;assigned:boolean;visible:boolean;source:string;limit:unknown;limitFails:boolean;intentFails:boolean;providerCalls:number;quota:Record<string,unknown>[];audits:Record<string,unknown>[];callerParentRead:boolean};
async function fixture(run:(s:State)=>Promise<void>){
 const s:State={active:true,role:'Admin',assigned:true,visible:true,source:'fixture-source',limit:{allowed:true},limitFails:false,intentFails:false,providerCalls:0,quota:[],audits:[],callerParentRead:false};
 const previous=globalThis.fetch;
 globalThis.fetch=async(input,init)=>{
  const r=input instanceof Request?input:new Request(input,init);const u=new URL(r.url);
  const j=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
  if(u.hostname==='api.twilio.com'){s.providerCalls++;return j({sid:'SM-boundary-fixture',status:'queued'});}
  assertEquals(u.hostname,'sms-boundary.example.test');
  if(u.pathname.endsWith('/auth/v1/user'))return j({id:staff});
  if(u.pathname.endsWith('/user_profiles'))return j({is_active:s.active,account_status:s.active?'active':'disabled',invitation_status:'accepted',password_reset_required:false});
  if(u.pathname.endsWith('/user_roles'))return j([{roles:{name:s.role}}]);
  if(u.pathname.endsWith('/user_tenant_access'))return j(s.assigned?[{tenant_id:tenant}]:[]);
  if(u.pathname.endsWith('/tenants'))return j([{id:tenant,zoho_source_system:'fixture-source'}]);
  const machine=r.headers.get('Authorization')==='Bearer boundary-service';
  if(u.pathname.endsWith('/rpc/security_has_permission')){assertEquals(machine,false);return j(false);}
  if(u.pathname.endsWith('/rpc/sms_effective_config')){assert(machine);return j({account_sid:'boundary-account',auth_token:'boundary-token',from_number:'FIXTURE'});}
  if(u.pathname.endsWith('/rpc/sms_reserve_send')){assert(machine);s.quota.push(await r.json());return s.limitFails?j({message:'quota unavailable'},503):j(s.limit);}
  if(u.pathname.endsWith('/audit_logs')){assert(machine);s.audits.push(await r.json());return s.intentFails?j({message:'intent unavailable'},503):new Response(null,{status:201});}
  if(u.pathname.endsWith('/customer_sms_logs')){assert(machine);return new Response(null,{status:201});}
  if(u.pathname.endsWith('/order_documents')){
   if(machine){assert(s.callerParentRead);assertEquals(r.method,'GET');assert(s.audits.length>0);return j({id:record,download_token:'fixture-existing-token-12345',file_name:'fixture.pdf'});}
   s.callerParentRead=true;return j(s.visible?{id:record,order_id:order,document_type:'invoice'}:null);
  }
  assertEquals(machine,false,'Business reads must respect caller RLS');
  if(u.pathname.endsWith('/orders'))return j({id:order,customer_id:customer,order_number:'FIXTURE',source_system:s.source});
  if(u.pathname.endsWith('/customers'))return j({id:customer,phone:'+491711234567',source_system:s.source,company_name:'Fixture'});
  if(u.pathname.endsWith('/zoho_invoices'))return j(s.visible?{id:record,customer_id:customer,source_system:s.source,invoice_number:'FIXTURE'}:null);
  if(u.pathname.endsWith('/zoho_recurring_invoices'))return j(null);
  throw new Error('Unexpected SMS fixture operation');
 };
 try{await run(s);}finally{globalThis.fetch=previous;}
}
const body=(name:string)=>name==='send-customer-sms'?{customer_id:customer,order_id:order,document_id:record,phone:'01711234567',message_text:'Fixture {{link}}'}:{record_type:'invoice',record_id:record,to:'00491711234567',message:'Fixture'};
async function call(name:string,extra:Record<string,unknown>={}){const handler=handlers.get(name);if(!handler)throw new Error('Handler missing');return handler(new Request('https://sms-boundary.example.test',{method:'POST',headers:{Authorization:'Bearer boundary-session','Content-Type':'application/json'},body:JSON.stringify({...body(name),...extra})}));}
const names=['send-customer-sms','op-light-send-sms'];
Deno.test('SMS customer handlers load without starting servers',async()=>{await loadHandlers();assertEquals(handlers.size,2);});
Deno.test('SMS customer handlers reject inactive staff before reads or sends',()=>fixture(async s=>{s.active=false;for(const name of names)assertEquals((await call(name)).status,403);assertEquals(s.providerCalls,0);assertEquals(s.quota.length,0);}));
Deno.test('SMS customer handlers reject unrelated assigned roles',()=>fixture(async s=>{s.role='QM';for(const name of names)assertEquals((await call(name)).status,403);assertEquals(s.providerCalls,0);}));
Deno.test('SMS customer handlers reject missing company assignment',()=>fixture(async s=>{s.assigned=false;for(const name of names)assertEquals((await call(name)).status,403);assertEquals(s.providerCalls,0);}));
Deno.test('SMS customer handlers reject inaccessible parent records through caller RLS',()=>fixture(async s=>{s.visible=false;for(const name of names)assertEquals((await call(name)).status,404);assertEquals(s.providerCalls,0);assertEquals(s.quota.length,0);}));
Deno.test('SMS customer handlers reject foreign company sources',()=>fixture(async s=>{s.source='foreign-source';assertEquals((await call('send-customer-sms')).status,403);assertEquals((await call('op-light-send-sms')).status,404);assertEquals(s.providerCalls,0);}));
Deno.test('SMS document cannot be moved to another customer in the request',()=>fixture(async s=>{assertEquals((await call('send-customer-sms',{customer_id:tenant})).status,403);assertEquals(s.providerCalls,0);}));
Deno.test('SMS customer handlers deny alternative recipients without separate permission',()=>fixture(async s=>{s.role='Service';assertEquals((await call('send-customer-sms',{phone:'+491721234567',alternative_phone_confirmed:true,alternative_phone_reason:'Fixture'})).status,403);s.role='Finance';assertEquals((await call('op-light-send-sms',{to:'+491721234567',alternative_phone_confirmed:true,alternative_phone_reason:'Fixture'})).status,403);assertEquals(s.providerCalls,0);}));
Deno.test('SMS customer handlers require confirmation and reason even for administrators',()=>fixture(async s=>{for(const name of names){const recipient=name==='send-customer-sms'?{phone:'+491721234567'}:{to:'+491721234567'};assertEquals((await call(name,recipient)).status,400);assertEquals((await call(name,{...recipient,alternative_phone_confirmed:true})).status,400);}assertEquals(s.providerCalls,0);}));
Deno.test('SMS customer handlers share employee and normalized recipient quota across endpoints',()=>fixture(async s=>{for(const name of names)assertEquals((await call(name)).status,200);assertEquals(s.providerCalls,2);assertEquals(s.quota.length,2);assertEquals(s.quota[0],s.quota[1]);assertEquals(s.quota[0].p_user_id,staff);assertEquals(s.audits.length,4);}));
Deno.test('SMS customer handlers deny exhausted employee and recipient quota without sending',()=>fixture(async s=>{for(const scope of ['user','recipient']){s.limit={allowed:false,scope,retry_after_seconds:3600};for(const name of names){const r=await call(name);assertEquals(r.status,429);assertEquals(r.headers.get('Retry-After'),'3600');}}assertEquals(s.providerCalls,0);}));
Deno.test('SMS customer handlers fail closed on quota outage',()=>fixture(async s=>{s.limitFails=true;for(const name of names)assertEquals((await call(name)).status,503);assertEquals(s.providerCalls,0);}));
Deno.test('SMS customer handlers fail closed when intent cannot be recorded',()=>fixture(async s=>{s.intentFails=true;for(const name of names)assertEquals((await call(name)).status,503);assertEquals(s.providerCalls,0);assertEquals(s.quota.length,0);}));
Deno.test('SMS OP preview does not spend quota or send',()=>fixture(async s=>{const r=await call('op-light-send-sms',{preview:true});assertEquals(r.status,200);assertEquals(s.providerCalls,0);assertEquals(s.quota.length,0);assertEquals(s.audits.length,0);}));
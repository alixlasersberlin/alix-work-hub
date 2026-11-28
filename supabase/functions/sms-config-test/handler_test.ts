import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { handleSmsConfigTest } from './handler.ts';

type State = {active:boolean;role:string;tenants:boolean;auditFails:boolean;limit:unknown;limitFails:boolean;providerFails:boolean;calls:string[];audits:Record<string,unknown>[];reservation:Record<string,unknown>|null};
async function fixture(run:(s:State)=>Promise<void>) {
 const names=['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','TWILIO_ACCOUNT_SID','TWILIO_AUTH_TOKEN','TWILIO_SMS_FROM_NUMBER'];
 const before=names.map(n=>Deno.env.get(n));
 const values=['https://sms-fixture.example.test','fixture-public','fixture-service','fixture-account','fixture-token','FIXTURE'];
 names.forEach((n,i)=>Deno.env.set(n,values[i]));
 const oldFetch=globalThis.fetch;
 const state:State={active:true,role:'Admin',tenants:true,auditFails:false,limit:{allowed:true},limitFails:false,providerFails:false,calls:[],audits:[],reservation:null};
 globalThis.fetch=async(input,init)=>{
  const url=new URL(String(input instanceof Request?input.url:input)); state.calls.push(url.pathname);
  const json=(d:unknown,status=200)=>new Response(JSON.stringify(d),{status,headers:{'Content-Type':'application/json'}});
  if(url.hostname==='api.twilio.com') {
   if(state.providerFails) throw new Error('fixture unknown provider result');
   return json({sid:'SM-fixture',status:'queued',private_fixture:'must-not-return'});
  }
  assertEquals(url.hostname,'sms-fixture.example.test');
  if(url.pathname.endsWith('/auth/v1/user')) return json({id:'11111111-1111-4111-8111-111111111111'});
  if(url.pathname.endsWith('/user_profiles')) return json({is_active:state.active,account_status:state.active?'active':'disabled',invitation_status:'accepted',password_reset_required:false});
  if(url.pathname.endsWith('/user_roles')) return json([{roles:{name:state.role}}]);
  if(url.pathname.endsWith('/user_tenant_access')) return json(state.tenants?[{tenant_id:'22222222-2222-4222-8222-222222222222'}]:[]);
  if(url.pathname.endsWith('/tenants')) return json([{id:'22222222-2222-4222-8222-222222222222',zoho_source_system:'fixture-source'}]);
  if(url.pathname.endsWith('/rpc/sms_effective_config')) return json({account_sid:'fixture-account',auth_token:'fixture-token',from_number:'FIXTURE'});
  if(url.pathname.endsWith('/rpc/sms_reserve_send')) {state.reservation=JSON.parse(String(init?.body));return state.limitFails?json({message:'offline'},503):json(state.limit);}
  if(url.pathname.endsWith('/audit_logs')) {state.audits.push(JSON.parse(String(init?.body)));return state.auditFails?json({message:'offline'},503):new Response(null,{status:201});}
  throw new Error('Unexpected fixture request');
 };
 try{await run(state);}finally{globalThis.fetch=oldFetch;names.forEach((n,i)=>before[i]===undefined?Deno.env.delete(n):Deno.env.set(n,String(before[i])));}
}
const req=(body:unknown,auth='Bearer fixture-session')=>new Request('https://sms.example.test',{method:'POST',headers:{Authorization:auth,'Content-Type':'application/json'},body:JSON.stringify(body)});
const input={action:'test',phone:'01711234567',text:'Isolierter Test'};
const providerCount=(s:State)=>s.calls.filter(p=>p.endsWith('/Messages.json')).length;
Deno.test('SMS admin test rejects missing identity before any request',()=>fixture(async s=>{assertEquals((await handleSmsConfigTest(req(input,''))).status,401);assertEquals(s.calls.length,0);}));
Deno.test('SMS admin test rejects public and service caller tokens',()=>fixture(async s=>{for(const key of ['fixture-public','fixture-service']) assertEquals((await handleSmsConfigTest(req(input,`Bearer ${key}`))).status,401);assertEquals(s.calls.length,0);}));
Deno.test('SMS admin test rejects inactive accounts',()=>fixture(async s=>{s.active=false;assertEquals((await handleSmsConfigTest(req(input))).status,403);assertEquals(providerCount(s),0);}));
Deno.test('SMS admin test rejects ordinary finance roles',()=>fixture(async s=>{s.role='Finance';assertEquals((await handleSmsConfigTest(req(input))).status,403);assertEquals(providerCount(s),0);}));
Deno.test('SMS admin test rejects absent tenant assignments',()=>fixture(async s=>{s.tenants=false;assertEquals((await handleSmsConfigTest(req(input))).status,403);assertEquals(providerCount(s),0);}));
Deno.test('SMS admin test status neither reserves nor sends nor returns tokens',()=>fixture(async s=>{const r=await handleSmsConfigTest(req({action:'status'}));assertEquals(r.status,200);const body=await r.text();assert(!body.includes('fixture-token'));assertEquals(s.reservation,null);assertEquals(providerCount(s),0);assertEquals(s.audits.length,0);}));
Deno.test('SMS admin test validates recipient and bounds text before configuration',()=>fixture(async s=>{for(const body of [{...input,phone:'ALIXLASERS'},{...input,text:'x'.repeat(601)},{...input,text:''}]) assertEquals((await handleSmsConfigTest(req(body))).status,400);assertEquals(providerCount(s),0);assertEquals(s.reservation,null);}));
Deno.test('SMS admin test cannot bypass shared recipient quota',()=>fixture(async s=>{s.limit={allowed:false,scope:'recipient',retry_after_seconds:3600};const r=await handleSmsConfigTest(req(input));assertEquals(r.status,429);assertEquals(r.headers.get('Retry-After'),'3600');assertEquals(providerCount(s),0);assertEquals(s.audits.length,1);}));
Deno.test('SMS admin test fails closed on quota and audit outages',()=>fixture(async s=>{s.limitFails=true;assertEquals((await handleSmsConfigTest(req(input))).status,503);s.limitFails=false;s.auditFails=true;assertEquals((await handleSmsConfigTest(req(input))).status,503);assertEquals(providerCount(s),0);}));
Deno.test('SMS admin test uses verified caller quota and logs a simulated send',()=>fixture(async s=>{const r=await handleSmsConfigTest(req({...input,user_id:'attacker-selected-id'}));assertEquals(r.status,200);assertEquals(providerCount(s),1);assertEquals(s.reservation?.p_user_id,'11111111-1111-4111-8111-111111111111');assertEquals(s.audits.length,2);const body=await r.text();assert(!body.includes('must-not-return'));assert(!body.includes('fixture-token'));}));
Deno.test('SMS admin test never retries an uncertain provider send',()=>fixture(async s=>{s.providerFails=true;const r=await handleSmsConfigTest(req(input));assertEquals(r.status,502);assertEquals(providerCount(s),1);assertEquals(s.audits.length,2);const details=s.audits[1].details as Record<string,unknown>;assertEquals(details.status,'unconfirmed');}));

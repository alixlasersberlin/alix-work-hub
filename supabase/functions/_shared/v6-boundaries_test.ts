import {assertEquals} from 'https://deno.land/std@0.224.0/assert/mod.ts';
type Handler=(req:Request)=>Response|Promise<Response>;
const functions=['zoho-invoices-auto-import','ticket-ai-assist','sync-to-alixsmart','mobile-voice-transcribe','finance-ai-analyze','finance-tax-export','sig-ai-analyze','finance-approval-action','alix-copilot','op-light-send-sms','send-customer-sms','alixsmart-match-run','ac-journey-run'];
const uuid='11111111-1111-4111-8111-111111111111';
const foreign='22222222-2222-4222-8222-222222222222';
const handlers=new Map<string,Handler>();
async function loadHandlers(){
  Deno.env.set('SUPABASE_URL','https://v6.example.test');
  Deno.env.set('SUPABASE_ANON_KEY','v6-public');Deno.env.set('SUPABASE_SERVICE_ROLE_KEY','v6-private');
  Deno.env.set('CRON_SECRET','v6-cron');Deno.env.set('LOVABLE_API_KEY','v6-ai-fixture');
  const original=Deno.serve;
  let captured:Handler|undefined;
  Deno.serve=((handler:Handler)=>{captured=handler;return {finished:Promise.resolve()};}) as unknown as typeof Deno.serve;
  try{
    for(const name of functions){captured=undefined;await import(`../${name}/index.ts`);if(!captured) throw new Error(`Missing handler ${name}`);handlers.set(name,captured);}
  }finally{Deno.serve=original;}
}
const request=(body:unknown,authorization?:string)=>new Request('https://v6.example.test/functions/v1/test',{method:'POST',headers:{'Content-Type':'application/json',...(authorization?{Authorization:`Bearer ${authorization}`}:{})},body:JSON.stringify(body)});
function fixtureFetch(active=true,roles=['Finance'],ticketVisible=false){
  const calls:{url:string;authorization:string;method:string}[]=[];
  const fetcher:typeof fetch=async(input,init)=>{
    const req=input instanceof Request?input: new Request(input,init);
    const url=new URL(req.url);calls.push({url:req.url,authorization:req.headers.get('Authorization')??'',method:req.method});
    const j=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
    if(url.pathname==='/auth/v1/user') return j({id:uuid});
    if(url.pathname.endsWith('/user_profiles')) return j({is_active:active,account_status:active?'active':'disabled',invitation_status:'accepted',password_reset_required:false});
    if(url.pathname.endsWith('/user_roles'))return j(roles.map(name=>({roles:{name}})));
    if(url.pathname.endsWith('/user_tenant_access'))return j([{tenant_id:uuid}]);
    if(url.pathname.endsWith('/tenants'))return j([{id:uuid,code:'DE',zoho_source_system:'zoho_eu_1'}]);
    // Every business read must carry the verified caller, never the private machine key.
    if(url.pathname.startsWith('/rest/v1/') && req.headers.get('Authorization')!=='Bearer v6-staff')throw new Error('Business request used private privileges');
    if(url.pathname.endsWith('/tickets')) return j(ticketVisible?{id:uuid,external_ticket_id:uuid,source_system:'alixsmart',status:'offen'}:null);
    if(url.pathname.endsWith('/ticket_messages')){
      assertEquals(url.searchParams.get('ticket_id'),`eq.${uuid}`);
      return j(null);
    }
    if(url.pathname.endsWith('/order_documents')||url.pathname.endsWith('/sig_documents'))return j(null);
    throw new Error('Unexpected business/provider action');
  };
  return {fetcher,calls};
}
Deno.test('V6 interactive endpoints reject missing identity before business/provider work',async()=>{
  await loadHandlers();const original=globalThis.fetch;
  globalThis.fetch=()=>{throw new Error('Unauthenticated request reached a network action');};
  try{for(const name of functions){const handler=handlers.get(name);if(!handler)throw new Error(name);assertEquals((await handler(request({}))).status,401,name);}}
  finally{globalThis.fetch=original;}
});
Deno.test('Inactive authenticated staff cannot use corrected interactive endpoints',async()=>{
  const original=globalThis.fetch;const fixture=fixtureFetch(false,['Admin']);globalThis.fetch=fixture.fetcher;
  try{for(const name of functions){const handler=handlers.get(name);if(!handler)throw new Error(name);assertEquals((await handler(request({},'v6-staff'))).status,403,name);}}
  finally{globalThis.fetch=original;}
});
Deno.test('Unassigned finance company is rejected before AI, export or invoice import',async()=>{
  const original=globalThis.fetch;const fixture=fixtureFetch(true,['Admin','Finance']);globalThis.fetch=fixture.fetcher;
  try{
    const inputs:{name:string;body:unknown}[]=[
      {name:'finance-ai-analyze',body:{tenant_id:foreign,kpis:{}}},
      {name:'finance-tax-export',body:{tenant_id:foreign,filing_type:'ustva',period_value:'2026-11'}},
      {name:'zoho-invoices-auto-import',body:{sources:['zoho_eu_2'],dry_run:true}},
      {name:'alix-copilot',body:{messages:[{role:'user',content:'Kennzahlen'}],tenantSources:['zoho_eu_2']}},
    ];
    for(const {name,body} of inputs){const handler=handlers.get(name);if(!handler)throw new Error(name);assertEquals((await handler(request(body,'v6-staff'))).status,403,name);}
    assertEquals(fixture.calls.filter(c=>!['/auth/v1/user','/rest/v1/user_profiles','/rest/v1/user_roles','/rest/v1/user_tenant_access','/rest/v1/tenants'].includes(new URL(c.url).pathname)).length,0);
  }finally{globalThis.fetch=original;}
});
Deno.test('Inaccessible tickets cannot be read by AI or synchronized externally',async()=>{
  const original=globalThis.fetch;const fixture=fixtureFetch();globalThis.fetch=fixture.fetcher;
  try{for(const name of ['ticket-ai-assist','sync-to-alixsmart']){const handler=handlers.get(name);if(!handler)throw new Error(name);assertEquals((await handler(request({ticket_id:foreign},'v6-staff'))).status,404);}}
  finally{globalThis.fetch=original;}
});
Deno.test('CRM sync binds a selected message to the authorized ticket',async()=>{
  const original=globalThis.fetch;const fixture=fixtureFetch(true,['Finance'],true);globalThis.fetch=fixture.fetcher;
  try{const handler=handlers.get('sync-to-alixsmart');if(!handler)throw new Error('Missing handler');assertEquals((await handler(request({ticket_id:uuid,message_id:foreign},'v6-staff'))).status,403);}
  finally{globalThis.fetch=original;}
});
Deno.test('Supplied contract text cannot bypass document authorization',async()=>{
  const original=globalThis.fetch;const fixture=fixtureFetch();globalThis.fetch=fixture.fetcher;
  try{const handler=handlers.get('sig-ai-analyze');if(!handler)throw new Error('Missing handler');assertEquals((await handler(request({document_id:foreign,text_content:'Text'},'v6-staff'))).status,404);}
  finally{globalThis.fetch=original;}
});
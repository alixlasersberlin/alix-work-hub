import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

type Handler = (request: Request) => Promise<Response>;
let handle: Handler | undefined;
async function loadHandler() {
  if (handle) return handle;
  const original = Deno.serve;
  Deno.serve = ((callback: Handler) => {
    handle = callback;
    return { finished: Promise.resolve() };
  }) as unknown as typeof Deno.serve;
  try { await import('./index.ts'); } finally { Deno.serve = original; }
  if (!handle) throw new Error('Handler not registered');
  return handle;
}

type State = { active: boolean; role: string; assigned: boolean; searchError: boolean; visible: boolean; providerError: boolean; searches: number; prompts: string[] };
async function fixture(run: (state: State, handler: Handler) => Promise<void>) {
  const handler = await loadHandler();
  const names = ['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','LOVABLE_API_KEY'];
  const before = names.map(name => Deno.env.get(name));
  ['https://documents.example.test','fixture-public','fixture-service','fixture-ai'].forEach((value, i) => Deno.env.set(names[i], value));
  const state: State = {active:true, role:'Admin', assigned:true, searchError:false, visible:true, providerError:false, searches:0, prompts:[]};
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const json = (data: unknown, status=200) => new Response(JSON.stringify(data), {status, headers:{'Content-Type':'application/json'}});
    if (url.hostname === 'ai.gateway.lovable.dev') {
      state.prompts.push(await request.text());
      return state.providerError ? json({secret_provider_detail:'must-not-return'},500) : json({choices:[{message:{content:'Antwort [1]'}}]});
    }
    assertEquals(url.hostname, 'documents.example.test');
    if (url.pathname.endsWith('/auth/v1/user')) return json({id:'11111111-1111-4111-8111-111111111111'});
    if (url.pathname.endsWith('/user_profiles')) return json({is_active:state.active,account_status:state.active?'active':'disabled',invitation_status:'accepted',password_reset_required:false});
    if (url.pathname.endsWith('/user_roles')) return json([{roles:{name:state.role}}]);
    if (url.pathname.endsWith('/user_tenant_access')) return json(state.assigned?[{tenant_id:'22222222-2222-4222-8222-222222222222'}]:[]);
    if (url.pathname.endsWith('/tenants')) return json([{id:'22222222-2222-4222-8222-222222222222',code:'fixture'}]);
    if (url.pathname.endsWith('/rpc/alixdocs2_fts_search')) {
      state.searches++;
      assertEquals(request.headers.get('Authorization'),'Bearer fixture-session');
      assertEquals((await request.json())._limit,12);
      return state.searchError ? json({message:'private database detail'},500) : json(state.visible?[{id:'document-visible',title:'Berechtigtes Dokument',snippet:'Nur sichtbarer Kontext'}]:[]);
    }
    throw new Error('Unexpected fixture request');
  };
  try { await run(state, handler); }
  finally { globalThis.fetch = previousFetch; names.forEach((name,i) => before[i]===undefined?Deno.env.delete(name):Deno.env.set(name,String(before[i]))); }
}
const request = (question: unknown='Frage', token='fixture-session') => new Request('https://documents.example.test/search',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({question})});

Deno.test('Document AI rejects public and service tokens without document reads', () => fixture(async (s,h) => {
  for (const token of ['fixture-public','fixture-service','']) assertEquals((await h(request('Frage',token))).status,401);
  assertEquals(s.searches,0); assertEquals(s.prompts.length,0);
}));
Deno.test('Document AI rejects inactive accounts before reading context', () => fixture(async (s,h) => {
  s.active=false; assertEquals((await h(request())).status,403); assertEquals(s.searches,0);
}));
Deno.test('Document AI requires an assigned administrator role', () => fixture(async (s,h) => {
  s.role='Finance'; assertEquals((await h(request())).status,403); assertEquals(s.searches,0);
}));
Deno.test('Document AI rejects missing active company membership', () => fixture(async (s,h) => {
  s.assigned=false; assertEquals((await h(request())).status,403); assertEquals(s.searches,0);
}));
Deno.test('Document AI bounds questions before search and billing', () => fixture(async (s,h) => {
  for (const question of [null,{},'', 'x'.repeat(4001)]) assertEquals((await h(request(question))).status,400);
  assertEquals(s.searches,0); assertEquals(s.prompts.length,0);
}));
Deno.test('Document AI reads only caller-scoped sources and preserves their identity', () => fixture(async (s,h) => {
  const response = await h(request()); assertEquals(response.status,200);
  const result = await response.json(); assertEquals(result.sources[0].id,'document-visible');
  assertEquals(s.searches,1); assertEquals(s.prompts.length,1); assert(s.prompts[0].includes('Nur sichtbarer Kontext'));
}));
Deno.test('Document AI does not call a provider for invisible records or database failures', () => fixture(async (s,h) => {
  s.visible=false; assertEquals((await h(request())).status,200);
  s.searchError=true; const response=await h(request()); assertEquals(response.status,503);
  assert(!(await response.text()).includes('private database detail')); assertEquals(s.prompts.length,0);
}));
Deno.test('Document AI never exposes raw provider errors or retries an uncertain call', () => fixture(async (s,h) => {
  s.providerError=true; const response=await h(request()); assertEquals(response.status,502);
  assert(!(await response.text()).includes('must-not-return')); assertEquals(s.prompts.length,1);
}));
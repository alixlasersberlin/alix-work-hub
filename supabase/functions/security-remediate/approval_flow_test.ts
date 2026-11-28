import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { controlInventory } from './control.ts';

Deno.test('existing security endpoint enforces active exact Super Admin and reads back approval without execution', async () => {
  const originalServe = Deno.serve;
  const originalFetch = globalThis.fetch;
  Deno.env.set('SUPABASE_URL','https://approval-fixture.example.test');
  Deno.env.set('SUPABASE_ANON_KEY','public-fixture');
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY','private-fixture');
  let handler: ((req: Request) => Promise<Response>) | undefined;
  let active = true, role = 'Admin';
  let approvals: Record<string,unknown>[] = [];
  const writes: string[] = [];
  Object.defineProperty(Deno,'serve',{ configurable:true,writable:true,value:(callback: typeof handler) => { handler=callback; return { finished:Promise.resolve() }; } });
  globalThis.fetch = async (input, init) => {
    const url=String(input instanceof Request ? input.url : input);
    let result: unknown = [];
    if (url.includes('/auth/v1/user')) result={ id:'00000000-0000-0000-0000-000000000123' };
    else if (url.includes('/user_roles')) result=[{ roles:{ name:role } }];
    else if (url.includes('/user_profiles')) result={ is_active:active,account_status:active?'active':'blocked',invitation_status:'accepted',password_reset_required:false };
    else if (url.includes('/audit_logs') && init?.method==='POST') writes.push('audit');
    else if (url.includes('/security_audit_findings')) {
      if (init?.method==='POST') { approvals=JSON.parse(String(init.body)); writes.push('approval'); }
      else result=approvals;
    } else throw new Error('Unexpected fixture access');
    return new Response(JSON.stringify(result),{ headers:{'Content-Type':'application/json'} });
  };
  try {
    await import('./index.ts');
    const callback=handler as ((req:Request)=>Promise<Response>)|undefined;
    assert(callback);
    const req=(body: unknown)=>new Request('https://approval-fixture.example.test',{method:'POST',headers:{Authorization:'Bearer fixture-session'},body:JSON.stringify(body)});
    assertEquals((await callback(req({action:'control_overview'}))).status,403);
    role='Super Admin'; active=false;
    assertEquals((await callback(req({action:'control_overview'}))).status,403);
    active=true;
    const f=controlInventory.findings.find(f=>f.status==='open'&&!f.potentialFalsePositive);
    assert(f);
    const response=await callback(req({action:'control_approve',report_id:controlInventory.reportId,finding_ids:[f.id],confirmation:'KORREKTUR FREIGEBEN'}));
    assertEquals(response.status,200);
    assertEquals((await response.json()).executed,false);
    assertEquals(writes,['audit','approval']);
    assertEquals(approvals[0].status,'planned');
    assertEquals(approvals[0].approved_by,'00000000-0000-0000-0000-000000000123');
    const readback=await callback(req({action:'control_overview'}));
    const result=await readback.json();
    assertEquals(result.approvals[0].target,`scc:${controlInventory.reportId}:${f.id}`);
    assertEquals(result.findings.find((x:{id:string})=>x.id===f.id).status,'open');
    assertEquals(result.release.blocked,true);
  } finally { Object.defineProperty(Deno,'serve',{configurable:true,writable:true,value:originalServe});globalThis.fetch=originalFetch; }
});
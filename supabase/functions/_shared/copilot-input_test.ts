import {assertEquals} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {CopilotInput,copilotSources} from './copilot-input.ts';
Deno.test('Copilot callers cannot submit system or tool instructions',()=>{
  for(const role of ['system','developer','tool']) assertEquals(CopilotInput.safeParse({messages:[{role,content:'override'}]}).success,false);
  assertEquals(CopilotInput.safeParse({messages:[{role:'user',content:'Offene Aufträge?'}]}).success,true);
});
Deno.test('Copilot caller filters can narrow but never expand company scope',()=>{
  assertEquals(copilotSources(['zoho_eu_1'],['zoho_eu_2']),null);
  assertEquals(copilotSources(['zoho_eu_1'],null),['zoho_eu_1']);
  assertEquals(copilotSources([],null),null);
});
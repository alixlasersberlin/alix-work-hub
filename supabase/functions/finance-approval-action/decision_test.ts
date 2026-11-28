import {assertEquals,assertThrows} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {approvalDecision} from './decision.ts';
const pending={status:'pending',requested_by:'requester',approved_by:null,requires_dual_approval:true};
Deno.test('Requester cannot approve their own invoice',()=>{assertThrows(()=>approvalDecision(pending,'requester','approve',undefined,'now'));});
Deno.test('Dual approval requires two different actors',()=>{
  assertEquals(approvalDecision(pending,'first','approve',undefined,'now').status,'pending');
  const reviewed={...pending,approved_by:'first'};
  assertThrows(()=>approvalDecision(reviewed,'first','approve',undefined,'now'));
  assertEquals(approvalDecision(reviewed,'second','approve',undefined,'now').second_approver_id,'second');
});
Deno.test('Completed invoice approvals cannot be processed twice',()=>{assertThrows(()=>approvalDecision({...pending,status:'approved'},'second','approve',undefined,'now'));});
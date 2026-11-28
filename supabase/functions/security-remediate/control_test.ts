import { assert, assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { correctionProposal, controlInventory, approvalIdentity } from './control.ts';
Deno.test('inventory preserves historical 188 findings and current 474 scan records separately from 493 database hints', () => {
  assertEquals(controlInventory.sourceCounts.historicalDeepOpen, 188);
  assertEquals(controlInventory.findings.filter(f => f.source === 'agent_security_v2' && f.status === 'open').length, 474);
  assertEquals(controlInventory.findings.filter(f => f.source === 'supabase_linter').length, 493);
  assertEquals(controlInventory.findings.filter(f => f.status === 'resolved').length, 25);
  assertEquals(controlInventory.deduplicationComplete, false);
  assertEquals(controlInventory.scanStatus, 'incomplete');
  assertEquals(controlInventory.audit.complete, false);
});
Deno.test('correction approval rejects unknown identities and stale report revisions', () => {
  assertThrows(() => correctionProposal('stale', ['unknown']));
  assertThrows(() => correctionProposal(controlInventory.reportId, ['unknown']));
});
Deno.test('approval cannot include already fixed findings or unreviewed false positives', () => {
  for (const f of controlInventory.findings.filter(f => f.status === 'resolved' || f.potentialFalsePositive).slice(0, 5)) {
    assertThrows(() => correctionProposal(controlInventory.reportId, [f.id]));
  }
});
Deno.test('targeted approval never changes the finding or opens production', () => {
  const f = controlInventory.findings.find(f => f.status === 'open' && !f.potentialFalsePositive);
  assert(f);
  assertEquals(correctionProposal(controlInventory.reportId, [f.id])[0].status, 'open');
  assertEquals(controlInventory.release.blocked, true);
});
Deno.test('unrelated components cannot be approved as a correction package', () => {
  const a = controlInventory.findings.find(f => f.status === 'open' && !f.potentialFalsePositive);
  assert(a);
  const b = controlInventory.findings.find(f => f.status === 'open' && !f.potentialFalsePositive && f.component !== a.component);
  assert(b);
  assertThrows(() => correctionProposal(controlInventory.reportId, [a.id,b.id]));
});
Deno.test('approval identity is stable and bound to report version', async () => {
  assertEquals(await approvalIdentity('v1','item'), await approvalIdentity('v1','item'));
  assert(await approvalIdentity('v1','item') !== await approvalIdentity('v2','item'));
});
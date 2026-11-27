import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { channelAllowed, operatingAllowed, revisionMatches, type OperatingGate } from './ph-operating-mode.ts';
const gate: OperatingGate = { enabled: true, backup_verified: true, restore_verified: true, communication_verified: true, approved_by: 'super-admin', emergency_stopped: false, channels: { de: { mode: 'pilot', pilot_product_id: 'one' }, com: { mode: 'blocked' } } };
Deno.test('pilot transmits exactly the selected device', () => {
 assertEquals(operatingAllowed('true', gate, 'de', 'one'), true);
 assertEquals(operatingAllowed('true', gate, 'de', 'two'), false);
});
Deno.test('COM stays excluded when DE pilot is released', () => assertEquals(operatingAllowed('true', gate, 'com', 'one'), false));
Deno.test('emergency stop overrides both modes', () => {
 const full = { ...gate, emergency_stopped: true, channels: { de: { mode: 'full' as const }, com: { mode: 'full' as const } } };
 for (const ch of ['de', 'com']) assertEquals(operatingAllowed('true', full, ch, 'one'), false);
});
Deno.test('acceptance cannot release without explicit global flag', () => assertEquals(operatingAllowed('false', gate, 'de', 'one'), false));
Deno.test('backup restore and communication prerequisites are not weakened', () => {
 for (const k of ['backup_verified','restore_verified','communication_verified','enabled','approved_by']) assertEquals(operatingAllowed('true', { ...gate, [k]: false }, 'de', 'one'), false);
});
Deno.test('unknown scope and US always fail closed', () => {
 for (const ch of ['us','usa','global','DE','dubai']) assertEquals(channelAllowed(gate, ch, 'one'), false);
 assertEquals(channelAllowed(null,'de','one'),false);
 assertEquals(channelAllowed({...gate, emergency_stopped:undefined},'de','one'),false);
});
Deno.test('full mode only affects its explicitly released website', () => {
 const full = { ...gate, channels: { de: { mode: 'full' as const }, com: { mode: 'blocked' as const } } };
 assertEquals(operatingAllowed('true', full, 'de', 'two'), true);
 assertEquals(operatingAllowed('true', full, 'com', 'two'), false);
});

Deno.test("old and unversioned events cannot resume after stop or mode change", () => {
 assertEquals(revisionMatches({...gate, revision:2}, 2), true);
 assertEquals(revisionMatches({...gate, revision:2}, 1), false);
 assertEquals(revisionMatches({...gate, revision:2}, undefined), false);
});

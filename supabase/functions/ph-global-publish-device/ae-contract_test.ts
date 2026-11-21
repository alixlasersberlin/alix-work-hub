import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { aeEndpoint, aeRequest, aeStateAllowed, confirmedAE, type AEAction } from './ae-contract.ts';
const ids = { hub_id: 'hub', product_id: 'ae-id', channel: 'dubai' };
Deno.test('AE uses fixed host, independent operation/version and explicit reactivation authority', () => {
  assertEquals(aeEndpoint, 'https://alix-lasers.ae/api/public/product-hub/direct-release');
  const off = aeRequest('deactivate', 'op', 'hub', 'ae-id', 'previous', 'actor');
  assertEquals(off.source_version, 'ae:op'); assertEquals(off.expected_version, 'previous');
  assertEquals('content' in off, false); assertEquals('price' in off, false);
  const on = aeRequest('reactivate', 'on', 'hub', 'ae-id', off.source_version, 'actor');
  assertEquals(on.approval.reactivate, true);
  assertEquals(on.channel, 'dubai');
});
Deno.test('AE requires exact per-action proof; dry runs and foreign URLs never count as completion', () => {
  for (const action of ['publish', 'deactivate', 'reactivate'] as AEAction[]) {
    const req = aeRequest(action, 'op', 'hub', 'ae-id', null, 'actor');
    const identity = { ...ids, source_version: req.source_version, ...(action === 'publish' ? { publish_id: 'op' } : { operation_id: 'op' }) };
    const preview = { ok: true, ...identity, dry_run: true, online: false, offline: false, status: action === 'publish' ? 'WRITE_READY' : action === 'deactivate' ? 'OFFLINE_READY' : 'REACTIVATE_READY' };
    assertEquals(confirmedAE(preview, req, true), true); assertEquals(confirmedAE(preview, req, false), false);
    const urls = ['https://alix-lasers.ae/systems/hifu-pro', 'https://alix-lasers.ae/ar/systems/hifu-pro'];
    const receipt = { ok: true, ...identity, online: action !== 'deactivate', offline: action === 'deactivate', status: action === 'deactivate' ? 'OFFLINE' : 'ONLINE', public_urls: urls, public_url: urls[0] };
    assertEquals(confirmedAE(receipt, req, false), true);
    for (const patch of [{ channel: 'de' }, { product_id: 'com-id' }, { hub_id: 'other' }, { source_version: 'old' }, { public_urls: ['https://alix-lasers.ae.evil/systems/hifu-pro', urls[1]] }, { public_urls: [urls[0]] }]) assertEquals(confirmedAE({ ...receipt, ...patch }, req, false), false);
  }
});
Deno.test('AE offline locks require explicit reactivation; uncertainty denies every action', () => {
  const product = { active_dubai: true, status: 'published', alix_product_id: 'hub' };
  const row = { hold: false, remote_snapshot: { ae_direct: { ...ids, ok: true, offline: true, status: 'OFFLINE' } } };
  assertThrows(() => aeStateAllowed(product, row, 'publish'));
  aeStateAllowed(product, row, 'reactivate');
  for (const action of ['publish', 'deactivate', 'reactivate'] as AEAction[]) assertThrows(() => aeStateAllowed(product, { ...row, remote_snapshot: { ...row.remote_snapshot, ae_pending: {} } }, action));
});
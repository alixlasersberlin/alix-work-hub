import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { beautyEndpoint, confirmedBeautyOffline } from './beauty-contract.ts';
const request = { hub_id: 'ALIX-G15-PRO', channel: 'beautyco', version: '2026-11-21T04:56:00.123456+00:00', operation_id: 'operation' };
const reply = { ...request, ok: true, offline: true, online: false, dry_run: false, state: 'OFFLINE', verification: { public_url: 'https://alix-beauty.com/beauty-geraete/alix-g15-pro', detail_status: 404, catalog_visible: false, search_visible: false } };
Deno.test('Beauty verwendet ausschließlich eigenen festen Abschaltempfänger', () => {
  assertEquals(beautyEndpoint, 'https://alix-beauty.com/api/public/product-hub/deactivate');
});
Deno.test('Beauty verlangt unveränderte Kennungen samt Mikrosekunden', () => {
  assertEquals(confirmedBeautyOffline(reply, request, false), true);
  for (const field of ['hub_id', 'channel', 'version', 'operation_id']) assertEquals(confirmedBeautyOffline({ ...reply, [field]: 'wrong' }, request, false), false);
});
Deno.test('Beauty Probelauf ist kein Abschaltnachweis', () => {
  const preview = { ...request, ok: true, offline: false, state: 'validated' };
  assertEquals(confirmedBeautyOffline(preview, request, true), true);
  assertEquals(confirmedBeautyOffline(preview, request, false), false);
});
Deno.test('Beauty benötigt öffentliche Unsichtbarkeit auf der echten Domain', () => {
  for (const verification of [{ ...reply.verification, detail_status: 200 }, { ...reply.verification, catalog_visible: true }, { ...reply.verification, search_visible: true }, { ...reply.verification, public_url: 'https://evil.example/beauty-geraete/g15' }]) assertEquals(confirmedBeautyOffline({ ...reply, verification }, request, false), false);
});
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { confirmedOffline, offlineReason } from './offline-contract.ts';
const request = { operation_id: 'operation', hub_id: 'hub', product_id: 'device', channel: 'de', source_version: 'offline:operation' };
const reply = { ...request, ok: true, offline: true, status: 'OFFLINE', public_urls: ['https://alix-lasers.de/produkte/hifu-pro'] };
Deno.test('Abschaltung benötigt keine Texte, Bilder, Übersetzung oder Preise', () => {
  assertEquals(offlineReason({ active_de: false }, 'de', false), 'inactive');
  assertEquals(offlineReason({ active_com: true }, 'com', true), 'withheld');
  assertEquals(offlineReason({ active_de: true }, 'de', false), null);
});
Deno.test('Probelauf ist niemals ein OFFLINE-Nachweis', () => {
  const preview = { ...reply, status: 'OFFLINE_READY', offline: false, dry_run: true };
  assertEquals(confirmedOffline(preview, request, true), true);
  assertEquals(confirmedOffline(preview, request, false), false);
  assertEquals(confirmedOffline(reply, request, false), true);
});
Deno.test('Abschaltnachweis muss Vorgang, Geräte, Kanal und Version bestätigen', () => {
  for (const field of ['operation_id', 'hub_id', 'product_id', 'channel', 'source_version']) assertEquals(confirmedOffline({ ...reply, [field]: 'other' }, request, false), false);
  assertEquals(confirmedOffline({ ...reply, offline: false }, request, false), false);
  assertEquals(confirmedOffline({ ...reply, status: 'APPLIED' }, request, false), false);
});
Deno.test('Abschaltbelege dürfen keine fremden Hosts oder leeren URLs enthalten', () => {
  for (const urls of [[], ['https://evil.example/'], ['https://alix-lasers.de.evil.example/'], ['https://user:pass@alix-lasers.de/'], ['https://www.alix-lasers.com/devices/hifu']]) assertEquals(confirmedOffline({ ...reply, public_urls: urls }, request, false), false);
});
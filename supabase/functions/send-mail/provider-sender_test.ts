import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { providerSender, ORDER_SERVICE_ROLES } from './provider-sender.ts';

Deno.test('alix-lasers.com bleibt echter Versandabsender statt noreply-Fallback', () => {
  assertEquals(providerSender('service@alix-lasers.com'), 'Alix Lasers ® <service@alix-lasers.com>');
});
Deno.test('unbekannte Absender werden nicht für alix-lasers.com freigegeben', () => {
  assertEquals(providerSender('other@alix-lasers.com'), 'Alix Lasers ® <noreply@alixwork.de>');
});
Deno.test('Auftragsabsender erlaubt Order und Vertrieb, aber nicht Read Only', () => {
  assertEquals(ORDER_SERVICE_ROLES.includes('Order'), true);
  assertEquals(ORDER_SERVICE_ROLES.includes('Vertrieb'), true);
  assertEquals(ORDER_SERVICE_ROLES.includes('Read Only'), false);
});
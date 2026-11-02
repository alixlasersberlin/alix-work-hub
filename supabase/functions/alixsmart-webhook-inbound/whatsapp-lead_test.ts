import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { detectProduct, recommendedPriority, verifyTimestampedSignature, WhatsAppLeadEvent } from './whatsapp-lead.ts';

Deno.test('Kauf-, Preis-, Finanzierungs- und Lieferterminanfragen haben hohe Empfehlung', () => {
  for (const text of ['Ich möchte kaufen', 'Was kostet das Gerät?', 'Finanzierung möglich?', 'Welcher Liefertermin?']) assertEquals(recommendedPriority(text), 'Hoch');
});
Deno.test('Produktinteresse und Beratung haben mittlere Empfehlung', () => {
  assertEquals(recommendedPriority('Ich habe Interesse und wünsche Beratung'), 'Normal');
});
Deno.test('Unverbindliche Nachricht hat niedrige Empfehlung', () => assertEquals(recommendedPriority('Hallo'), 'Niedrig'));
Deno.test('Produkte nur bei eindeutiger Katalogzuordnung', () => {
  const catalog = [{ id: '1', name: 'ALIX BlueIce' }, { id: '2', name: 'ALIX Shark' }];
  assertEquals(detectProduct('Infos zu ALIX BlueIce?', catalog), 'ALIX BlueIce');
  assertEquals(detectProduct('ALIX BlueIce und ALIX Shark', catalog), undefined);
  assertEquals(detectProduct('ALIX unbekannt', catalog), undefined);
});
Deno.test('Nachricht benötigt Kontakt-, Konversations-, Nachrichten-ID und internationalen Telefonwert', () => {
  const event = { event: 'sales.whatsapp.inbound', event_id: 'e1', source: 'alixsmart', version: 1, occurred_at: '2026-11-02T18:00:00Z', data: { tenant_id: '00000000-0000-4000-8000-000000000001', contact_id: 'c', conversation_id: 'v', message_id: 'm', phone: '+49123456789', text: 'Hallo', area: 'sales', direction: 'inbound', relevance: 'sales' } };
  assertEquals(WhatsAppLeadEvent.safeParse(event).success, true);
  assertEquals(WhatsAppLeadEvent.safeParse({ ...event, data: { ...event.data, message_id: '' } }).success, false);
  assertEquals(WhatsAppLeadEvent.safeParse({ ...event, data: { ...event.data, phone: '0123456789' } }).success, false);
});
Deno.test('Ohne frischen Zeitstempel kein automatischer Lead', async () => {
  assertEquals(await verifyTimestampedSignature('{}', 'sha256=abc', null, 'test'), false);
  assertEquals(await verifyTimestampedSignature('{}', 'sha256=abc', '1', 'test', 1000000), false);
});
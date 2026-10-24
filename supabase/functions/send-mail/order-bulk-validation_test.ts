import { bulkOrderMailSchema } from './order-bulk-validation.ts';
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
const payload = { order_id: '45820f2c-6d6c-4067-9816-cc6dc4500db4', customer_id: '45820f2c-6d6c-4067-9816-cc6dc4500db4', to_email: 'kunde@example.com', from_email: 'vertrieb@alixwork.de', subject: 'Auftrag', body_text: 'Freier Text' };
Deno.test('ein einzelner Empfänger statt Verteiler', () => {
  assertEquals(bulkOrderMailSchema.safeParse({ ...payload, to_email: ['a@example.com', 'b@example.com'] }).success, false);
});
Deno.test('Kundenakte benötigt Kunden-ID', () => {
  assertEquals(bulkOrderMailSchema.safeParse({ ...payload, customer_id: null }).success, false);
});
Deno.test('freier Text akzeptiert', () => {
  assertEquals(bulkOrderMailSchema.safeParse(payload).success, true);
});
Deno.test('Auftragsversand erlaubt service@alix-lasers.com', () => {
  assertEquals(bulkOrderMailSchema.safeParse({ ...payload, from_email: 'service@alix-lasers.com' }).success, true);
  assertEquals(bulkOrderMailSchema.safeParse({ ...payload, from_email: 'other@alix-lasers.com' }).success, false);
});
Deno.test('Upload mit ungültiger Kodierung abgelehnt', () => {
  assertEquals(bulkOrderMailSchema.safeParse({ ...payload, attachments: [{ filename: 'a.pdf', content: '<script>', contentType: 'application/pdf' }] }).success, false);
});
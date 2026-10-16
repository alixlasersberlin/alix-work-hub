import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { invoiceDueAt, invoiceEmail, bytesToBase64 } from './rules.ts';

Deno.test('Anzahlung exakt zwei Stunden nach Festschreibung fällig', () => {
  assertEquals(invoiceDueAt('2026-10-16T07:40:00Z'), '2026-10-16T09:40:00.000Z');
});
Deno.test('Kunde ist Empfänger, Buchhaltung im echten CC', () => {
  const email = invoiceEmail('kunde@firma.de', '2026-10-0001', 'AB-2026-04564');
  assertEquals(email.to, ['kunde@firma.de']);
  assertEquals(email.cc, ['buchhaltung@alix-operation.de']);
});
Deno.test('Ohne gültige Kundenadresse kein Versand', () => {
  assertThrows(() => invoiceEmail('', '2026-10-0001', 'AB-2026-04564'));
});
Deno.test('PDF Anhang bleibt unverändert', () => {
  assertEquals(bytesToBase64(new Uint8Array([37, 80, 68, 70])), 'JVBERg==');
});
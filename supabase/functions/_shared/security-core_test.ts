import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { escapeHtml, maskEmail, maskPhone, storedRecipient, isUuid } from './security-core.ts';

Deno.test('escapeHtml neutralises markup', () => {
  assertEquals(escapeHtml('<a href="x">\'&'), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;');
  assertEquals(escapeHtml(null), '');
});
Deno.test('maskEmail hides recipient', () => {
  assertEquals(maskEmail('max.muster@alix-lasers.de'), 'm***@***.de');
  assertEquals(maskEmail(''), '');
});
Deno.test('maskPhone keeps last two digits', () => assertEquals(maskPhone('+49 170 1234567'), '***67'));
Deno.test('storedRecipient requires exact stored address', () => {
  assertEquals(storedRecipient('A@B.de ', 'a@b.de'), true);
  assertEquals(storedRecipient('evil@x.de', 'a@b.de', null), false);
  assertEquals(storedRecipient('', ''), false);
});
Deno.test('isUuid validates ids', () => {
  assertEquals(isUuid('7110c16c-0000-4000-8000-000000000000'), true);
  assertEquals(isUuid('1 or 1=1'), false);
});
import { storedPhone } from './security-core.ts';
Deno.test('storedPhone accepts only stored numbers across formats', () => {
  assertEquals(storedPhone('+49 170 1234567', '0170/1234567'), true);
  assertEquals(storedPhone('004917012345678', '+4917012345678'), true);
  assertEquals(storedPhone('+491709999999', '0170 1234567', null), false);
  assertEquals(storedPhone('', ''), false);
});

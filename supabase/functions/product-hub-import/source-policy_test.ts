import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { approvedSource, allowedImportMode } from './source-policy.ts';
Deno.test('source credentials are bound to the existing exact export endpoint', () => {
  assertEquals(approvedSource('https://alix-legacy-reborn.lovable.app/api/public/product-hub/export'), true);
  for (const value of ['https://evil.example/export', 'http://127.0.0.1', 'https://alix-legacy-reborn.lovable.app.evil.example/api/public/product-hub/export', 'https://alix-legacy-reborn.lovable.app/api/public/product-hub/export?redirect=evil', 'https://user:pass@alix-legacy-reborn.lovable.app/api/public/product-hub/export']) assertEquals(approvedSource(value), false);
});
Deno.test('preview remains usable but unaccepted production import is isolated', () => {
  assertEquals(allowedImportMode('test'), true);
  assertEquals(allowedImportMode('preview'), true);
  assertEquals(allowedImportMode('import'), false);
  assertEquals(allowedImportMode('unknown'), false);
});
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { ImportInput, sourcesAllowed } from './input.ts';
Deno.test('Zoho manual import cannot select an unassigned company', () => {
  assertEquals(sourcesAllowed(['zoho_eu_1','zoho_eu_2'], ['zoho_eu_1']), false);
  assertEquals(sourcesAllowed(['zoho_eu_1'], ['zoho_eu_1']), true);
  assertEquals(sourcesAllowed([], ['zoho_eu_1']), false);
});
Deno.test('Zoho dry run never permits the email test branch', () => {
  assertEquals(ImportInput.safeParse({dry_run:true,test_email:true}).success, false);
  assertEquals(ImportInput.safeParse({dry_run:true}).success, true);
});
Deno.test('Zoho input rejects invalid dates and unbounded pagination', () => {
  for (const value of [{date_from:'2026-02-30'}, {per_page:201}, {max_pages:41}, {date_from:'2026-11-28',date_to:'2026-11-01'}, {sources:['unknown']}]) {
    assertEquals(ImportInput.safeParse(value).success, false);
  }
});
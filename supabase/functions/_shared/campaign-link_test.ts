import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { signCampaignLink, verifyCampaignLink, safeRedirectTarget } from './campaign-link.ts';
Deno.test('campaign links bind recipient and target', async () => {
  const s = await signCampaignLink('r1', 'https://alix-lasers.de', 'k');
  assertEquals(await verifyCampaignLink('r1', 'https://alix-lasers.de', s, 'k'), true);
  assertEquals(await verifyCampaignLink('r1', 'https://evil.example', s, 'k'), false);
  assertEquals(await verifyCampaignLink('r2', 'https://alix-lasers.de', s, 'k'), false);
});
Deno.test('only web redirect targets', () => {
  assertEquals(safeRedirectTarget('javascript:alert(1)'), null);
  assertEquals(safeRedirectTarget('https://alix-lasers.de/x'), 'https://alix-lasers.de/x');
});

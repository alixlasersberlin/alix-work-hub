import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { requireProcessAccess, financeRegionAllowed, tenantObjectAllowed } from './process-access.ts';
Deno.test('public credentials cannot execute financial processes', async () => {
  Deno.env.set('SUPABASE_URL', 'https://process.example.test');
  Deno.env.set('SUPABASE_ANON_KEY', 'public-key');
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'private-service');
  Deno.env.set('CRON_SECRET', 'private-cron');
  const result = await requireProcessAccess(new Request('https://app.example.test', { method: 'POST', headers: { Authorization: 'Bearer public-key', apikey: 'public-key' } }), {}, ['Admin']);
  assertEquals('response' in result && result.response.status, 401);
});
Deno.test('existing private automatic finance credential retains its job branch', async () => {
  Deno.env.set('SUPABASE_URL', 'https://process.example.test');
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'private-service');
  Deno.env.set('CRON_SECRET', 'private-cron');
  const result = await requireProcessAccess(new Request('https://app.example.test', { method: 'POST', headers: { 'x-cron-secret': 'private-cron' } }), {}, ['Admin']);
  assertEquals('machine' in result && result.machine, true);
});
Deno.test('EU and CH finance roles are distinct from limited open-item access', () => {
  assertEquals(financeRegionAllowed(['Buchhaltung EU'], 'EU'), true);
  assertEquals(financeRegionAllowed(['Buchhaltung EU'], 'CH'), false);
  assertEquals(financeRegionAllowed(['Buchhaltung CH'], 'CH'), true);
  assertEquals(financeRegionAllowed(['FIBU LIGHT'], 'EU'), false);
});
Deno.test('missing and foreign tenant identities never imply global access', () => {
  assertEquals(tenantObjectAllowed(['DE', 'AT'], 'AT'), true);
  assertEquals(tenantObjectAllowed(['DE'], 'AT'), false);
  assertEquals(tenantObjectAllowed([], 'DE'), false);
  assertEquals(tenantObjectAllowed(['DE'], null), false);
});
import { assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { loadTwilioConfig } from './twilio-config.ts';

const env = {sid:'fixture-account',token:'fixture-token',from:'FIXTURE'};
Deno.test('SMS configuration uses the fixed service-only reader, never a deleted plaintext column', async () => {
  let rpc = '';
  const result = await loadTwilioConfig({rpc:(name) => {rpc=name;return Promise.resolve({data:{account_sid:'vault-account',auth_token:'vault-fixture',from_number:'FIXTURE'},error:null});}},env);
  assertEquals(rpc,'sms_effective_config');
  assertEquals(result.sid,'vault-account'); assertEquals(result.token,'vault-fixture');
  assertEquals(result.db_token,true);
});
Deno.test('SMS configuration retains environment credentials for an unconfigured database', async () => {
  const result = await loadTwilioConfig({rpc:() => Promise.resolve({data:{},error:null})},env);
  assertEquals(result.sid,env.sid); assertEquals(result.token,env.token); assertEquals(result.from,env.from);
});
Deno.test('SMS configuration fails closed on reader errors, without leaking provider errors', async () => {
  await assertRejects(() => loadTwilioConfig({rpc:() => Promise.resolve({data:null,error:'sensitive fixture'})},env),Error,'Geschützte SMS-Konfiguration nicht verfügbar');
});
Deno.test('SMS configuration refuses mixed provider accounts and orphaned tokens', async () => {
  await assertRejects(() => loadTwilioConfig({rpc:() => Promise.resolve({data:{account_sid:'other-account'},error:null})},env));
  await assertRejects(() => loadTwilioConfig({rpc:() => Promise.resolve({data:{auth_token:'orphan-fixture'},error:null})},env));
});
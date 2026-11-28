import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { reserveSmsSend, smsLimitWithCors } from './sms-limit.ts';

Deno.test('SMS limiter shares normalized hashed recipients across send paths', async () => {
  const calls: Record<string,unknown>[] = [];
  const client = {rpc:(name:string,args:Record<string,unknown>) => {
    assertEquals(name,'sms_reserve_send'); calls.push(args);
    return Promise.resolve({data:{allowed:true},error:null});
  }};
  assertEquals(await reserveSmsSend(client,'user','0171 1234567'),null);
  assertEquals(await reserveSmsSend(client,'user','+491711234567'),null);
  assertEquals(calls[0],calls[1]);
  assert(/^[a-f0-9]{64}$/.test(String(calls[0].p_recipient_hash)));
  assert(!JSON.stringify(calls).includes('491711234567'));
});
Deno.test('SMS limiter returns 429 and retry delay without sending', async () => {
  const client = {rpc:() => Promise.resolve({data:{allowed:false,scope:'recipient',retry_after_seconds:3600},error:null})};
  const response = await reserveSmsSend(client,'user','01711234567');
  assert(response);
  const result = smsLimitWithCors(response,{'Access-Control-Allow-Origin':'*'});
  assertEquals(result.status,429);
  assertEquals(result.headers.get('Retry-After'),'3600');
  assertEquals(result.headers.get('Access-Control-Expose-Headers'),'Retry-After');
});
Deno.test('SMS limiter fails closed for database failures and malformed answers', async () => {
  for (const answer of [{data:null,error:'failed'},{data:{allowed:'true'},error:null},{data:{allowed:false,scope:'recipient',retry_after_seconds:0},error:null},{data:{allowed:false,scope:'recipient',retry_after_seconds:Infinity},error:null}]) {
    assertEquals((await reserveSmsSend({rpc:() => Promise.resolve(answer)},'user','01711234567'))?.status,503);
  }
  assertEquals((await reserveSmsSend({rpc:() => Promise.reject(new Error('offline'))},'user','01711234567'))?.status,503);
});
Deno.test('SMS limiter rejects invalid phone before touching the database', async () => {
  let calls = 0;
  const response = await reserveSmsSend({rpc:() => {calls++;return Promise.resolve({data:{allowed:true},error:null});}},'user','invalid');
  assertEquals(response?.status,503); assertEquals(calls,0);
});
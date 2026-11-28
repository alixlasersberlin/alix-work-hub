import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { smsPhone, smsReview } from './sms-policy.ts';
Deno.test('SMS defaults recognize the saved number in international and national forms', () => {
  assertEquals(smsPhone('0171 1234567'), '+491711234567');
  assertEquals(smsPhone('0049 171 1234567'), '+491711234567');
  assertEquals(smsReview('+491711234567',['0171 1234567'],false,false,null).phone, '+491711234567');
});
Deno.test('Alternative SMS numbers require independent permission', () => {
  assertEquals(smsReview('+491711234567',['+491701234567'],false,true,'Kunde wünscht Rückruf').status, 403);
});
Deno.test('Alternative SMS numbers require explicit boolean confirmation', () => {
  assertEquals(smsReview('+491711234567',[],true,'true','Kunde bestätigt').status, 400);
});
Deno.test('Alternative SMS numbers require a bounded nonempty reason', () => {
  for (const reason of ['', '  ', 'x'.repeat(501)]) assertEquals(smsReview('+491711234567',[],true,true,reason).status, 400);
  assertEquals(smsReview('+491711234567',[],true,true,'Ersatznummer bestätigt').reason, 'Ersatznummer bestätigt');
});
Deno.test('SMS phone input rejects letters, extensions and excessive length', () => {
  for (const value of ['+491711234567ext99', '+49+1711234567', '+491711234567;DROP', '+1234567890123456']) assertEquals(smsPhone(value), null);
});
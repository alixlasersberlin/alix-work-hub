import { stageEffective, stageAmount, stagesFor } from './stages.ts';
const deposit = { key: 'deposit', percent: 2.5, event: 'deposit_received' };
const remainder = { key: 'delivery_three_installments', percent: 2.5, event: 'delivered', first_monthly_installments: 3 };
function equal(actual: unknown, expected: unknown) {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
Deno.test('2.5 percent of net becomes effective only with booked deposit', () => {
  equal(stageAmount(10000, deposit), 250);
  equal(stageEffective(deposit, { order_status: 'confirmed', finance_paid_amount: 9000 }, { deposit_received: false, first_three_paid: true }), false);
  equal(stageEffective(deposit, { order_status: 'confirmed' }, { deposit_received: true, first_three_paid: false }), true);
});
Deno.test('second 2.5 percent requires BOTH delivery AND first three paid monthly installments', () => {
  equal(stageAmount(10000, remainder), 250);
  equal(stageEffective(remainder, { order_status: 'geliefert' }, { deposit_received: true, first_three_paid: false }), false);
  equal(stageEffective(remainder, { order_status: 'confirmed' }, { deposit_received: true, first_three_paid: true }), false);
  equal(stageEffective(remainder, { order_status: 'invoiced' }, { deposit_received: true, first_three_paid: true }), false);
  equal(stageEffective(remainder, { order_status: 'geliefert' }, { deposit_received: true, first_three_paid: true }), true);
});
Deno.test('two tranches total 5 percent and are not paid for cancelled orders', () => {
  equal(stagesFor({ installment_mode: 'custom_schedule', installment_schedule: [deposit, remainder] }).length, 2);
  equal(stageAmount(10000, deposit) + stageAmount(10000, remainder), 500);
  equal(stageEffective(remainder, { order_status: 'storniert' }, { deposit_received: true, first_three_paid: true }), false);
});
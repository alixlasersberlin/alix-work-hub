import { assertEquals, assertRejects, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { createOrderOnce, OrderIdentityConflict, resolveExistingOrder } from './order-identity.ts';

const number = 'AB-2026-04704';
const row = { id: 'existing', order_number: number, source_system: 'manual', customer_id: 'customer' };

Deno.test('canonical and legacy rows do not cause maybeSingle ambiguity', () => {
  assertEquals(resolveExistingOrder([{ ...row, id: 'legacy', order_number: '2026-04704' }, row], number, 'manual', 'customer'), row);
});
Deno.test('same number in another source is never reused', () => {
  assertEquals(resolveExistingOrder([row], number, 'zoho_eu_1', 'customer'), undefined);
});
Deno.test('canonical number belonging to another customer is a conflict', () => {
  assertThrows(() => resolveExistingOrder([row], number, 'manual', 'other'), OrderIdentityConflict);
});
Deno.test('unrelated legacy customer is not reused', () => {
  assertEquals(resolveExistingOrder([{ ...row, order_number: '2026-04704' }], number, 'manual', 'other'), undefined);
});

// Minimal unique-index simulator exercises the same query chain as the live SDK.
function clientFor(rows: typeof row[], readError?: Error) {
  let insertCount = 0;
  return {
    get insertCount() { return insertCount; },
    from(table: string) {
      assertEquals(table, 'orders');
      return {
        select() { return { eq(_column: string, source: string) { return {
          async in(_column: string, numbers: string[]) {
            return { data: rows.filter(r => r.source_system === source && numbers.includes(r.order_number)), error: readError };
          },
        }; } }; },
        upsert(input: typeof row, options: unknown) {
          assertEquals(options, { onConflict: 'order_number,source_system', ignoreDuplicates: true });
          return { select() { return { async maybeSingle() {
            if (rows.some(r => r.order_number === input.order_number && r.source_system === input.source_system)) {
              return { data: null, error: null };
            }
            const created = { ...input, id: 'new-order' };
            rows.push(created);
            insertCount++;
            return { data: created, error: null };
          } }; } };
        },
      };
    },
  };
}
Deno.test('repeat conversion returns original order without insert or overwrite', async () => {
  const client = clientFor([row]);
  assertEquals(await createOrderOnce(client, row, '2026-04704'), { order: row, already: true });
  assertEquals(client.insertCount, 0);
});
Deno.test('parallel conversions create exactly one order and reuse its ID', async () => {
  const client = clientFor([]);
  const results = await Promise.all(Array.from({ length: 8 }, () => createOrderOnce(client, row, '2026-04704')));
  assertEquals(client.insertCount, 1);
  assertEquals(results.filter(r => !r.already).length, 1);
  assertEquals(new Set(results.map(r => r.order.id)).size, 1);
});
Deno.test('failed existence lookup never proceeds to insert', async () => {
  const client = clientFor([], new Error('read failed'));
  await assertRejects(() => createOrderOnce(client, row, '2026-04704'), Error, 'read failed');
  assertEquals(client.insertCount, 0);
});
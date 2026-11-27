export type OrderIdentity = {
  id: string;
  order_number: string;
  source_system: string;
  customer_id: string;
};

export class OrderIdentityConflict extends Error {}

// Canonical number wins over a legacy number; never select another source/customer.
export function resolveExistingOrder(
  rows: OrderIdentity[], number: string, source: string, customer: string,
): OrderIdentity | undefined {
  const scoped = rows.filter(row => row.source_system === source);
  const canonical = scoped.find(row => row.order_number === number);
  if (canonical && canonical.customer_id !== customer) {
    throw new OrderIdentityConflict('Die Auftragsnummer ist bereits einem anderen Kunden zugeordnet. Bitte Zuordnung prüfen.');
  }
  return canonical ?? scoped.find(row => row.customer_id === customer);
}

// DO NOTHING on the unique key: a concurrent conversion must never overwrite an order.
export async function createOrderOnce(client: any, row: Record<string, unknown> & {
  order_number: string; source_system: string; customer_id: string;
}, legacyNumber: string): Promise<{ order: OrderIdentity; already: boolean }> {
  const lookup = async () => {
    const { data, error } = await client.from('orders')
      .select('id, order_number, source_system, customer_id')
      .eq('source_system', row.source_system)
      .in('order_number', [row.order_number, legacyNumber]);
    if (error) throw error;
    return resolveExistingOrder(data ?? [], row.order_number, row.source_system, row.customer_id);
  };
  const existing = await lookup();
  if (existing) return { order: existing, already: true };

  const { data, error } = await client.from('orders')
    .upsert(row, { onConflict: 'order_number,source_system', ignoreDuplicates: true })
    .select('id, order_number, source_system, customer_id').maybeSingle();
  if (error) throw error;
  if (data) return { order: data, already: false };

  const concurrent = await lookup();
  if (concurrent) return { order: concurrent, already: true };
  throw new Error('Auftragsanlage konnte nicht bestätigt werden. Bitte erneut prüfen.');
}
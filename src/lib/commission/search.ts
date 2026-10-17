type Customer = { company_name?: string | null; contact_name?: string | null };

export type SearchableCommission = {
  customer_name?: string | null;
  entry_number?: string | null;
  order_number?: string | null;
  device_name?: string | null;
  customer?: Customer | null;
  order?: { order_number?: string | null; customer?: Customer | null } | null;
};

export function commissionCustomerName(entry: SearchableCommission): string | null {
  return [entry.customer_name, entry.customer?.company_name, entry.order?.customer?.company_name,
    entry.customer?.contact_name, entry.order?.customer?.contact_name]
    .find((name) => name?.trim())?.trim() ?? null;
}

export function matchesCommissionSearch(entry: SearchableCommission, query: string, employeeName?: string): boolean {
  const search = query.trim().toLocaleLowerCase('de');
  if (!search) return true;
  return [entry.entry_number, entry.order_number, entry.order?.order_number, entry.customer_name,
    entry.customer?.company_name, entry.customer?.contact_name, entry.order?.customer?.company_name,
    entry.order?.customer?.contact_name, employeeName, entry.device_name]
    .some((value) => value?.toLocaleLowerCase('de').includes(search));
}

export const COMMISSION_CUSTOMER_SELECT = 'customer:customers!commission_entries_customer_id_fkey(company_name, contact_name), order:orders!commission_entries_order_id_fkey(order_number, customer:customers!orders_customer_id_fkey(company_name, contact_name))';
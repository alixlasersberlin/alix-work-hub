import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { isUuid } from './security-core.ts';
type Tenant = { id: string; zoho_source_system: string | null };
export type SmsContext = { customerId: string; recordId: string; recordNumber: string; storedPhones: unknown[] };
/** Reads use the caller's RLS client; explicit source checks remain mandatory. */
export async function resolveSmsContext(client: SupabaseClient, tenants: Tenant[], kind: string, id: string): Promise<SmsContext | null> {
  let customerId: string | null = null;
  let source: string | null = null;
  let number = id;
  let extraPhone: unknown;
  if (kind === 'invoice') {
    let invoice: Record<string, unknown> | null = null;
    for (const table of ['zoho_invoices','zoho_recurring_invoices']) {
      const { data, error } = await client.from(table).select('id,customer_id,source_system,invoice_number').eq('id',id).maybeSingle();
      if (error) return null;
      if (data) { invoice = data; break; }
    }
    if (!invoice) return null;
    customerId = String(invoice.customer_id ?? ''); source = String(invoice.source_system ?? ''); number = String(invoice.invoice_number ?? id);
  } else if (kind === 'deposit') {
    const { data: deposit, error } = await client.from('finance_deposits').select('id,customer_id,tenant_id,invoice_number,deposit_number').eq('id',id).maybeSingle();
    if (error || !deposit) return null;
    customerId = deposit.customer_id; source = tenants.find(t => t.id === deposit.tenant_id)?.zoho_source_system ?? null;
    number = deposit.invoice_number ?? deposit.deposit_number ?? id;
  } else if (kind === 'device_lock') {
    const { data: lock, error } = await client.from('device_locks').select('id,invoice_id').eq('id',id).maybeSingle();
    if (error || !lock?.invoice_id) return null;
    const context = await resolveSmsContext(client,tenants,'invoice',lock.invoice_id);
    return context ? {...context,recordId:id} : null;
  } else if (kind === 'prenotification') {
    const { data: notice, error } = await client.from('rp_prenotifications').select('id,item_id,invoice_id,customer_id').eq('id',id).maybeSingle();
    if (error || !notice) return null;
    const invoice = await resolveSmsContext(client,tenants,'invoice',notice.invoice_id);
    if (!invoice || invoice.customerId !== notice.customer_id) return null;
    const { data: item, error: itemError } = await client.from('rp_billing_run_items').select('id,plan_id,customer_id').eq('id',notice.item_id).maybeSingle();
    if (itemError || !item || item.customer_id !== notice.customer_id) return null;
    const { data: plan, error: planError } = await client.from('rp_payment_plans').select('id,customer_id,phone').eq('id',item.plan_id).maybeSingle();
    if (planError || !plan || plan.customer_id !== notice.customer_id) return null;
    extraPhone = plan.phone;
    return {...invoice,recordId:id,storedPhones:[...invoice.storedPhones,extraPhone]};
  } else return null;
  if (!customerId || !source || !tenants.some(t => t.zoho_source_system === source)) return null;
  let query = client.from('customers').select('id,phone').eq('source_system',source);
  // Zoho invoice identities map only through the source-scoped external customer ID.
  query = isUuid(customerId) ? query.eq('id',customerId) : query.eq('external_customer_id',customerId);
  const { data: customer, error } = await query.maybeSingle();
  if (error || !customer) return null;
  return {customerId:customer.id,recordId:id,recordNumber:number,storedPhones:[customer.phone]};
}
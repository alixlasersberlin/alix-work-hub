import { supabase } from '@/integrations/supabase/client';

// ============ finance_accounts ============
export async function getFinanceAccount(customerId: string) {
  const { data, error } = await supabase
    .from('finance_accounts' as any)
    .select('*')
    .eq('customer_id', customerId)
    .maybeSingle();
  if (error) throw error;
  return data as any;
}

export async function createFinanceAccount(payload: { customer_id: string } & Record<string, any>) {
  const { data, error } = await supabase
    .from('finance_accounts' as any)
    .insert(payload as any)
    .select()
    .single();
  if (error) throw error;
  return data as any;
}

export async function updateFinanceAccount(id: string, patch: Record<string, any>) {
  const { data, error } = await supabase
    .from('finance_accounts' as any)
    .update(patch as any)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as any;
}

// ============ finance_contracts ============
export async function listContracts(filter?: { customer_id?: string; order_id?: string; device_id?: string }) {
  let q: any = supabase.from('finance_contracts' as any).select('*').order('created_at', { ascending: false });
  if (filter?.customer_id) q = q.eq('customer_id', filter.customer_id);
  if (filter?.order_id) q = q.eq('order_id', filter.order_id);
  if (filter?.device_id) q = q.eq('device_id', filter.device_id);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function getContract(id: string) {
  const { data, error } = await supabase.from('finance_contracts' as any).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as any;
}

export async function createContract(payload: Record<string, any>) {
  const { data, error } = await supabase.from('finance_contracts' as any).insert(payload as any).select().single();
  if (error) throw error;
  return data as any;
}

export async function updateContract(id: string, patch: Record<string, any>) {
  const { data, error } = await supabase.from('finance_contracts' as any).update(patch as any).eq('id', id).select().single();
  if (error) throw error;
  return data as any;
}

// ============ finance_transactions ============
export async function getTransactions(filter?: {
  customer_id?: string; order_id?: string; device_id?: string; contract_id?: string; transaction_type?: string;
}) {
  let q: any = supabase.from('finance_transactions' as any).select('*').order('booking_date', { ascending: false }).limit(500);
  if (filter?.customer_id) q = q.eq('customer_id', filter.customer_id);
  if (filter?.order_id) q = q.eq('order_id', filter.order_id);
  if (filter?.device_id) q = q.eq('device_id', filter.device_id);
  if (filter?.contract_id) q = q.eq('contract_id', filter.contract_id);
  if (filter?.transaction_type) q = q.eq('transaction_type', filter.transaction_type);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function createTransaction(payload: Record<string, any>) {
  const { data, error } = await supabase.from('finance_transactions' as any).insert(payload as any).select().single();
  if (error) throw error;
  return data as any;
}

export async function updateTransaction(id: string, patch: Record<string, any>) {
  const { data, error } = await supabase.from('finance_transactions' as any).update(patch as any).eq('id', id).select().single();
  if (error) throw error;
  return data as any;
}

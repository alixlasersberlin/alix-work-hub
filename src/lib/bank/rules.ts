import { supabase } from '@/integrations/supabase/client';

const T = (n: string) => supabase.from(n as any);

export interface BankMatchRule {
  id: string;
  accounting_area: string;
  payer_key: string;
  payer_iban: string | null;
  payer_name: string | null;
  customer_id: string | null;
  customer_name: string | null;
  allocation_type: string;
  hit_count: number;
  auto_book: boolean;
  last_used_at: string;
}

const norm = (s: string | null | undefined) =>
  (s ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');

/** Eindeutiger Schlüssel eines Zahlers: bevorzugt IBAN, sonst normalisierter Name. */
export function payerKey(tx: { sender_receiver_iban?: string | null; sender_receiver_name?: string | null }): string | null {
  const iban = norm(tx.sender_receiver_iban);
  if (iban.length >= 10) return `iban:${iban}`;
  const name = norm(tx.sender_receiver_name);
  if (name.length >= 4) return `name:${name}`;
  return null;
}

/** Lädt alle gelernten Zuordnungsregeln einer Buchhaltungsregion. */
export async function loadMatchRules(area: 'EU' | 'CH'): Promise<Map<string, BankMatchRule>> {
  const { data, error } = await T('bank_match_rules')
    .select('*').eq('accounting_area', area).limit(2000);
  if (error) return new Map();
  const map = new Map<string, BankMatchRule>();
  for (const r of (data ?? []) as unknown as BankMatchRule[]) map.set(r.payer_key, r);
  return map;
}

export async function listMatchRules(area: 'EU' | 'CH'): Promise<BankMatchRule[]> {
  const { data, error } = await T('bank_match_rules')
    .select('*').eq('accounting_area', area).order('last_used_at', { ascending: false }).limit(500);
  if (error) throw error;
  return (data ?? []) as unknown as BankMatchRule[];
}

export async function deleteMatchRule(id: string) {
  const { error } = await T('bank_match_rules').delete().eq('id', id);
  if (error) throw error;
}

export async function setRuleAutoBook(id: string, auto_book: boolean) {
  const { error } = await T('bank_match_rules').update({ auto_book } as any).eq('id', id);
  if (error) throw error;
}

/**
 * Lernt aus einer manuellen bzw. bestätigten Verbuchung: merkt sich, welchem
 * Kunden ein Zahler (IBAN/Name) zugeordnet wurde. Fehler werden bewusst
 * verschluckt — Lernen darf eine Verbuchung nie blockieren.
 */
export async function learnFromBooking(
  tx: any,
  allocation: { customer_id?: string | null; allocation_type?: string | null; customer_name?: string | null },
) {
  try {
    const key = payerKey(tx);
    if (!key || !allocation?.customer_id) return;
    const area = (tx.accounting_area as string) || 'EU';
    const { data: u } = await supabase.auth.getUser();

    const { data: existing } = await T('bank_match_rules')
      .select('id,hit_count').eq('accounting_area', area).eq('payer_key', key).maybeSingle();

    if (existing) {
      await T('bank_match_rules').update({
        customer_id: allocation.customer_id,
        customer_name: allocation.customer_name ?? tx.sender_receiver_name ?? null,
        allocation_type: allocation.allocation_type ?? 'rechnung',
        hit_count: Number((existing as any).hit_count ?? 0) + 1,
        last_used_at: new Date().toISOString(),
      } as any).eq('id', (existing as any).id);
    } else {
      await T('bank_match_rules').insert({
        accounting_area: area,
        payer_key: key,
        payer_iban: tx.sender_receiver_iban ?? null,
        payer_name: tx.sender_receiver_name ?? null,
        customer_id: allocation.customer_id,
        customer_name: allocation.customer_name ?? tx.sender_receiver_name ?? null,
        allocation_type: allocation.allocation_type ?? 'rechnung',
        created_by: u?.user?.id ?? null,
      } as any);
    }
  } catch {
    /* Lernen ist optional */
  }
}

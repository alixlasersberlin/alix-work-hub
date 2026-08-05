import { supabase } from '@/integrations/supabase/client';
import { logBank } from './api';
import { RETURN_DUNNING_CC } from './returnDebit';

/** Feste Gebührensätze für Rücklastschriften */
export const RD_FEE_BANK = 15;
export const RD_FEE_HANDLING = 30;
export const RD_FEE_TOTAL = RD_FEE_BANK + RD_FEE_HANDLING;

const money = (n: number, cur = 'EUR') =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: cur || 'EUR' }).format(n);

async function nextFeeInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `GEB-${year}-`;
  const { data } = await supabase
    .from('zoho_invoices')
    .select('invoice_number')
    .like('invoice_number', `${prefix}%`)
    .order('invoice_number', { ascending: false })
    .limit(1);
  const last = (data?.[0] as any)?.invoice_number as string | undefined;
  const n = last ? Number(last.slice(prefix.length)) || 0 : 0;
  return `${prefix}${String(n + 1).padStart(4, '0')}`;
}

async function resolveCustomer(rd: any, customerId: string | null, tx?: any) {
  let name: string | null = null;
  let email: string | null = null;
  let externalId: string | null = null;
  if (customerId) {
    const { data: c } = await supabase
      .from('customers')
      .select('company_name, contact_name, email, external_customer_id, city')
      .eq('id', customerId)
      .maybeSingle();
    name = (c as any)?.company_name || (c as any)?.contact_name || null;
    email = (c as any)?.email ?? null;
    externalId = (c as any)?.external_customer_id ?? null;
  }
  if (!email && rd.invoice_id) {
    const { data: inv } = await supabase
      .from('zoho_invoices')
      .select('customer_id, customer_name, raw_data')
      .eq('id', rd.invoice_id)
      .maybeSingle();
    if (inv) {
      name = name || ((inv as any).customer_name ?? null);
      const raw = (inv as any).raw_data;
      if (typeof raw?.email === 'string') email = raw.email;
      if (!email && (inv as any).customer_id) {
        const { data: c2 } = await supabase
          .from('customers')
          .select('company_name, contact_name, email, external_customer_id')
          .eq('external_customer_id', String((inv as any).customer_id))
          .maybeSingle();
        name = name || (c2 as any)?.company_name || (c2 as any)?.contact_name || null;
        email = (c2 as any)?.email ?? null;
        externalId = externalId || ((c2 as any)?.external_customer_id ?? null);
      }
    }
  }
  if (!name) name = tx?.sender_receiver_name ?? null;
  return { name, email, externalId };
}

export interface FeeInvoiceResult {
  invoiceId: string;
  invoiceNumber: string;
  total: number;
  emailSentTo?: string | null;
  created: boolean;
}

/**
 * Erzeugt zu einer Rücklastschrift automatisch eine Gebührenrechnung
 * (15 € Bankgebühren + 30 € Bearbeitungsgebühren), verbucht sie als offene
 * Rechnung und versendet sie per E-Mail an den Kunden (BCC Buchhaltung).
 * Idempotent: pro Rücklastschrift entsteht höchstens eine Gebührenrechnung.
 */
export async function createReturnDebitFeeInvoice(
  rd: any,
  customerId: string | null,
  tx?: any,
): Promise<FeeInvoiceResult> {
  const zohoId = `rd-fee-${rd.id}`;
  const currency = rd.currency || (rd.accounting_area === 'CH' ? 'CHF' : 'EUR');
  const region = rd.accounting_area === 'CH' ? 'CH' : 'EU';

  const { data: existing } = await supabase
    .from('zoho_invoices')
    .select('id, invoice_number, total')
    .eq('source_system', 'internal')
    .eq('zoho_invoice_id', zohoId)
    .maybeSingle();

  if (existing) {
    return {
      invoiceId: (existing as any).id,
      invoiceNumber: (existing as any).invoice_number,
      total: Number((existing as any).total ?? RD_FEE_TOTAL),
      created: false,
    };
  }

  const cust = await resolveCustomer(rd, customerId, tx);
  const invoiceNumber = await nextFeeInvoiceNumber();
  const today = new Date();
  const due = new Date(today);
  due.setDate(due.getDate() + 7);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const lineItems = [
    { name: 'Bankgebühren Rücklastschrift', quantity: 1, rate: RD_FEE_BANK, amount: RD_FEE_BANK },
    { name: 'Bearbeitungsgebühr Rücklastschrift', quantity: 1, rate: RD_FEE_HANDLING, amount: RD_FEE_HANDLING },
  ];

  const { data: ins, error } = await (supabase.from('zoho_invoices') as any)
    .insert({
      source_system: 'internal',
      zoho_invoice_id: zohoId,
      invoice_number: invoiceNumber,
      reference_number: rd.invoice_number ?? null,
      customer_id: cust.externalId,
      customer_name: cust.name,
      invoice_date: iso(today),
      due_date: iso(due),
      currency,
      total: RD_FEE_TOTAL,
      balance: RD_FEE_TOTAL,
      status: 'offen',
      payment_status: 'offen',
      accounting_region: region,
      tenant_id: rd.tenant_id ?? null,
      raw_data: {
        source: 'ruecklastschrift_gebuehrenrechnung',
        return_debit_id: rd.id,
        email: cust.email,
        line_items: lineItems,
        bank_fee: RD_FEE_BANK,
        handling_fee: RD_FEE_HANDLING,
        note: 'Gebühren gemäß § 280 BGB (Verzugsschaden), nicht umsatzsteuerbar.',
      },
    })
    .select('id, invoice_number')
    .single();
  if (error) throw error;

  const invoiceId = (ins as any).id as string;

  await logBank({
    action: 'ruecklastschrift_gebuehrenrechnung_erstellt',
    bank_transaction_id: rd.bank_transaction_id ?? tx?.id ?? null,
    new_value: {
      return_debit_id: rd.id,
      invoice_id: invoiceId,
      invoice_number: invoiceNumber,
      bank_fee: RD_FEE_BANK,
      handling_fee: RD_FEE_HANDLING,
      total: RD_FEE_TOTAL,
    },
  });

  let emailSentTo: string | null = null;
  if (cust.email) {
    const { data, error: mailErr } = await supabase.functions.invoke('send-transactional-email', {
      body: {
        templateName: 'ruecklastschrift-gebuehrenrechnung',
        recipientEmail: cust.email,
        bcc: RETURN_DUNNING_CC,
        idempotencyKey: `rd-fee-invoice-${rd.id}-${Date.now()}`,
        templateData: {
          customerName: cust.name ?? '',
          invoiceNumber,
          invoiceDate: today.toLocaleDateString('de-DE'),
          dueDate: due.toLocaleDateString('de-DE'),
          currency,
          bankFee: RD_FEE_BANK,
          handlingFee: RD_FEE_HANDLING,
          total: RD_FEE_TOTAL,
          returnDate: rd.booking_date ? new Date(rd.booking_date).toLocaleDateString('de-DE') : null,
          returnReason: rd.return_reason ?? null,
          originalInvoice: rd.invoice_number ?? null,
          amountText: money(RD_FEE_TOTAL, currency),
        },
      },
    });
    if (mailErr) throw new Error(mailErr.message);
    if (!data?.success) throw new Error(data?.error || 'E-Mail-Dienst hat den Versand nicht bestätigt');
    emailSentTo = cust.email;
    await logBank({
      action: 'ruecklastschrift_gebuehrenrechnung_versendet',
      bank_transaction_id: rd.bank_transaction_id ?? tx?.id ?? null,
      new_value: { return_debit_id: rd.id, invoice_number: invoiceNumber, recipient: cust.email, bcc: RETURN_DUNNING_CC },
    });
  }

  return { invoiceId, invoiceNumber, total: RD_FEE_TOTAL, emailSentTo, created: true };
}

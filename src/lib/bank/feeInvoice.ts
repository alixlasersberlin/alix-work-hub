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

const pickEmail = (raw: any): string | null => {
  if (!raw) return null;
  const cand = [raw.email, raw.customer_email, raw.contact_email, raw.billing_address?.email];
  for (const c of cand) if (typeof c === 'string' && c.includes('@')) return c.trim();
  const cp = raw.contact_persons_details ?? raw.contact_persons;
  if (Array.isArray(cp)) {
    const hit = cp.find((p: any) => typeof p?.email === 'string' && p.email.includes('@'));
    if (hit) return String(hit.email).trim();
  }
  if (typeof raw.email_id === 'string' && raw.email_id.includes('@')) return raw.email_id.trim();
  return null;
};

/**
 * Ermittelt Name + E-Mail des Kunden für eine Rücklastschrift.
 * Sucht der Reihe nach: Kundendatensatz -> Ursprungsrechnung (normal + wiederkehrend)
 * -> Auftrag -> Kunde über Zoho-ID -> Kunde über Namen.
 */
async function resolveCustomer(rd: any, customerId: string | null, tx?: any) {
  let name: string | null = null;
  let email: string | null = null;
  let externalId: string | null = null;

  const fromCustomerRow = (c: any) => {
    if (!c) return;
    name = name || c.company_name || c.contact_name || null;
    email = email || (typeof c.email === 'string' && c.email.includes('@') ? c.email.trim() : null);
    externalId = externalId || c.external_customer_id || null;
  };

  const byInternalId = customerId ?? rd.customer_id ?? null;
  if (byInternalId) {
    const { data: c } = await supabase
      .from('customers')
      .select('company_name, contact_name, email, external_customer_id')
      .eq('id', byInternalId)
      .maybeSingle();
    fromCustomerRow(c);
  }

  // Ursprungsrechnung (normal oder wiederkehrend) – auch über Rechnungsnummer
  const sources: any[] = [];
  if (rd.invoice_id) {
    const [{ data: inv }, { data: rec }] = await Promise.all([
      supabase.from('zoho_invoices').select('customer_id, customer_name, raw_data').eq('id', rd.invoice_id).maybeSingle(),
      supabase.from('zoho_recurring_invoices').select('customer_id, customer_name, raw_data').eq('id', rd.invoice_id).maybeSingle(),
    ]);
    if (inv) sources.push(inv);
    if (rec) sources.push(rec);
  }
  if (rd.invoice_number) {
    const [{ data: inv2 }, { data: rec2 }] = await Promise.all([
      supabase.from('zoho_invoices').select('customer_id, customer_name, raw_data').eq('invoice_number', rd.invoice_number).limit(1),
      supabase.from('zoho_recurring_invoices').select('customer_id, customer_name, raw_data').eq('invoice_number', rd.invoice_number).limit(1),
    ]);
    if (inv2?.[0]) sources.push(inv2[0]);
    if (rec2?.[0]) sources.push(rec2[0]);
  }
  for (const src of sources) {
    name = name || (src.customer_name ?? null);
    email = email || pickEmail(src.raw_data);
    if (!email && src.customer_id) {
      const { data: c2 } = await supabase
        .from('customers')
        .select('company_name, contact_name, email, external_customer_id')
        .eq('external_customer_id', String(src.customer_id))
        .maybeSingle();
      fromCustomerRow(c2);
    }
    if (email) break;
  }

  // Auftrag als weitere Quelle
  if (!email && (rd.order_id || rd.order_number)) {
    const q = supabase.from('orders').select('customer_id').limit(1);
    const { data: ord } = rd.order_id ? await q.eq('id', rd.order_id) : await q.eq('order_number', rd.order_number);
    const o: any = ord?.[0];
    if (o) {
      if (!email && o.customer_id) {
        const { data: c4 } = await supabase
          .from('customers')
          .select('company_name, contact_name, email, external_customer_id')
          .eq('id', o.customer_id)
          .maybeSingle();
        fromCustomerRow(c4);
      }
    }
  }

  // Letzter Fallback: Kunde über Namen (Rechnungsname oder Kontoinhaber)
  for (const candidate of [name, tx?.sender_receiver_name, rd.customer_name].filter(Boolean) as string[]) {
    if (email) break;
    const { data: c3 } = await supabase
      .from('customers')
      .select('company_name, contact_name, email, external_customer_id')
      .ilike('company_name', candidate)
      .not('email', 'is', null)
      .limit(1);
    fromCustomerRow(c3?.[0]);
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
    await (supabase.from('bank_return_debits') as any)
      .update({
        fee_invoice_id: (existing as any).id,
        fee_invoice_number: (existing as any).invoice_number,
        fee_invoice_total: Number((existing as any).total ?? RD_FEE_TOTAL),
      })
      .eq('id', rd.id);
    // Falls noch nie versendet: E-Mail automatisch nachholen
    let emailSentTo: string | null = null;
    if (!rd.fee_invoice_sent_at) {
      try {
        emailSentTo = await resendReturnDebitFeeInvoice({ ...rd, customer_id: rd.customer_id ?? customerId }, undefined, tx);
      } catch (e) {
        console.warn('Gebührenrechnung konnte nicht automatisch versendet werden:', e);
      }
    }
    return {
      invoiceId: (existing as any).id,
      invoiceNumber: (existing as any).invoice_number,
      total: Number((existing as any).total ?? RD_FEE_TOTAL),
      emailSentTo,
      created: false,
    };
  }

  const cust = await resolveCustomer(rd, customerId, tx);
  const invoiceNumber = await nextFeeInvoiceNumber();
  const today = new Date();
  const due = new Date(today);
  due.setDate(due.getDate() + 7);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const pdfToken = crypto.randomUUID().replace(/-/g, '');

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
      accounting_region: (String(region) === 'ALL' ? 'EU' : region),
      tenant_id: rd.tenant_id ?? null,
      raw_data: {
        source: 'ruecklastschrift_gebuehrenrechnung',
        return_debit_id: rd.id,
        email: cust.email,
        pdf_token: pdfToken,
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

  // Rücklastschrift fest mit der Gebührenrechnung verknüpfen
  await (supabase.from('bank_return_debits') as any)
    .update({
      fee_invoice_id: invoiceId,
      fee_invoice_number: invoiceNumber,
      fee_invoice_status: 'offen',
      fee_invoice_total: RD_FEE_TOTAL,
    })
    .eq('id', rd.id);

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

  const pdfUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/return-debit-fee-invoice-pdf?id=${rd.id}&token=${pdfToken}`;

  let emailSentTo: string | null = null;
  if (cust.email) {
    const { data, error: mailErr } = await supabase.functions.invoke('send-transactional-email', {
      body: {
        templateName: 'ruecklastschrift-gebuehrenrechnung',
        recipientEmail: cust.email,
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
          pdfUrl,
        },
      },
    });
    if (mailErr) throw new Error(mailErr.message);
    if (!data?.success) throw new Error(data?.error || 'E-Mail-Dienst hat den Versand nicht bestätigt');
    emailSentTo = cust.email;
    await (supabase.from('bank_return_debits') as any)
      .update({ fee_invoice_sent_at: new Date().toISOString() })
      .eq('id', rd.id);
    await logBank({
      action: 'ruecklastschrift_gebuehrenrechnung_versendet',
      bank_transaction_id: rd.bank_transaction_id ?? tx?.id ?? null,
      new_value: { return_debit_id: rd.id, invoice_number: invoiceNumber, recipient: cust.email, bcc: RETURN_DUNNING_CC },
    });
  }

  return { invoiceId, invoiceNumber, total: RD_FEE_TOTAL, emailSentTo, created: true };
}

/**
 * Versendet eine bereits erzeugte Gebührenrechnung (erneut) per E-Mail.
 * Ermittelt den Empfänger notfalls über Kunde/Rechnung und speichert ihn nach.
 */
export async function resendReturnDebitFeeInvoice(rd: any, overrideEmail?: string, tx?: any): Promise<string> {
  const { data: inv } = await supabase
    .from('zoho_invoices')
    .select('id, invoice_number, invoice_date, due_date, currency, total, customer_name, raw_data')
    .eq('source_system', 'internal')
    .eq('zoho_invoice_id', `rd-fee-${rd.id}`)
    .maybeSingle();
  if (!inv) throw new Error('Keine Gebührenrechnung zu dieser Rücklastschrift gefunden');

  const raw: any = (inv as any).raw_data ?? {};
  let email: string | null = overrideEmail?.trim() || pickEmail(raw);
  let name: string | null = (inv as any).customer_name ?? null;
  if (!email) {
    const c = await resolveCustomer(rd, rd.customer_id ?? null, tx);
    email = c.email;
    name = name || c.name;
  }
  if (!email) throw new Error('Kein E-Mail-Empfänger ermittelbar – bitte Adresse manuell eingeben');

  let pdfToken: string = typeof raw.pdf_token === 'string' && raw.pdf_token ? raw.pdf_token : crypto.randomUUID().replace(/-/g, '');
  await (supabase.from('zoho_invoices') as any)
    .update({ raw_data: { ...raw, email, pdf_token: pdfToken } })
    .eq('id', (inv as any).id);

  const currency = (inv as any).currency || 'EUR';
  const pdfUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/return-debit-fee-invoice-pdf?id=${rd.id}&token=${pdfToken}`;

  const { data, error } = await supabase.functions.invoke('send-transactional-email', {
    body: {
      templateName: 'ruecklastschrift-gebuehrenrechnung',
      recipientEmail: email,
      idempotencyKey: `rd-fee-invoice-${rd.id}-${Date.now()}`,
      templateData: {
        customerName: name ?? '',
        invoiceNumber: (inv as any).invoice_number,
        invoiceDate: new Date((inv as any).invoice_date).toLocaleDateString('de-DE'),
        dueDate: new Date((inv as any).due_date).toLocaleDateString('de-DE'),
        currency,
        bankFee: Number(raw.bank_fee ?? RD_FEE_BANK),
        handlingFee: Number(raw.handling_fee ?? RD_FEE_HANDLING),
        total: Number((inv as any).total ?? RD_FEE_TOTAL),
        returnDate: rd.booking_date ? new Date(rd.booking_date).toLocaleDateString('de-DE') : null,
        returnReason: rd.return_reason ?? null,
        originalInvoice: rd.invoice_number ?? null,
        amountText: money(Number((inv as any).total ?? RD_FEE_TOTAL), currency),
        pdfUrl,
      },
    },
  });
  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error || 'E-Mail-Dienst hat den Versand nicht bestätigt');

  await (supabase.from('bank_return_debits') as any)
    .update({ fee_invoice_sent_at: new Date().toISOString() })
    .eq('id', rd.id);
  await logBank({
    action: 'ruecklastschrift_gebuehrenrechnung_versendet',
    bank_transaction_id: rd.bank_transaction_id ?? null,
    new_value: { return_debit_id: rd.id, invoice_number: (inv as any).invoice_number, recipient: email, bcc: RETURN_DUNNING_CC },
  });
  return email;
}

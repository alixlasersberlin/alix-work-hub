import { useEffect, useRef, useState } from 'react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { Loader2, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { invoicePdfRequest } from '@/lib/finance/invoice-pdf-request';
import { invoiceCustomer, initialInvoiceSelection, invoiceMailAccepted, invoiceMailBlock, invoiceRecipient, selectedInvoiceRows, type InvoiceCustomer, type InvoiceMailRow } from '@/lib/finance/recurring-invoice-mail';

type MailItem = InvoiceMailRow & { recipient: string; checked: boolean; result: string; attempted: boolean };
type Account = { customer_id: string; customer_name: string };
async function failureMessage(error: unknown) {
  if (error instanceof FunctionsHttpError) return await error.context.text();
  return error instanceof Error ? error.message : String(error);
}

export function RecurringInvoiceMailDialog({ open, onOpenChange, accounts, region }: {
  open: boolean; onOpenChange: (open: boolean) => void; accounts: Account[]; region: string;
}) {
  const [date, setDate] = useState('');
  const [rows, setRows] = useState<MailItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const lock = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    generation.current += 1;
    if (open) { setDate(''); void loadInvoices(''); }
    return () => { generation.current += 1; };
  }, [open]);

  const eligible = rows.filter(row => row.checked && !row.attempted && !invoiceMailBlock(row) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.recipient));
  async function loadInvoices(invoiceDate = date) {
    if (lock.current) return;
    const current = ++generation.current;
    setLoading(true); setError(''); setLoaded(false); setRows([]);
    try {
      const ids = accounts.map(account => account.customer_id).filter(id => id && !id.startsWith('name:'));
      if (!ids.length) throw new Error('Keine eindeutigen Kunden-IDs in der Auswahl.');
      const customers: InvoiceCustomer[] = [];
      for (const column of ['id', 'external_customer_id'] as const) {
        const lookupIds = ids.filter(id => column === 'id' ? /^[0-9a-f-]{36}$/i.test(id) : !/^[0-9a-f-]{36}$/i.test(id));
        for (let start = 0; start < lookupIds.length; start += 30) {
          for (let offset = 0; ; offset += 100) {
            const { data, error: customerError } = await supabase.from('customers')
              .select('id,external_customer_id,source_system,email').in(column, lookupIds.slice(start, start + 30))
              .order('id').range(offset, offset + 99);
            if (customerError) throw customerError;
            if (current !== generation.current) return;
            customers.push(...(data || []));
            if ((data || []).length < 100) break;
          }
        }
      }
      const queryIds = [...new Set([...ids, ...customers.flatMap(customer => [customer.id, customer.external_customer_id || '']).filter(Boolean)])];
      const found: InvoiceMailRow[] = [];
      const cols = 'id,zoho_invoice_id,customer_id,customer_name,invoice_number,invoice_date,status,total,currency,source_system,raw_data';
      for (let start = 0; start < queryIds.length; start += 30) {
        for (const table of ['zoho_invoices', 'zoho_recurring_invoices'] as const) {
          for (let offset = 0; ; offset += 100) {
            let query = supabase.from(table).select(cols)
              .in('customer_id', queryIds.slice(start, start + 30)).eq('accounting_region', region === 'CH' ? 'CH' : 'EU');
            if (invoiceDate) query = query.eq('invoice_date', invoiceDate);
            const { data, error: queryError } = await query.order('invoice_date', { ascending: false }).order('id').range(offset, offset + 99);
            if (queryError) throw queryError;
            if (current !== generation.current) return;
            found.push(...(data || []) as InvoiceMailRow[]);
            if ((data || []).length < 100) break;
          }
        }
      }
      const mapped = found.flatMap(row => {
        const customer = invoiceCustomer(row, customers);
        if (customer) return [{ ...row, customer_id: customer.id }];
        return ids.includes(row.customer_id || '') ? [row] : [];
      });
      const selectedIds = [...new Set([...ids, ...customers.filter(customer => ids.includes(customer.id) || ids.includes(customer.external_customer_id || '')).map(customer => customer.id)])];
      const selected = selectedInvoiceRows(mapped, selectedIds, invoiceDate).sort((a, b) => (b.invoice_date || '').localeCompare(a.invoice_date || ''));
      const initialSelection = initialInvoiceSelection(selected, invoiceDate);
      const items: MailItem[] = [];
      for (const row of selected) {
        let recipient = invoiceRecipient(row.raw_data);
        if (!recipient) recipient = invoiceCustomer(row, customers)?.email || '';
        const blocked = invoiceMailBlock(row);
        items.push({ ...row, raw_data: undefined, recipient, checked: initialSelection.has(row.id), attempted: false, result: blocked || '' });
      }
      if (current === generation.current) { setRows(items); setLoaded(true); }
    } catch (e) { if (current === generation.current) setError(await failureMessage(e)); }
    finally { if (current === generation.current) setLoading(false); }
  }

  async function sendSelected() {
    if (lock.current || !eligible.length) return;
    lock.current = true; setSending(true); setError('');
    const snapshot = [...eligible];
    const update = (id: string, patch: Partial<MailItem>) => setRows(prev => prev.map(row => row.id === id ? { ...row, ...patch } : row));
    try {
      for (const row of snapshot) {
        update(row.id, { result: 'PDF wird geladen …' });
        let pdf: string;
        try {
          const { data, error: pdfError } = await supabase.functions.invoke('zoho-invoice-pdf', { body: invoicePdfRequest(row) });
          if (pdfError) throw new Error(await failureMessage(pdfError));
          if (data?.error || !data?.pdf_base64) throw new Error(data?.error || 'Kein Rechnungs-PDF erhalten');
          pdf = data.pdf_base64;
        } catch (e) { update(row.id, { result: `Nicht gesendet: ${await failureMessage(e)}`, attempted: true }); continue; }
        update(row.id, { result: 'Wird gesendet …', attempted: true });
        const number = row.invoice_number || row.zoho_invoice_id;
        const invoiceDate = row.invoice_date ? ` vom ${row.invoice_date.slice(0, 10).split('-').reverse().join('.')}` : '';
        const text = `Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie Ihre Rechnung ${number}${invoiceDate} als PDF.\n\nBereits geleistete Zahlungen bleiben berücksichtigt.\n\nMit freundlichen Grüßen\nAlix Lasers | Finance`;
        try {
          const { data, error: mailError } = await supabase.functions.invoke('send-mail', { body: {
            to_email: row.recipient.trim(), to_name: row.customer_name,
            from_email: 'finance@alixwork.de', from_name: 'Alix Lasers | Finance',
            subject: `Ihre Rechnung ${number} – Alix Lasers`, body_text: text,
            customer_id: row.customer_id && /^[0-9a-f-]{36}$/i.test(row.customer_id) ? row.customer_id : null,
            attachments: [{ filename: `Rechnung_${number.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`, content: pdf, contentType: 'application/pdf' }],
          } });
          if (mailError) throw new Error(await failureMessage(mailError));
          if (!invoiceMailAccepted(data)) throw new Error(data?.error || 'Versand nicht bestätigt; nicht automatisch erneut senden.');
          update(row.id, { result: 'Vom Versanddienst angenommen' });
        } catch (e) {
          update(row.id, { result: `Versand nicht bestätigt: ${await failureMessage(e)}` });
          setError('Versand angehalten. Den letzten Versand im Mailcenter prüfen, bevor erneut versendet wird. Übrige Rechnungen wurden nicht versendet.');
          break;
        }
      }
    } finally { lock.current = false; setSending(false); }
  }

  return <Dialog open={open} onOpenChange={value => { if (!sending && !loading) onOpenChange(value); }}>
    <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
      <DialogHeader><DialogTitle>Rechnungen per E-Mail</DialogTitle>
        <DialogDescription>{accounts.length} markierte Kundenkonten · Absender finance@alixwork.de · Rechnungs-PDF als Anhang</DialogDescription>
      </DialogHeader>
      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-sm space-y-1">Rechnungsdatum (optional)<Input type="date" value={date} disabled={loading || sending || rows.some(row => row.attempted)} onChange={e => { setDate(e.target.value); setLoaded(false); setRows([]); }} /></label>
        {date && <Button variant="outline" disabled={loading || sending || rows.some(row => row.attempted)} onClick={() => { setDate(''); setLoaded(false); setRows([]); }}>Alle Daten</Button>}
        <Button variant="outline" disabled={loading || sending || rows.some(row => row.attempted)} onClick={() => loadInvoices()}>{loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Rechnungen laden</Button>
      </div>
      {error && <p role="alert" className="text-sm text-destructive break-words">{error}</p>}
      {loaded && <p className="text-sm text-muted-foreground">{rows.length} Rechnungen · {rows.filter(row => row.checked).length} ausgewählt · {eligible.length} versandbereit{!date ? ' · Neueste Rechnungen je Kundenkonto vorausgewählt' : ''}{accounts.some(account => account.customer_id.startsWith('name:')) ? ' · Kunden ohne eindeutige ID ausgeschlossen' : ''}</p>}
      <div className="overflow-auto min-h-0 border border-border rounded-md">
        <table className="w-full text-sm"><thead className="bg-muted sticky top-0"><tr>
          <th className="p-3"><Checkbox aria-label="Alle Rechnungen auswählen" disabled={sending} checked={rows.some(row => !row.attempted && !invoiceMailBlock(row)) && rows.filter(row => !row.attempted && !invoiceMailBlock(row)).every(row => row.checked)} onCheckedChange={value => setRows(prev => prev.map(row => row.attempted || invoiceMailBlock(row) ? row : { ...row, checked: value === true }))} /></th>
          <th className="p-3 text-left">Kunde / Rechnung</th><th className="p-3 text-left">E-Mail</th><th className="p-3 text-right">Betrag</th><th className="p-3 text-left">Versandstatus</th>
        </tr></thead><tbody>{rows.map(row => <tr key={row.id} className="border-t border-border">
          <td className="p-3"><Checkbox aria-label={`Rechnung ${row.invoice_number} auswählen`} checked={row.checked} disabled={sending || row.attempted || !!invoiceMailBlock(row)} onCheckedChange={value => setRows(prev => prev.map(item => item.id === row.id ? { ...item, checked: value === true } : item))} /></td>
          <td className="p-3"><div>{row.customer_name}</div><div className="text-muted-foreground">{row.invoice_number}{row.invoice_date ? ` · ${row.invoice_date.slice(0, 10).split('-').reverse().join('.')}` : ''}</div></td>
          <td className="p-3 min-w-[220px]"><Input aria-label={`E-Mail für ${row.invoice_number}`} type="email" value={row.recipient} disabled={sending || row.attempted} onChange={e => setRows(prev => prev.map(item => item.id === row.id ? { ...item, recipient: e.target.value } : item))} /></td>
          <td className="p-3 text-right whitespace-nowrap">{new Intl.NumberFormat('de-DE', { style: 'currency', currency: row.currency || 'EUR' }).format(row.total || 0)}</td>
          <td className="p-3 max-w-[260px] break-words">{row.result || (row.recipient ? 'Bereit' : 'E-Mail fehlt')}</td>
        </tr>)}</tbody></table>
        {loaded && !rows.length && <p className="p-6 text-center text-muted-foreground">{date ? 'Keine Rechnungen für dieses Datum gefunden. Wählen Sie „Alle Daten“, um ältere Rechnungen zu laden.' : 'Keine gespeicherten Rechnungen für die ausgewählten Kundenkonten gefunden.'}</p>}
      </div>
      <DialogFooter><Button variant="outline" disabled={sending || loading} onClick={() => onOpenChange(false)}>Schließen</Button>
        <Button disabled={sending || loading || !eligible.length} onClick={sendSelected}>{sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}{sending ? 'Versand läuft …' : `${eligible.length} ausgewählte Rechnungen senden`}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
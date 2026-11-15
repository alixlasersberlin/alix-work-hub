import { useEffect, useRef, useState } from 'react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { Loader2, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { invoicePdfRequest } from '@/lib/finance/invoice-pdf-request';
import { invoiceMailAccepted, invoiceMailBlock, invoiceRecipient, selectedInvoiceRows, type InvoiceMailRow } from '@/lib/finance/recurring-invoice-mail';

type MailItem = InvoiceMailRow & { recipient: string; checked: boolean; result: string; attempted: boolean };
type Account = { customer_id: string; customer_name: string };
async function failureMessage(error: unknown) {
  if (error instanceof FunctionsHttpError) return await error.context.text();
  return error instanceof Error ? error.message : String(error);
}

export function RecurringInvoiceMailDialog({ open, onOpenChange, accounts, region }: {
  open: boolean; onOpenChange: (open: boolean) => void; accounts: Account[]; region: string;
}) {
  const [date, setDate] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [rows, setRows] = useState<MailItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const lock = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    generation.current += 1;
    if (open) { setRows([]); setLoaded(false); setError(''); }
    return () => { generation.current += 1; };
  }, [open]);

  const eligible = rows.filter(row => row.checked && !row.attempted && !invoiceMailBlock(row) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.recipient));
  async function loadInvoices() {
    if (lock.current) return;
    const current = ++generation.current;
    setLoading(true); setError(''); setLoaded(false); setRows([]);
    try {
      const ids = accounts.map(account => account.customer_id).filter(id => id && !id.startsWith('name:'));
      if (!ids.length) throw new Error('Keine eindeutigen Kunden-IDs in der Auswahl.');
      const found: InvoiceMailRow[] = [];
      const cols = 'id,zoho_invoice_id,customer_id,customer_name,invoice_number,invoice_date,status,total,currency,source_system,raw_data';
      for (let start = 0; start < ids.length; start += 30) {
        for (const table of ['zoho_invoices', 'zoho_recurring_invoices'] as const) {
          for (let offset = 0; ; offset += 100) {
            const { data, error: queryError } = await supabase.from(table).select(cols)
              .in('customer_id', ids.slice(start, start + 30)).eq('accounting_region', region === 'CH' ? 'CH' : 'EU')
              .eq('invoice_date', date).order('id').range(offset, offset + 99);
            if (queryError) throw queryError;
            if (current !== generation.current) return;
            found.push(...(data || []) as InvoiceMailRow[]);
            if ((data || []).length < 100) break;
          }
        }
      }
      const selected = selectedInvoiceRows(found, ids);
      const items: MailItem[] = [];
      for (const row of selected) {
        let recipient = invoiceRecipient(row.raw_data);
        if (!recipient && row.customer_id && /^[0-9a-f-]{36}$/i.test(row.customer_id)) {
          const { data, error: customerError } = await supabase.from('customers').select('email').eq('id', row.customer_id).maybeSingle();
          if (customerError) throw customerError;
          recipient = data?.email || '';
        }
        const blocked = invoiceMailBlock(row);
        items.push({ ...row, raw_data: undefined, recipient, checked: !blocked, attempted: false, result: blocked || '' });
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
        const text = `Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie Ihre Rechnung ${number} vom ${date.split('-').reverse().join('.')} als PDF.\n\nBereits geleistete Zahlungen bleiben berücksichtigt.\n\nMit freundlichen Grüßen\nAlix Lasers | Finance`;
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
        <label className="text-sm space-y-1">Rechnungsdatum<Input type="date" value={date} disabled={loading || sending || rows.some(row => row.attempted)} onChange={e => { setDate(e.target.value); setLoaded(false); setRows([]); }} /></label>
        <Button variant="outline" disabled={!date || loading || sending || rows.some(row => row.attempted)} onClick={loadInvoices}>{loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Rechnungen laden</Button>
      </div>
      {error && <p role="alert" className="text-sm text-destructive break-words">{error}</p>}
      {loaded && <p className="text-sm text-muted-foreground">{rows.length} Rechnungen · {eligible.length} versandbereit{accounts.some(account => account.customer_id.startsWith('name:')) ? ' · Kunden ohne eindeutige ID ausgeschlossen' : ''}</p>}
      <div className="overflow-auto min-h-0 border border-border rounded-md">
        <table className="w-full text-sm"><thead className="bg-muted sticky top-0"><tr>
          <th className="p-3"><Checkbox aria-label="Alle Rechnungen auswählen" disabled={sending} checked={rows.some(row => !row.attempted && !invoiceMailBlock(row)) && rows.filter(row => !row.attempted && !invoiceMailBlock(row)).every(row => row.checked)} onCheckedChange={value => setRows(prev => prev.map(row => row.attempted || invoiceMailBlock(row) ? row : { ...row, checked: value === true }))} /></th>
          <th className="p-3 text-left">Kunde / Rechnung</th><th className="p-3 text-left">E-Mail</th><th className="p-3 text-right">Betrag</th><th className="p-3 text-left">Versandstatus</th>
        </tr></thead><tbody>{rows.map(row => <tr key={row.id} className="border-t border-border">
          <td className="p-3"><Checkbox aria-label={`Rechnung ${row.invoice_number} auswählen`} checked={row.checked} disabled={sending || row.attempted || !!invoiceMailBlock(row)} onCheckedChange={value => setRows(prev => prev.map(item => item.id === row.id ? { ...item, checked: value === true } : item))} /></td>
          <td className="p-3"><div>{row.customer_name}</div><div className="text-muted-foreground">{row.invoice_number}</div></td>
          <td className="p-3 min-w-[220px]"><Input aria-label={`E-Mail für ${row.invoice_number}`} type="email" value={row.recipient} disabled={sending || row.attempted} onChange={e => setRows(prev => prev.map(item => item.id === row.id ? { ...item, recipient: e.target.value } : item))} /></td>
          <td className="p-3 text-right whitespace-nowrap">{new Intl.NumberFormat('de-DE', { style: 'currency', currency: row.currency || 'EUR' }).format(row.total || 0)}</td>
          <td className="p-3 max-w-[260px] break-words">{row.result || (row.recipient ? 'Bereit' : 'E-Mail fehlt')}</td>
        </tr>)}</tbody></table>
        {loaded && !rows.length && <p className="p-6 text-center text-muted-foreground">Keine Rechnungen für dieses Datum gefunden.</p>}
      </div>
      <DialogFooter><Button variant="outline" disabled={sending || loading} onClick={() => onOpenChange(false)}>Schließen</Button>
        <Button disabled={sending || loading || !eligible.length} onClick={sendSelected}>{sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}{sending ? 'Versand läuft …' : `${eligible.length} ausgewählte Rechnungen senden`}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
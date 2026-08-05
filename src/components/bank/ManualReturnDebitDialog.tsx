import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Search, Undo2, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  createManualReturnDebit, searchInvoicesForReturn, searchCustomersForReturn, RETURN_CODES,
} from '@/lib/bank/returnDebit';
import { listBankAccounts } from '@/lib/bank/api';

const fmt = (n: number, cur = 'EUR') =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: cur || 'EUR' }).format(n || 0);

export default function ManualReturnDebitDialog({
  region, open, onOpenChange, onCreated,
}: {
  region: 'EU' | 'CH';
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [bankAccountId, setBankAccountId] = useState('');
  const [bookingDate, setBookingDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [valueDate, setValueDate] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(region === 'CH' ? 'CHF' : 'EUR');
  const [returnCode, setReturnCode] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [bankFee, setBankFee] = useState('');
  const [customerFee, setCustomerFee] = useState('');
  const [iban, setIban] = useState('');
  const [mandate, setMandate] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const [invTerm, setInvTerm] = useState('');
  const [invResults, setInvResults] = useState<any[]>([]);
  const [invLoading, setInvLoading] = useState(false);
  const [invoice, setInvoice] = useState<any | null>(null);

  const [custTerm, setCustTerm] = useState('');
  const [custResults, setCustResults] = useState<any[]>([]);
  const [custLoading, setCustLoading] = useState(false);
  const [customer, setCustomer] = useState<any | null>(null);

  useEffect(() => {
    if (!open) return;
    setBankAccountId(''); setBookingDate(new Date().toISOString().slice(0, 10)); setValueDate('');
    setAmount(''); setCurrency(region === 'CH' ? 'CHF' : 'EUR'); setReturnCode(''); setReturnReason('');
    setBankFee(''); setCustomerFee(''); setIban(''); setMandate(''); setNote('');
    setInvTerm(''); setInvoice(null); setCustTerm(''); setCustomer(null);
    listBankAccounts(region).then(a => setAccounts(a as any[])).catch(() => setAccounts([]));
  }, [open, region]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      setInvLoading(true);
      try { setInvResults(await searchInvoicesForReturn(region, invTerm)); }
      catch { setInvResults([]); }
      finally { setInvLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [invTerm, open, region]);

  useEffect(() => {
    if (!open || custTerm.trim().length < 2) { setCustResults([]); return; }
    const t = setTimeout(async () => {
      setCustLoading(true);
      try { setCustResults(await searchCustomersForReturn(custTerm)); }
      catch { setCustResults([]); }
      finally { setCustLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [custTerm, open]);

  const pickInvoice = (inv: any) => {
    setInvoice(inv);
    if (!amount) setAmount(String(Number(inv.balance ?? inv.total ?? 0) || ''));
    if (inv.currency) setCurrency(inv.currency);
    if (inv.customer_id && !customer) {
      setCustomer({ id: inv.customer_id, company_name: inv.customer_name });
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await createManualReturnDebit({
        area: region,
        bankAccountId: bankAccountId || null,
        bookingDate,
        valueDate: valueDate || null,
        amount: Number(String(amount).replace(',', '.')),
        currency,
        returnCode: returnCode || null,
        returnReason: returnReason || (returnCode ? RETURN_CODES[returnCode] : null),
        bankFee: Number(String(bankFee || 0).replace(',', '.')),
        customerFee: Number(String(customerFee || 0).replace(',', '.')),
        customerId: customer?.id ?? null,
        customerName: customer?.company_name || customer?.contact_name || null,
        invoiceId: invoice?.id ?? null,
        invoiceNumber: invoice?.invoice_number ?? null,
        iban: iban || null,
        mandateReference: mandate || null,
        note: note || null,
      });
      toast.success('Rücklastschrift manuell erfasst');
      onCreated();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Undo2 className="w-4 h-4 text-red-500" />Rücklastschrift manuell erfassen
          </DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Rechnungssuche */}
          <div className="space-y-2">
            <Label>Rechnung suchen</Label>
            {invoice ? (
              <div className="flex items-center justify-between rounded-md border border-border p-2 text-sm">
                <div>
                  <div className="font-medium">{invoice.invoice_number}</div>
                  <div className="text-xs text-muted-foreground">
                    {invoice.customer_name ?? '–'} · offen {fmt(Number(invoice.balance ?? 0), invoice.currency)}
                    {invoice.__src === 'recurring' && ' · wiederkehrend'}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setInvoice(null)}><X className="w-4 h-4" /></Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-2 top-2.5 text-muted-foreground" />
                  <Input className="pl-8" placeholder="Rechnungsnr., Kunde, Referenz …"
                    value={invTerm} onChange={e => setInvTerm(e.target.value)} />
                </div>
                <div className="max-h-52 overflow-y-auto rounded-md border border-border divide-y divide-border">
                  {invLoading && <div className="p-3 flex justify-center"><Loader2 className="w-4 h-4 animate-spin" /></div>}
                  {!invLoading && !invResults.length && <div className="p-3 text-xs text-muted-foreground">Keine Treffer.</div>}
                  {invResults.map(i => (
                    <button key={`${i.__src}-${i.id}`} type="button" onClick={() => pickInvoice(i)}
                      className="w-full text-left p-2 hover:bg-muted/40 text-xs">
                      <div className="flex justify-between gap-2">
                        <span className="font-medium">{i.invoice_number}</span>
                        <span>{fmt(Number(i.balance ?? 0), i.currency)}</span>
                      </div>
                      <div className="text-muted-foreground truncate">
                        {i.customer_name ?? '–'} · {i.invoice_date ?? '–'}
                        {i.__src === 'recurring' && <Badge variant="outline" className="ml-1">wiederkehrend</Badge>}
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Kundensuche */}
          <div className="space-y-2">
            <Label>Kunde suchen</Label>
            {customer ? (
              <div className="flex items-center justify-between rounded-md border border-border p-2 text-sm">
                <div>
                  <div className="font-medium">{customer.company_name || customer.contact_name}</div>
                  <div className="text-xs text-muted-foreground">{customer.email ?? customer.external_customer_id ?? ''}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setCustomer(null)}><X className="w-4 h-4" /></Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-2 top-2.5 text-muted-foreground" />
                  <Input className="pl-8" placeholder="Firma, Name, E-Mail, Kundennr. …"
                    value={custTerm} onChange={e => setCustTerm(e.target.value)} />
                </div>
                <div className="max-h-52 overflow-y-auto rounded-md border border-border divide-y divide-border">
                  {custLoading && <div className="p-3 flex justify-center"><Loader2 className="w-4 h-4 animate-spin" /></div>}
                  {!custLoading && !custResults.length && <div className="p-3 text-xs text-muted-foreground">Mind. 2 Zeichen eingeben.</div>}
                  {custResults.map(c => (
                    <button key={c.id} type="button" onClick={() => setCustomer(c)}
                      className="w-full text-left p-2 hover:bg-muted/40 text-xs">
                      <div className="font-medium">{c.company_name || c.contact_name}</div>
                      <div className="text-muted-foreground truncate">
                        {[c.external_customer_id, c.zip_code, c.city, c.email].filter(Boolean).join(' · ')}
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label>Buchungsdatum *</Label>
            <Input type="date" value={bookingDate} onChange={e => setBookingDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Valutadatum</Label>
            <Input type="date" value={valueDate} onChange={e => setValueDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Bankkonto</Label>
            <select className="h-10 w-full rounded-md border border-border bg-background px-2 text-sm"
              value={bankAccountId} onChange={e => setBankAccountId(e.target.value)}>
              <option value="">– kein Konto –</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.bank_name} · {a.account_name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Betrag *</Label>
            <Input inputMode="decimal" placeholder="0,00" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Währung</Label>
            <select className="h-10 w-full rounded-md border border-border bg-background px-2 text-sm"
              value={currency} onChange={e => setCurrency(e.target.value)}>
              <option value="EUR">EUR</option><option value="CHF">CHF</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label>Rückgabecode</Label>
            <select className="h-10 w-full rounded-md border border-border bg-background px-2 text-sm"
              value={returnCode} onChange={e => { setReturnCode(e.target.value); setReturnReason(RETURN_CODES[e.target.value] ?? ''); }}>
              <option value="">– kein Code –</option>
              {Object.entries(RETURN_CODES).map(([k, v]) => <option key={k} value={k}>{k} · {v}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Bankgebühr</Label>
            <Input inputMode="decimal" placeholder="0,00" value={bankFee} onChange={e => setBankFee(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Kundengebühr</Label>
            <Input inputMode="decimal" placeholder="0,00" value={customerFee} onChange={e => setCustomerFee(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Mandatsreferenz</Label>
            <Input value={mandate} onChange={e => setMandate(e.target.value)} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Grund</Label>
            <Input value={returnReason} onChange={e => setReturnReason(e.target.value)} placeholder="z. B. Kontodeckung nicht ausreichend" />
          </div>
          <div className="space-y-1">
            <Label>IBAN des Kunden</Label>
            <Input value={iban} onChange={e => setIban(e.target.value)} />
          </div>
          <div className="space-y-1 md:col-span-3">
            <Label>Notiz</Label>
            <Textarea rows={2} value={note} onChange={e => setNote(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={save} disabled={saving || !amount || !bookingDate}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Rücklastschrift anlegen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

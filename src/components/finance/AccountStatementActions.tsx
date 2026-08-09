import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { FileDown, Mail, Loader2, FileSpreadsheet, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { generateKontoauszugPdf, type KontoauszugItem } from '@/lib/finance/kontoauszug-pdf';

type AnyRow = {
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  total: number | null;
  balance: number | null;
  currency: string | null;
  status: string | null;
  payment_status?: string | null;
  raw_data?: any;
};

type Props = {
  customerName: string;
  customerNumber?: string | null;
  city?: string | null;
  rows: AnyRow[];
};

const money = (n: number, c = 'EUR') =>
  Number(n || 0).toLocaleString('de-DE', { style: 'currency', currency: c || 'EUR' });

function emailFromRows(rows: AnyRow[]): string {
  for (const r of rows) {
    const rd = r.raw_data || {};
    const cand = rd.email || rd.customer_email || rd.contact_person_details?.[0]?.email;
    if (typeof cand === 'string' && cand.includes('@')) return cand;
  }
  return '';
}

function formatAddress(a: any, customerName?: string): string | null {
  if (!a || typeof a !== 'object') return null;
  const parts = [
    a.attention && a.attention !== customerName ? a.attention : null,
    a.address || a.street,
    a.street2,
    [a.zip || a.postal_code, a.city].filter(Boolean).join(' '),
    [a.state, a.country].filter(Boolean).join(', '),
  ]
    .filter((p) => p && String(p).trim())
    .map(String);
  return parts.length ? parts.join('\n') : null;
}

/** Rechnungs- und Lieferanschrift aus den Zoho-Rohdaten ermitteln. */
function addressesFromRows(rows: AnyRow[]): { billing: string | null; shipping: string | null } {
  let billing: string | null = null;
  let shipping: string | null = null;
  for (const r of rows) {
    const rd = r.raw_data || {};
    if (!billing) billing = formatAddress(rd.billing_address, rd.customer_name);
    if (!shipping) shipping = formatAddress(rd.shipping_address, rd.customer_name);
    if (billing && shipping) break;
  }
  return normalizeAddresses(billing, shipping);
}

function normalizeAddresses(billing: string | null, shipping: string | null) {
  // Wenn nur eine Anschrift vorhanden ist, nur diese verwenden
  if (billing && shipping && billing === shipping) shipping = null;
  if (!billing && shipping) {
    billing = shipping;
    shipping = null;
  }
  return { billing, shipping };
}

/** Fallback: Anschrift aus der Kundenstammdaten-Tabelle laden. */
async function addressesFromCustomer(
  customerName: string,
  customerNumber?: string | null,
): Promise<{ billing: string | null; shipping: string | null }> {
  try {
    let query = supabase.from('customers').select('company_name, contact_name, billing_address, shipping_address');
    query = customerNumber
      ? query.eq('external_customer_id', String(customerNumber))
      : query.eq('company_name', customerName);
    const { data } = await query.limit(1);
    let row = data?.[0];
    if (!row && customerName) {
      const { data: byName } = await supabase
        .from('customers')
        .select('company_name, contact_name, billing_address, shipping_address')
        .eq('company_name', customerName)
        .limit(1);
      row = byName?.[0];
    }
    if (!row) return { billing: null, shipping: null };
    return normalizeAddresses(
      formatAddress(row.billing_address, customerName),
      formatAddress(row.shipping_address, customerName),
    );
  } catch {
    return { billing: null, shipping: null };
  }
}

/** Fallback: E-Mail aus den Kundenstammdaten laden. */
async function emailFromCustomer(customerName: string, customerNumber?: string | null): Promise<string> {
  try {
    if (customerNumber) {
      const { data } = await supabase
        .from('customers')
        .select('email')
        .eq('external_customer_id', String(customerNumber))
        .limit(1);
      const mail = data?.[0]?.email;
      if (mail && String(mail).includes('@')) return String(mail);
    }
    if (customerName) {
      const { data } = await supabase
        .from('customers')
        .select('email')
        .eq('company_name', customerName)
        .limit(1);
      const mail = data?.[0]?.email;
      if (mail && String(mail).includes('@')) return String(mail);
    }
  } catch {
    /* ignore */
  }
  return '';
}





/** Kontoauszug (offene Posten) für ein Kundenkonto: PDF/CSV-Download und E-Mail mit Vorschau. */
export function AccountStatementActions({ customerName, customerNumber, city, rows }: Props) {
  const [mailOpen, setMailOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [text, setText] = useState('');

  const [mailAll, setMailAll] = useState(false);

  const toItem = (r: AnyRow): KontoauszugItem => ({
    invoice_number: r.invoice_number || '—',
    invoice_date: r.invoice_date,
    due_date: r.due_date,
    total: r.total,
    balance: r.balance != null ? Number(r.balance) : Number(r.total ?? 0),
    status: r.payment_status || r.status,
    currency: r.currency,
  });

  const sortByDate = (list: KontoauszugItem[]) =>
    [...list].sort((a, b) => new Date(a.invoice_date || 0).getTime() - new Date(b.invoice_date || 0).getTime());

  const items: KontoauszugItem[] = useMemo(() => {
    const map = new Map<string, KontoauszugItem>();
    rows.forEach((r) => {
      const st = String(r.payment_status || r.status || '').toLowerCase();
      const balance = r.balance != null ? Number(r.balance) : Number(r.total ?? 0);
      if (st === 'paid' || st === 'void' || st === 'draft' || st.includes('bezahlt') || st.includes('storn')) return;
      if (!(balance > 0)) return;
      const key = r.invoice_number || `${r.invoice_date}-${balance}`;
      if (map.has(key)) return;
      map.set(key, toItem(r));
    });
    return sortByDate([...map.values()]);
  }, [rows]);

  /** Alle Buchungen – auch bereits bezahlte/stornierte Rechnungen. */
  const allItems: KontoauszugItem[] = useMemo(() => {
    const map = new Map<string, KontoauszugItem>();
    rows.forEach((r) => {
      const balance = r.balance != null ? Number(r.balance) : Number(r.total ?? 0);
      const key = r.invoice_number || `${r.invoice_date}-${balance}`;
      if (map.has(key)) return;
      map.set(key, toItem(r));
    });
    return sortByDate([...map.values()]);
  }, [rows]);

  const currency = items[0]?.currency || allItems[0]?.currency || 'EUR';
  const openSum = items.reduce((s, i) => s + Number(i.balance ?? i.total ?? 0), 0);
  const addresses = useMemo(() => addressesFromRows(rows), [rows]);
  const fileBase = `Kontoauszug_${(customerName || 'Kunde').replace(/[^\w-]+/g, '_')}`;

  const buildDoc = async (showAll = false) => {
    let addr = addresses;
    if (!addr.billing) addr = await addressesFromCustomer(customerName, customerNumber);
    return generateKontoauszugPdf({
      customerName: customerName || 'Kunde',
      customerAddress: addr.billing,
      shippingAddress: addr.shipping,
      customerNumber: customerNumber ?? null,
      currency,
      items: showAll ? allItems : items,
      showAll,
    });
  };

  const guard = (showAll = false) => {
    const list = showAll ? allItems : items;
    if (!list.length) {
      toast.info(showAll ? 'Keine Buchungen für dieses Kundenkonto' : 'Keine offenen Posten für dieses Kundenkonto');
      return false;
    }
    return true;
  };

  const downloadPdf = async (showAll = false) => {
    if (!guard(showAll)) return;
    (await buildDoc(showAll)).save(`${fileBase}${showAll ? '_alle_Buchungen' : ''}.pdf`);
  };

  const downloadCsv = (showAll = false) => {
    if (!guard(showAll)) return;
    const list = showAll ? allItems : items;
    const head = ['Rechnung', 'Datum', 'Faellig', 'Betrag', 'Offen', 'Waehrung', 'Status'];
    const lines = list.map((i) =>
      [
        i.invoice_number,
        i.invoice_date ?? '',
        i.due_date ?? '',
        Number(i.total ?? 0).toFixed(2),
        Number(i.balance ?? i.total ?? 0).toFixed(2),
        i.currency || currency,
        i.status ?? '',
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(';'),
    );
    lines.push(['"Summe offen"', '""', '""', '""', `"${openSum.toFixed(2)}"`, `"${currency}"`, '""'].join(';'));
    const csv = '\uFEFF' + [head.join(';'), ...lines].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileBase}${showAll ? '_alle_Buchungen' : ''}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const refreshPreview = async (showAll: boolean) => {
    const doc = await buildDoc(showAll);
    setPreviewUrl(String(doc.output('bloburl')));
  };

  const openMail = async () => {
    if (!guard()) return;
    setMailAll(false);
    await refreshPreview(false);
    const fromRows = emailFromRows(rows);
    setTo(fromRows && fromRows.includes('@') ? fromRows : await emailFromCustomer(customerName, customerNumber));

    setSubject(`Kontoauszug ${new Date().toLocaleDateString('de-DE')}`);
    setText(
      `Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie Ihren aktuellen Kontoauszug mit einem offenen Gesamtsaldo von ${money(
        openSum,
        currency,
      )}.\n\nBitte gleichen Sie offene Posten zeitnah aus. Sollten sich Zahlungen überschnitten haben, betrachten Sie dieses Schreiben als gegenstandslos.\n\nMit freundlichen Grüßen\nAlix Lasers ®`,
    );
    setMailOpen(true);
  };

  const sendMail = async () => {
    if (!to.includes('@')) {
      toast.error('Bitte eine gültige E-Mail-Adresse angeben');
      return;
    }
    setSending(true);
    try {
      const base64 = ((await buildDoc(mailAll)).output('datauristring') as string).split(',')[1];
      const { error } = await supabase.functions.invoke('send-invoice-mail', {
        body: {
          to_email: to,
          to_name: customerName,
          subject: subject || 'Kontoauszug',
          body_text: text,
          invoice_number: `kontoauszug-${customerNumber || customerName}`,
          attachments: [{ filename: `${fileBase}.pdf`, content: base64, contentType: 'application/pdf' }],
        },
      });
      if (error) throw error;
      toast.success(`Kontoauszug an ${to} gesendet`);
      setMailOpen(false);
    } catch (e: any) {
      toast.error(e?.message || 'Versand fehlgeschlagen');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" className="h-8">
            <FileDown className="w-3.5 h-3.5 mr-1.5" /> Kontoauszug
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => downloadPdf(false)}>
            <FileText className="w-4 h-4 mr-2" /> Offene Posten – PDF
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => downloadCsv(false)}>
            <FileSpreadsheet className="w-4 h-4 mr-2" /> Offene Posten – CSV
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => downloadPdf(true)}>
            <FileText className="w-4 h-4 mr-2" /> Alle Buchungen – PDF
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => downloadCsv(true)}>
            <FileSpreadsheet className="w-4 h-4 mr-2" /> Alle Buchungen – CSV
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button size="sm" variant="outline" className="h-8" onClick={openMail}>
        <Mail className="w-3.5 h-3.5 mr-1.5" /> E-Mail
      </Button>

      <Dialog open={mailOpen} onOpenChange={setMailOpen}>
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Kontoauszug prüfen &amp; senden — {customerName}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 grid md:grid-cols-2 gap-4">
            <div className="min-h-[300px] border border-border rounded-lg overflow-hidden bg-neutral-900/40">
              {previewUrl && <iframe src={previewUrl} title="Kontoauszug" className="w-full h-full border-0 bg-white" />}
            </div>
            <div className="space-y-3 overflow-y-auto">
              <div>
                <Label className="text-xs">Empfänger</Label>
                <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="kunde@example.com" />
              </div>
              <div>
                <Label className="text-xs">Betreff</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Text</Label>
                <Textarea rows={12} value={text} onChange={(e) => setText(e.target.value)} />
              </div>
              <div className="flex items-center gap-2 rounded-md border border-border p-2">
                <Switch
                  id="ka-all"
                  checked={mailAll}
                  onCheckedChange={(v) => { setMailAll(v); void refreshPreview(v); }}
                />
                <Label htmlFor="ka-all" className="text-xs cursor-pointer">Alle Buchungen anzeigen (inkl. bezahlter)</Label>
              </div>
              <div className="text-xs text-muted-foreground">
                {mailAll
                  ? `${allItems.length} Buchungen · Gesamtsaldo ${money(openSum, currency)}`
                  : `${items.length} offene Posten · Gesamtsaldo ${money(openSum, currency)}`}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMailOpen(false)}>Abbrechen</Button>
            <Button onClick={sendMail} disabled={sending}>
              {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
              Senden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

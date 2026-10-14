import { useEffect, useMemo, useState } from 'react';
import { Undo2, Plus, Download, Mail, Search, Loader2 } from 'lucide-react';
import { generateCreditNotePdf } from '@/lib/finance/credit-note-pdf';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { splitGross, remainingCreditable } from '@/lib/finance/creditNote';

type Inv = { id: string; invoice_number: string | null; customer_name: string | null; customer_id: string | null; total: number | null; invoice_date: string | null; billing_address: any };
type Credit = { id: string; credit_note_number: string; original_invoice_id: string; reason: string; amount_gross: number; amount_net: number; amount_vat: number; vat_rate: number; is_partial: boolean; created_at: string; sent_at: string | null; sent_to: string | null; inv?: Inv };

const eur = (n: number | null | undefined) => (n ?? 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
const date = (s?: string | null) => (s ? new Date(s).toLocaleDateString('de-DE') : '–');

async function buildPdf(c: Credit) {
  const inv = c.inv;
  const addr = inv?.billing_address || {};
  const address = typeof addr === 'string' ? addr : [addr.attention, addr.address || addr.street, addr.street2, [addr.zip, addr.city].filter(Boolean).join(' '), addr.country].filter(Boolean).join('\n');
  return generateCreditNotePdf({
    creditNoteNumber: c.credit_note_number, date: c.created_at,
    customerName: inv?.customer_name || 'Kunde', customerAddress: address || null,
    invoiceNumber: inv?.invoice_number, invoiceDate: inv?.invoice_date,
    reason: c.reason, isPartial: c.is_partial,
    net: Number(c.amount_net), vat: Number(c.amount_vat), vatRate: Number(c.vat_rate), gross: Number(c.amount_gross),
  });
}

export default function Gutschriften() {
  const [list, setList] = useState<Credit[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Inv[]>([]);
  const [inv, setInv] = useState<Inv | null>(null);
  const [credited, setCredited] = useState(0);
  const [full, setFull] = useState(true);
  const [amount, setAmount] = useState('');
  const [vat, setVat] = useState('19');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [mail, setMail] = useState<{ c: Credit; to: string } | null>(null);
  const [sending, setSending] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any).from('invoice_corrections').select('*').eq('correction_type', 'gutschrift').not('credit_note_number', 'is', null).order('created_at', { ascending: false }).limit(500);
    const rows = (data || []) as Credit[];
    const ids = [...new Set(rows.map(r => r.original_invoice_id))];
    if (ids.length) {
      const { data: invs } = await supabase.from('zoho_invoices').select('id, invoice_number, customer_name, customer_id, total, invoice_date, billing_address').in('id', ids);
      const m = new Map((invs || []).map((i: any) => [i.id, i]));
      rows.forEach(r => (r.inv = m.get(r.original_invoice_id) as Inv));
    }
    setList(rows); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!open || q.trim().length < 2) { setHits([]); return; }
    const t = setTimeout(async () => {
      const s = q.trim().replace(/[,%()]/g, '');
      const { data } = await supabase.from('zoho_invoices').select('id, invoice_number, customer_name, customer_id, total, invoice_date, billing_address')
        .or(`invoice_number.ilike.%${s}%,customer_name.ilike.%${s}%`).order('invoice_date', { ascending: false }).limit(15);
      setHits((data || []) as Inv[]);
    }, 300);
    return () => clearTimeout(t);
  }, [q, open]);

  const pick = async (i: Inv) => {
    setInv(i); setHits([]); setQ('');
    const { data } = await (supabase as any).from('invoice_corrections').select('amount_gross').eq('original_invoice_id', i.id).eq('correction_type', 'gutschrift');
    const sum = (data || []).reduce((a: number, r: any) => a + Number(r.amount_gross || 0), 0);
    setCredited(sum);
    setAmount(String(remainingCreditable(i.total, sum) === Infinity ? '' : remainingCreditable(i.total, sum)));
  };

  const rest = inv ? remainingCreditable(inv.total, credited) : 0;
  const gross = full ? rest : Number(amount.replace(',', '.'));
  const split = useMemo(() => splitGross(Number.isFinite(gross) ? gross : 0, Number(vat)), [gross, vat]);

  const reset = () => { setInv(null); setQ(''); setReason(''); setFull(true); setAmount(''); setVat('19'); setCredited(0); };

  const save = async () => {
    if (!inv || !reason.trim() || !(gross > 0)) return;
    setSaving(true);
    const { error } = await (supabase as any).rpc('create_credit_note', { _original_invoice_id: inv.id, _amount_gross: gross, _vat_rate: Number(vat), _reason: reason.trim() });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Gutschrift erstellt');
    setOpen(false); reset(); load();
  };

  const openMail = async (c: Credit) => {
    let to = '';
    if (c.inv?.customer_id) {
      const { data } = await supabase.from('customers').select('email').eq('id', c.inv.customer_id).maybeSingle();
      to = (data as any)?.email || '';
    }
    setMail({ c, to });
  };

  const send = async () => {
    if (!mail?.to.includes('@')) return;
    setSending(true);
    try {
      const pdf = (await buildPdf(mail.c)).output('datauristring').split(',')[1];
      const { error } = await supabase.functions.invoke('send-mail', { body: {
        to_email: mail.to, to_name: mail.c.inv?.customer_name || undefined,
        subject: `Ihre Gutschrift ${mail.c.credit_note_number}`,
        body_html: `<p>Guten Tag,</p><p>anbei erhalten Sie die Gutschrift ${mail.c.credit_note_number} zur Rechnung ${mail.c.inv?.invoice_number || ''} über ${eur(mail.c.amount_gross)}.</p><p>Mit freundlichen Grüßen<br>Alix Lasers Deutschland</p>`,
        attachments: [{ filename: `${mail.c.credit_note_number}.pdf`, content: pdf, contentType: 'application/pdf' }],
      } });
      if (error) throw error;
      await (supabase as any).rpc('mark_credit_note_sent', { _id: mail.c.id, _to: mail.to });
      toast.success('Gutschrift versendet'); setMail(null); load();
    } catch (e: any) {
      toast.error('Versand fehlgeschlagen: ' + (e?.message || e));
    } finally { setSending(false); }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader icon={Undo2} title="Gutschriften" subtitle="Gutschriften zu Rechnungen erstellen, als PDF speichern und versenden." noBreadcrumbs />
      <div className="flex justify-end"><Button onClick={() => { reset(); setOpen(true); }}><Plus className="w-4 h-4 mr-2" />Neue Gutschrift</Button></div>
      <Card><CardContent className="p-0">
        {loading ? <div className="py-10 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
        : list.length === 0 ? <div className="py-10 text-center text-sm text-muted-foreground">Noch keine Gutschriften erstellt.</div>
        : <Table>
          <TableHeader><TableRow><TableHead>Nr.</TableHead><TableHead>Datum</TableHead><TableHead>Kunde</TableHead><TableHead>Rechnung</TableHead><TableHead>Grund</TableHead><TableHead className="text-right">Betrag</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>{list.map(c => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">{c.credit_note_number}</TableCell>
              <TableCell>{date(c.created_at)}</TableCell>
              <TableCell>{c.inv?.customer_name || '–'}</TableCell>
              <TableCell>{c.inv?.invoice_number || '–'}</TableCell>
              <TableCell className="max-w-[220px] truncate" title={c.reason}>{c.reason}</TableCell>
              <TableCell className="text-right">{eur(c.amount_gross)}</TableCell>
              <TableCell>{c.sent_at ? <Badge variant="secondary" title={c.sent_to || ''}>versendet {date(c.sent_at)}</Badge> : <Badge variant="outline">{c.is_partial ? 'Teilgutschrift' : 'Voll'}</Badge>}</TableCell>
              <TableCell className="text-right whitespace-nowrap">
                <Button size="sm" variant="ghost" onClick={async () => (await buildPdf(c)).save(`${c.credit_note_number}.pdf`)}><Download className="w-4 h-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => openMail(c)}><Mail className="w-4 h-4" /></Button>
              </TableCell>
            </TableRow>))}
          </TableBody></Table>}
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Neue Gutschrift</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {!inv ? (
              <div className="space-y-2">
                <Label>Rechnung suchen</Label>
                <div className="relative"><Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Rechnungsnummer oder Kunde" value={q} onChange={e => setQ(e.target.value)} autoFocus /></div>
                <div className="max-h-64 overflow-auto space-y-1">{hits.map(h => (
                  <button key={h.id} onClick={() => pick(h)} className="w-full text-left p-2 rounded border border-border hover:border-primary text-sm">
                    <div className="font-medium">{h.invoice_number} · {eur(h.total)}</div>
                    <div className="text-muted-foreground">{h.customer_name} · {date(h.invoice_date)}</div>
                  </button>))}
                  {q.trim().length >= 2 && hits.length === 0 && (
                    <div className="text-sm text-muted-foreground p-2">Keine Rechnung gefunden. Bitte Rechnungsnummer (z. B. RE-SO-4143) oder Kundennamen eingeben.</div>
                  )}</div>
              </div>
            ) : (<>
              <div className="p-3 rounded border border-border text-sm">
                <div className="font-medium">{inv.invoice_number} · {inv.customer_name}</div>
                <div className="text-muted-foreground">Rechnungsbetrag {eur(inv.total)} · bereits gutgeschrieben {eur(credited)} · noch möglich {rest === Infinity ? '–' : eur(rest)}</div>
                <button className="text-primary text-xs mt-1" onClick={() => setInv(null)}>Andere Rechnung wählen</button>
              </div>
              {rest === 0 ? <p className="text-sm text-destructive">Diese Rechnung ist bereits vollständig gutgeschrieben.</p> : <>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant={full ? 'default' : 'outline'} onClick={() => setFull(true)} disabled={rest === Infinity}>Ganze Rechnung</Button>
                  <Button type="button" size="sm" variant={!full ? 'default' : 'outline'} onClick={() => setFull(false)}>Teilbetrag</Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Betrag brutto (€)</Label><Input value={full && rest !== Infinity ? String(rest) : amount} disabled={full && rest !== Infinity} onChange={e => setAmount(e.target.value)} inputMode="decimal" /></div>
                  <div><Label>USt. %</Label><Input value={vat} onChange={e => setVat(e.target.value)} inputMode="decimal" /></div>
                </div>
                <div className="text-xs text-muted-foreground">Netto {eur(split.net)} · USt. {eur(split.vat)}</div>
                {gross > rest && <p className="text-sm text-destructive">Betrag ist höher als der noch mögliche Betrag.</p>}
                <div><Label>Grund *</Label><Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="z. B. Preisnachlass, Rücksendung Zubehör" /></div>
              </>}
            </>)}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={save} disabled={!inv || saving || !reason.trim() || !(gross > 0) || gross > rest}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Gutschrift erstellen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!mail} onOpenChange={o => !o && setMail(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Gutschrift {mail?.c.credit_note_number} senden</DialogTitle></DialogHeader>
          <Label>E-Mail des Kunden</Label>
          <Input value={mail?.to || ''} onChange={e => mail && setMail({ ...mail, to: e.target.value })} placeholder="kunde@beispiel.de" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setMail(null)}>Abbrechen</Button>
            <Button onClick={send} disabled={sending || !mail?.to.includes('@')}>{sending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Senden</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

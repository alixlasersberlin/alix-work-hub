import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, Banknote, CalendarClock, FileText, History, Loader2, Mail, RefreshCw,
  Send, StickyNote, Wallet, X,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/infinity/PageHeader';
import { SkeletonTable } from '@/components/infinity/Skeleton';
import { EmptyState } from '@/components/infinity/EmptyState';
import { cn } from '@/lib/utils';

type OpenItem = {
  id: string;
  invoice_number: string | null;
  legal_invoice_number: string | null;
  customer_id: string | null;
  customer_name: string | null;
  invoice_date: string | null;
  due_date: string | null;
  total: number | null;
  balance: number | null;
  paid: number | null;
  currency: string | null;
  status: string | null;
  payment_status: string | null;
  zoho_invoice_id: string | null;
  source_system: string | null;
  days_overdue: number | null;
  dunning_level: number | null;
  last_action_at: string | null;
  last_action: string | null;
};

type Filter = 'alle' | 'heute' | 'ueberfaellig' | 'teilbezahlt' | 'stufe1' | 'stufe2' | 'stufe3' | 'stufe4';

const LEVEL_LABEL: Record<number, string> = {
  0: 'Keine Mahnung',
  1: 'Zahlungserinnerung',
  2: '1. Mahnung',
  3: '2. Mahnung',
  4: 'Letzte Mahnung',
};

const fmt = (n: number | null | undefined, currency?: string | null) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: currency || 'EUR' }).format(Number(n || 0));

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString('de-DE') : '—';

const fmtDateTime = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString('de-DE') : '—';

const invNo = (i: OpenItem) => i.legal_invoice_number || i.invoice_number || '—';

export default function OffenePostenLight() {
  const [items, setItems] = useState<OpenItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('alle');
  const [selected, setSelected] = useState<OpenItem | null>(null);
  const [history, setHistory] = useState<any | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Zahlung
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payMethod, setPayMethod] = useState('Bank');
  const [payRef, setPayRef] = useState('');
  const [payNote, setPayNote] = useState('');
  const [paying, setPaying] = useState(false);

  // Mahnung
  const [dunOpen, setDunOpen] = useState(false);
  const [dunLevel, setDunLevel] = useState(1);
  const [dunEmail, setDunEmail] = useState('');
  const [dunMessage, setDunMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Notiz
  const [note, setNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const [pdfLoading, setPdfLoading] = useState(false);
  const pdfCache = useRef<Map<string, string>>(new Map());

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('fibu_light_open_items');
    if (error) {
      toast.error(`Offene Posten konnten nicht geladen werden: ${error.message}`);
      setItems([]);
    } else {
      setItems((data as OpenItem[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const loadHistory = useCallback(async (invoiceId: string) => {
    setHistoryLoading(true);
    const { data, error } = await supabase.rpc('fibu_light_invoice_history', { p_invoice_id: invoiceId });
    if (error) toast.error(error.message);
    setHistory(error ? null : data);
    setHistoryLoading(false);
  }, []);

  const openPanel = useCallback(async (item: OpenItem) => {
    setSelected(item);
    setNote('');
    setHistory(null);
    void loadHistory(item.id);
  }, [loadHistory]);

  const kpis = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    let open = 0, overdue = 0, dueToday = 0, lvl1 = 0, lvl2 = 0;
    for (const i of items) {
      const bal = Number(i.balance || 0);
      open += bal;
      if ((i.days_overdue ?? 0) > 0) overdue += bal;
      if (i.due_date === today) dueToday += bal;
      const lv = Number(i.dunning_level || 0);
      if (lv === 2) lvl1 += 1;
      if (lv >= 3) lvl2 += 1;
    }
    return { open, overdue, dueToday, lvl1, lvl2 };
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const today = new Date().toISOString().slice(0, 10);
    return items.filter((i) => {
      if (q) {
        const hay = [i.customer_name, i.invoice_number, i.legal_invoice_number, i.id, i.customer_id]
          .filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const lv = Number(i.dunning_level || 0);
      switch (filter) {
        case 'heute': return i.due_date === today;
        case 'ueberfaellig': return (i.days_overdue ?? 0) > 0;
        case 'teilbezahlt': return Number(i.paid || 0) > 0;
        case 'stufe1': return lv === 1;
        case 'stufe2': return lv === 2;
        case 'stufe3': return lv === 3;
        case 'stufe4': return lv === 4;
        default: return true;
      }
    });
  }, [items, search, filter]);

  const nextAction = (item: OpenItem) => {
    const od = item.days_overdue ?? 0;
    const lv = Number(item.dunning_level || 0);
    if (od <= 0) return 'Noch nicht fällig – keine Aktion nötig.';
    if (lv === 0) return 'Empfehlung: Zahlungserinnerung senden';
    if (lv === 1) return 'Empfehlung: 1. Mahnung senden';
    if (lv === 2) return 'Empfehlung: 2. Mahnung senden';
    if (lv === 3) return 'Empfehlung: Letzte Mahnung senden';
    return 'Letzte Mahnung versendet – Übergabe an Finance/Inkasso prüfen.';
  };

  const openPdf = useCallback(async (item: OpenItem) => {
    if (!item.zoho_invoice_id) { toast.error('Für diese Rechnung ist kein PDF hinterlegt.'); return; }
    const cached = pdfCache.current.get(item.id);
    if (cached) { window.open(cached, '_blank'); return; }
    setPdfLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('zoho-invoice-pdf', {
        body: { zoho_invoice_id: item.zoho_invoice_id, source_system: item.source_system ?? 'zoho_eu_1' },
      });
      if (error) throw error;
      const b64 = (data as any)?.pdf_base64;
      if (!b64) throw new Error('Kein PDF erhalten');
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      pdfCache.current.set(item.id, url);
      window.open(url, '_blank');
    } catch (e: any) {
      toast.error(`PDF konnte nicht geladen werden: ${e?.message ?? e}`);
    } finally {
      setPdfLoading(false);
    }
  }, []);

  const startPayment = (item: OpenItem) => {
    setPayAmount(String(Number(item.balance || 0).toFixed(2)));
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayMethod('Bank');
    setPayRef(invNo(item));
    setPayNote('');
    setPayOpen(true);
  };

  const bookPayment = async (full: boolean) => {
    if (!selected) return;
    setPaying(true);
    try {
      const { data, error } = await supabase.rpc('fibu_light_book_payment', {
        p_invoice_id: selected.id,
        p_amount: full ? Number(selected.balance || 0) : Number(payAmount.replace(',', '.')),
        p_payment_date: payDate,
        p_method: payMethod,
        p_reference: payRef || null,
        p_note: payNote || null,
        p_full: full,
      });
      if (error) throw error;
      const res = data as any;
      toast.success(res?.closed
        ? 'Zahlung gebucht – offener Posten geschlossen.'
        : `Teilzahlung gebucht. Offen: ${fmt(res?.new_balance, selected.currency)}`);
      setPayOpen(false);
      setSelected(null);
      await load();
    } catch (e: any) {
      toast.error(`Zahlung konnte nicht gebucht werden: ${e?.message ?? e}`);
    } finally {
      setPaying(false);
    }
  };

  const startDunning = async (item: OpenItem, level: number) => {
    setDunLevel(level);
    setDunMessage('');
    setDunEmail('');
    setDunOpen(true);
    // Empfängeradresse best effort aus Kundenstamm
    const name = item.customer_name?.trim();
    if (name) {
      const { data } = await supabase.from('customers')
        .select('email, company_name, contact_name')
        .or(`company_name.ilike.${name},contact_name.ilike.${name}`)
        .limit(1);
      const mail = (data as any[])?.[0]?.email;
      if (mail) setDunEmail(mail);
    }
  };

  const sendDunning = async () => {
    if (!selected) return;
    const email = dunEmail.trim();
    if (!email.includes('@')) { toast.error('Bitte eine gültige Empfängeradresse eingeben.'); return; }
    setSending(true);
    const subject = `${LEVEL_LABEL[dunLevel]} – Rechnung ${invNo(selected)}`;
    try {
      const { data, error } = await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'finance-reminder',
          recipientEmail: email,
          templateData: {
            customerName: selected.customer_name,
            level: dunLevel,
            amount: Number(selected.balance || 0),
            total: Number(selected.balance || 0),
            dueDate: selected.due_date,
            items: [{
              invoice_number: invNo(selected),
              amount: Number(selected.balance || 0),
              due_date: selected.due_date,
              days_overdue: selected.days_overdue ?? 0,
            }],
            note: dunMessage || undefined,
          },
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      await supabase.rpc('fibu_light_log_dunning', {
        p_invoice_id: selected.id,
        p_level: dunLevel,
        p_recipient: email,
        p_subject: subject,
        p_message: dunMessage || null,
        p_open_amount: Number(selected.balance || 0),
        p_send_status: 'sent',
        p_error: null,
      });
      toast.success('E-Mail versendet und protokolliert.');
      setDunOpen(false);
      await load();
      await loadHistory(selected.id);
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      await supabase.rpc('fibu_light_log_dunning', {
        p_invoice_id: selected.id,
        p_level: dunLevel,
        p_recipient: email,
        p_subject: subject,
        p_message: dunMessage || null,
        p_open_amount: Number(selected.balance || 0),
        p_send_status: 'failed',
        p_error: msg.slice(0, 500),
      });
      toast.error(`Versand fehlgeschlagen: ${msg}`);
      await loadHistory(selected.id);
    } finally {
      setSending(false);
    }
  };

  const saveNote = async () => {
    if (!selected || !note.trim()) return;
    setSavingNote(true);
    const { error } = await supabase.rpc('fibu_light_add_note', { p_invoice_id: selected.id, p_note: note.trim() });
    if (error) toast.error(error.message);
    else { toast.success('Notiz gespeichert.'); setNote(''); await loadHistory(selected.id); }
    setSavingNote(false);
  };

  const statusBadge = (item: OpenItem) => {
    const od = item.days_overdue ?? 0;
    if (od > 0) return <Badge className="bg-destructive text-destructive-foreground">🔴 {od} Tage überfällig</Badge>;
    if (od === 0) return <Badge className="bg-amber-500 text-black">🟡 Heute fällig</Badge>;
    return <Badge variant="secondary">🟢 Offen</Badge>;
  };

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'alle', label: 'Alle' },
    { key: 'heute', label: 'Heute fällig' },
    { key: 'ueberfaellig', label: 'Überfällig' },
    { key: 'teilbezahlt', label: 'Teilbezahlt' },
    { key: 'stufe1', label: 'Erinnerung' },
    { key: 'stufe2', label: '1. Mahnung' },
    { key: 'stufe3', label: '2. Mahnung' },
    { key: 'stufe4', label: 'Letzte Mahnung' },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title="Offene Posten Light"
        subtitle="Vereinfachte Arbeitsoberfläche auf denselben Rechnungs-, Zahlungs- und Protokolldaten"
        icon={Wallet}
        noBreadcrumbs
        actions={
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} /> Aktualisieren
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Offen gesamt', value: fmt(kpis.open), icon: Banknote, tone: 'text-foreground' },
          { label: 'Überfällig', value: fmt(kpis.overdue), icon: AlertTriangle, tone: 'text-destructive' },
          { label: 'Heute fällig', value: fmt(kpis.dueToday), icon: CalendarClock, tone: 'text-amber-500' },
          { label: '1. Mahnung', value: String(kpis.lvl1), icon: Mail, tone: 'text-foreground' },
          { label: '2./letzte Mahnung', value: String(kpis.lvl2), icon: Mail, tone: 'text-destructive' },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <k.icon className="h-3.5 w-3.5" /> {k.label}
            </div>
            <div className={cn('text-xl font-semibold', k.tone)}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {FILTERS.map((f) => (
          <Button key={f.key} size="sm" variant={filter === f.key ? 'default' : 'outline'} onClick={() => setFilter(f.key)}>
            {f.label}
          </Button>
        ))}
        <div className="ml-auto w-full sm:w-72">
          <Input placeholder="Kunde, Rechnungsnummer oder ID …" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className={cn('grid gap-4', selected ? 'lg:grid-cols-[1fr_380px]' : 'grid-cols-1')}>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {loading ? (
            <div className="p-6"><SkeletonTable rows={8} cols={6} /></div>
          ) : filtered.length === 0 ? (
            <div className="p-8"><EmptyState title="Keine offenen Posten" description="Es sind derzeit keine offenen Forderungen vorhanden." /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-3">Kunde</th>
                    <th className="text-left px-3 py-3">Rechnung</th>
                    <th className="text-left px-3 py-3">Datum</th>
                    <th className="text-left px-3 py-3">Fällig</th>
                    <th className="text-right px-3 py-3">Betrag</th>
                    <th className="text-right px-3 py-3">Bezahlt</th>
                    <th className="text-right px-3 py-3">Offen</th>
                    <th className="text-left px-3 py-3">Status</th>
                    <th className="text-left px-3 py-3">Mahnstufe</th>
                    <th className="text-right px-3 py-3">Aktion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((i) => (
                    <tr key={i.id} className={cn('hover:bg-secondary/30', selected?.id === i.id && 'bg-secondary/40')}>
                      <td className="px-3 py-2">{i.customer_name || '—'}</td>
                      <td className="px-3 py-2 font-medium">{invNo(i)}</td>
                      <td className="px-3 py-2">{fmtDate(i.invoice_date)}</td>
                      <td className="px-3 py-2">{fmtDate(i.due_date)}</td>
                      <td className="px-3 py-2 text-right">{fmt(i.total, i.currency)}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{fmt(i.paid, i.currency)}</td>
                      <td className="px-3 py-2 text-right font-semibold">{fmt(i.balance, i.currency)}</td>
                      <td className="px-3 py-2">{statusBadge(i)}</td>
                      <td className="px-3 py-2 text-muted-foreground">{LEVEL_LABEL[Number(i.dunning_level || 0)]}</td>
                      <td className="px-3 py-2 text-right">
                        <Button size="sm" variant="outline" onClick={() => void openPanel(i)}>Bearbeiten</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selected && (
          <aside className="rounded-xl border border-border bg-card p-4 h-fit lg:sticky lg:top-4">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <div className="text-xs text-muted-foreground">{selected.customer_name}</div>
                <div className="text-lg font-semibold">{invNo(selected)}</div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setSelected(null)}><X className="h-4 w-4" /></Button>
            </div>

            <div className="space-y-1 text-sm mb-3">
              <div className="flex justify-between"><span className="text-muted-foreground">Rechnungsbetrag</span><span>{fmt(selected.total, selected.currency)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Bereits bezahlt</span><span>{fmt(selected.paid, selected.currency)}</span></div>
              <div className="flex justify-between font-semibold"><span>Offener Betrag</span><span>{fmt(selected.balance, selected.currency)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Fällig</span><span>{fmtDate(selected.due_date)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Tage überfällig</span><span>{Math.max(0, selected.days_overdue ?? 0)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Mahnstufe</span><span>{LEVEL_LABEL[Number(selected.dunning_level || 0)]}</span></div>
            </div>

            <div className="rounded-lg border border-border bg-secondary/30 p-3 text-xs mb-4">
              <div className="font-medium mb-1">Nächste Aktion</div>
              <div className="text-muted-foreground">
                Letzte Mahnaktion: {selected.last_action_at ? `${selected.last_action} am ${fmtDateTime(selected.last_action_at)}` : 'keine'}
              </div>
              <div className="mt-1">{nextAction(selected)}</div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <Button size="sm" variant="outline" onClick={() => void openPdf(selected)} disabled={pdfLoading}>
                {pdfLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />} PDF öffnen
              </Button>
              <Button size="sm" onClick={() => startPayment(selected)}>
                <Banknote className="h-4 w-4 mr-2" /> Zahlung buchen
              </Button>
              <Button size="sm" variant="outline" onClick={() => void startDunning(selected, 1)}>
                <Mail className="h-4 w-4 mr-2" /> Erinnerung
              </Button>
              <Button size="sm" variant="outline"
                onClick={() => void startDunning(selected, Math.min(4, Math.max(2, Number(selected.dunning_level || 1) + 1)))}>
                <Send className="h-4 w-4 mr-2" /> Mahnung
              </Button>
            </div>

            <div className="mb-4">
              <Label className="text-xs">Interne Notiz</Label>
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Notiz zum offenen Posten …" />
              <Button size="sm" variant="outline" className="mt-2" onClick={() => void saveNote()} disabled={savingNote || !note.trim()}>
                <StickyNote className="h-4 w-4 mr-2" /> Notiz speichern
              </Button>
            </div>

            <div>
              <div className="flex items-center gap-2 text-sm font-medium mb-2"><History className="h-4 w-4" /> Verlauf</div>
              {historyLoading ? (
                <div className="text-xs text-muted-foreground">Lädt …</div>
              ) : (
                <div className="space-y-3 text-xs max-h-80 overflow-y-auto pr-1">
                  <div>
                    <div className="text-muted-foreground mb-1">Zahlungen</div>
                    {(history?.payments ?? []).length === 0 ? <div>—</div> : (history.payments as any[]).map((p) => (
                      <div key={p.id} className="flex justify-between border-b border-border/50 py-1">
                        <span>{fmtDate(p.booking_date)}</span><span>{fmt(p.amount, selected.currency)}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1">Erinnerungen / Mahnungen</div>
                    {(history?.dunning ?? []).length === 0 ? <div>—</div> : (history.dunning as any[]).map((d) => (
                      <div key={d.id} className="border-b border-border/50 py-1">
                        <div className="flex justify-between">
                          <span>{LEVEL_LABEL[d.level]}</span>
                          <span className={d.send_status === 'sent' ? 'text-emerald-500' : 'text-destructive'}>{d.send_status}</span>
                        </div>
                        <div className="text-muted-foreground">{fmtDateTime(d.sent_at)} · {d.recipient_email}</div>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1">Notizen</div>
                    {(history?.notes ?? []).length === 0 ? <div>—</div> : (history.notes as any[]).map((n) => (
                      <div key={n.id} className="border-b border-border/50 py-1">
                        <div>{n.note}</div>
                        <div className="text-muted-foreground">{fmtDateTime(n.created_at)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Zahlung buchen */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Zahlung buchen · {selected ? invNo(selected) : ''}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Zahlbetrag</Label>
              <Input value={payAmount} onChange={(e) => setPayAmount(e.target.value)} inputMode="decimal" />
              <div className="text-xs text-muted-foreground mt-1">Offen: {selected ? fmt(selected.balance, selected.currency) : '—'}</div>
            </div>
            <div>
              <Label>Zahlungsdatum</Label>
              <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
            </div>
            <div>
              <Label>Zahlungsart</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Bank', 'Bar', 'Karte', 'Sonstige'].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Referenz (optional)</Label><Input value={payRef} onChange={(e) => setPayRef(e.target.value)} /></div>
            <div><Label>Notiz (optional)</Label><Textarea rows={2} value={payNote} onChange={(e) => setPayNote(e.target.value)} /></div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => void bookPayment(false)} disabled={paying}>
              {paying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Teilzahlung buchen
            </Button>
            <Button onClick={() => void bookPayment(true)} disabled={paying}>
              {paying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Vollständig bezahlt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mahnung / Erinnerung */}
      <Dialog open={dunOpen} onOpenChange={setDunOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{LEVEL_LABEL[dunLevel]} senden</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <Label>Mahnstufe</Label>
              <Select value={String(dunLevel)} onValueChange={(v) => setDunLevel(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4].map((l) => <SelectItem key={l} value={String(l)}>{LEVEL_LABEL[l]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Empfänger</Label><Input value={dunEmail} onChange={(e) => setDunEmail(e.target.value)} placeholder="kunde@example.com" /></div>
            <div className="rounded-lg border border-border bg-secondary/30 p-3 text-xs space-y-1">
              <div><span className="text-muted-foreground">Betreff: </span>{LEVEL_LABEL[dunLevel]} – Rechnung {selected ? invNo(selected) : ''}</div>
              <div><span className="text-muted-foreground">Rechnung: </span>{selected ? invNo(selected) : ''}</div>
              <div><span className="text-muted-foreground">Offener Betrag: </span>{selected ? fmt(selected.balance, selected.currency) : ''}</div>
              <div><span className="text-muted-foreground">Fällig: </span>{fmtDate(selected?.due_date)}</div>
            </div>
            <div><Label>Zusätzlicher Hinweis (optional)</Label><Textarea rows={3} value={dunMessage} onChange={(e) => setDunMessage(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button onClick={() => void sendDunning()} disabled={sending}>
              {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />} Jetzt per E-Mail senden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

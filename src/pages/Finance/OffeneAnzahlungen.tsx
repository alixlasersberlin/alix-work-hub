import { useCallback, useEffect, useMemo, useState } from 'react';
import { Wallet, Loader2, RefreshCw, Lock, Unlock, CheckCircle2, History as HistoryIcon, Upload, FileText } from 'lucide-react';
import { format, parseISO, differenceInCalendarDays, startOfMonth, startOfWeek } from 'date-fns';
import { de } from 'date-fns/locale';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useFinancePermissions } from '@/hooks/useFinancePermissions';

type Deposit = {
  id: string;
  source: 'alixwork' | 'zoho';
  deposit_number: string | null;
  customer_id: string | null;
  customer_name: string | null;
  company_name: string | null;
  contact_name: string | null;
  offer_number: string | null;
  order_id: string | null;
  order_number: string | null;
  invoice_number: string | null;
  currency: string | null;
  net_amount: number;
  vat_amount: number;
  gross_amount: number;
  paid_amount: number;
  open_amount: number;
  issue_date: string | null;
  due_date: string | null;
  status: 'offen' | 'ueberfaellig' | 'teilweise' | 'gebucht';
  release_status: 'nicht_freigegeben' | 'wartet' | 'teilweise' | 'auto_freigegeben' | 'manuell_freigegeben' | 'gesperrt';
  finance_lock: boolean;
  released_at: string | null;
  released_by: string | null;
  responsible_user_id: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

type HistoryRow = {
  id: string;
  action: string;
  old_status: string | null;
  new_status: string | null;
  old_release_status: string | null;
  new_release_status: string | null;
  note: string | null;
  created_at: string;
  user_id: string | null;
};

const statusLabel: Record<Deposit['status'], string> = {
  offen: 'Offen',
  ueberfaellig: 'Überfällig',
  teilweise: 'Teilweise bezahlt',
  gebucht: 'Gebucht',
};

const statusBadge: Record<Deposit['status'], string> = {
  offen: 'bg-muted text-muted-foreground border border-border',
  ueberfaellig: 'bg-destructive/15 text-destructive border border-destructive/30',
  teilweise: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  gebucht: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
};

const releaseLabel: Record<Deposit['release_status'], string> = {
  nicht_freigegeben: 'Nicht freigegeben',
  wartet: 'Wartet auf Anzahlung',
  teilweise: 'Teilweise bezahlt',
  auto_freigegeben: 'Automatisch freigegeben',
  manuell_freigegeben: 'Manuell freigegeben',
  gesperrt: 'Gesperrt',
};

const releaseBadge: Record<Deposit['release_status'], string> = {
  nicht_freigegeben: 'bg-muted text-muted-foreground border border-border',
  wartet: 'bg-blue-500/15 text-blue-300 border border-blue-500/30',
  teilweise: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  auto_freigegeben: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  manuell_freigegeben: 'bg-emerald-600/15 text-emerald-200 border border-emerald-600/30',
  gesperrt: 'bg-destructive/15 text-destructive border border-destructive/30',
};

const fmtMoney = (n: number, c = 'EUR') =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: c || 'EUR' }).format(Number(n) || 0);

export default function OffeneAnzahlungen() {
  const { canWrite } = useFinancePermissions();
  const [rows, setRows] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('alle');
  const [releaseFilter, setReleaseFilter] = useState<string>('alle');
  const [sourceFilter, setSourceFilter] = useState<string>('alle');
  const [overdueOnly, setOverdueOnly] = useState(false);

  const [bookFor, setBookFor] = useState<Deposit | null>(null);
  const [historyFor, setHistoryFor] = useState<Deposit | null>(null);
  const [historyRows, setHistoryRows] = useState<HistoryRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('finance_deposits')
      .select('*')
      .neq('status', 'gebucht')
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(2000);
    if (error) toast.error('Laden fehlgeschlagen: ' + error.message);
    setRows((data ?? []) as any);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-finance-deposits', { body: {} });
      if (error) throw error;
      toast.success(`Synchronisiert: ${data?.upserted ?? 0} Datensätze`);
      await load();
    } catch (e: any) {
      toast.error('Synchronisation fehlgeschlagen: ' + (e?.message ?? 'Unbekannt'));
    } finally { setSyncing(false); }
  }, [load]);

  const openHistory = async (d: Deposit) => {
    setHistoryFor(d);
    const { data } = await supabase
      .from('finance_deposit_history')
      .select('*')
      .eq('deposit_id', d.id)
      .order('created_at', { ascending: false })
      .limit(200);
    setHistoryRows((data ?? []) as any);
  };

  const toggleLock = async (d: Deposit) => {
    const { error } = await supabase.rpc('finance_deposit_set_lock' as any, {
      p_deposit_id: d.id, p_lock: !d.finance_lock, p_note: null,
    });
    if (error) toast.error('Fehler: ' + error.message);
    else { toast.success(d.finance_lock ? 'Sperre aufgehoben' : 'Sperre aktiv'); await load(); }
  };

  const manualRelease = async (d: Deposit) => {
    const { error } = await supabase.rpc('finance_deposit_manual_release' as any, {
      p_deposit_id: d.id, p_note: 'Manuelle Freigabe',
    });
    if (error) toast.error('Fehler: ' + error.message);
    else { toast.success('Manuell freigegeben'); await load(); }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (statusFilter !== 'alle' && r.status !== statusFilter) return false;
      if (releaseFilter !== 'alle' && r.release_status !== releaseFilter) return false;
      if (sourceFilter !== 'alle' && r.source !== sourceFilter) return false;
      if (overdueOnly) {
        if (!r.due_date || parseISO(r.due_date) >= new Date()) return false;
      }
      if (q) {
        const hay = [r.customer_name, r.company_name, r.contact_name, r.order_number, r.offer_number, r.invoice_number, r.deposit_number]
          .filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, statusFilter, releaseFilter, sourceFilter, overdueOnly]);

  const kpis = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    const monthStart = startOfMonth(today);
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const allOpen = rows.filter(r => r.status !== 'gebucht');
    const overdue = allOpen.filter(r => r.due_date && parseISO(r.due_date) < today);
    const dueToday = allOpen.filter(r => r.due_date && differenceInCalendarDays(parseISO(r.due_date), today) === 0);
    const totalOpenSum = allOpen.reduce((s, r) => s + Number(r.open_amount || 0), 0);
    const releasedToday = rows.filter(r => r.released_at && parseISO(r.released_at) >= today);
    const releasedWeek = rows.filter(r => r.released_at && parseISO(r.released_at) >= weekStart);
    const releasedMonth = rows.filter(r => r.released_at && parseISO(r.released_at) >= monthStart);
    return {
      open: allOpen.length,
      overdue: overdue.length,
      dueToday: dueToday.length,
      totalOpen: totalOpenSum,
      bookedMonth: 0, // separat geladen
      releasedAll: rows.filter(r => r.release_status === 'auto_freigegeben' || r.release_status === 'manuell_freigegeben').length,
      releasedToday: releasedToday.length,
      releasedWeek: releasedWeek.length,
      releasedMonth: releasedMonth.length,
    };
  }, [rows]);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeader
          icon={Wallet}
          title="Offene Anzahlungen"
          subtitle="Zentrale Übersicht aller offenen Anzahlungen aus AlixWork und Zoho"
          noBreadcrumbs
        />
        <Button onClick={handleSync} disabled={syncing} className="gap-2">
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Quellen synchronisieren
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <Kpi label="Offene Anzahlungen" value={kpis.open} />
        <Kpi label="Überfällig" value={kpis.overdue} tone="danger" />
        <Kpi label="Heute fällig" value={kpis.dueToday} tone="warn" />
        <Kpi label="Gesamtwert offen" value={fmtMoney(kpis.totalOpen)} />
        <Kpi label="Freigaben (gesamt)" value={kpis.releasedAll} tone="ok" />
        <Kpi label="Freigaben heute" value={kpis.releasedToday} tone="ok" />
        <Kpi label="Freigaben diese Woche" value={kpis.releasedWeek} tone="ok" />
        <Kpi label="Freigaben diesen Monat" value={kpis.releasedMonth} tone="ok" />
      </div>

      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[220px]">
          <Label className="text-xs text-muted-foreground">Suche</Label>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Kunde, Auftrag, Rechnung..." />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle</SelectItem>
              <SelectItem value="offen">Offen</SelectItem>
              <SelectItem value="ueberfaellig">Überfällig</SelectItem>
              <SelectItem value="teilweise">Teilweise bezahlt</SelectItem>
              <SelectItem value="gebucht">Gebucht</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Bestellfreigabe</Label>
          <Select value={releaseFilter} onValueChange={setReleaseFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle</SelectItem>
              {Object.entries(releaseLabel).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Quelle</Label>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle</SelectItem>
              <SelectItem value="alixwork">AlixWork</SelectItem>
              <SelectItem value="zoho">Zoho</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant={overdueOnly ? 'default' : 'outline'} onClick={() => setOverdueOnly(v => !v)}>
          Nur überfällig
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="p-8 flex items-center justify-center text-muted-foreground">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Lade…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Keine offenen Anzahlungen.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kunde / Firma</TableHead>
                <TableHead>Auftrag / Angebot</TableHead>
                <TableHead>Anzahlungsrechnung</TableHead>
                <TableHead>Quelle</TableHead>
                <TableHead className="text-right">Brutto</TableHead>
                <TableHead className="text-right">Bezahlt</TableHead>
                <TableHead className="text-right">Offen</TableHead>
                <TableHead>Fällig</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Bestellfreigabe</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-medium">{r.company_name || r.customer_name || '—'}</div>
                    {r.contact_name && <div className="text-xs text-muted-foreground">{r.contact_name}</div>}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {r.order_number || '—'}
                    {r.offer_number && <div className="text-muted-foreground">{r.offer_number}</div>}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.invoice_number || r.deposit_number || '—'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {r.source === 'zoho' ? 'Zoho' : 'AlixWork'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{fmtMoney(r.gross_amount, r.currency || 'EUR')}</TableCell>
                  <TableCell className="text-right">{fmtMoney(r.paid_amount, r.currency || 'EUR')}</TableCell>
                  <TableCell className="text-right font-semibold">{fmtMoney(r.open_amount, r.currency || 'EUR')}</TableCell>
                  <TableCell className="text-xs">
                    {r.due_date ? format(parseISO(r.due_date), 'dd.MM.yyyy', { locale: de }) : '—'}
                  </TableCell>
                  <TableCell>
                    <span className={cn('px-2 py-0.5 rounded text-xs', statusBadge[r.status])}>{statusLabel[r.status]}</span>
                  </TableCell>
                  <TableCell>
                    <span className={cn('px-2 py-0.5 rounded text-xs', releaseBadge[r.release_status])}>
                      {releaseLabel[r.release_status]}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {canWrite && (
                        <Button size="sm" variant="default" onClick={() => setBookFor(r)} className="gap-1">
                          <Upload className="w-3.5 h-3.5" /> Buchen
                        </Button>
                      )}
                      {canWrite && (
                        <Button size="sm" variant="outline" onClick={() => toggleLock(r)} title={r.finance_lock ? 'Sperre aufheben' : 'Sperren'}>
                          {r.finance_lock ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                        </Button>
                      )}
                      {canWrite && r.release_status !== 'auto_freigegeben' && r.release_status !== 'manuell_freigegeben' && (
                        <Button size="sm" variant="outline" onClick={() => manualRelease(r)} title="Manuell freigeben">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => openHistory(r)} title="Historie">
                        <HistoryIcon className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <BookingDialog open={!!bookFor} deposit={bookFor} onClose={() => setBookFor(null)} onDone={load} />

      <Dialog open={!!historyFor} onOpenChange={(o) => !o && setHistoryFor(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Historie</DialogTitle>
            <DialogDescription>
              {historyFor?.invoice_number || historyFor?.deposit_number} · {historyFor?.customer_name}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto space-y-2">
            {historyRows.length === 0 ? (
              <div className="text-sm text-muted-foreground">Noch keine Einträge.</div>
            ) : historyRows.map(h => (
              <div key={h.id} className="text-xs border border-border rounded p-2">
                <div className="flex justify-between">
                  <span className="font-medium">{h.action}</span>
                  <span className="text-muted-foreground">{format(parseISO(h.created_at), 'dd.MM.yyyy HH:mm', { locale: de })}</span>
                </div>
                {(h.old_status || h.new_status) && (
                  <div className="text-muted-foreground">Status: {h.old_status || '—'} → {h.new_status || '—'}</div>
                )}
                {(h.old_release_status || h.new_release_status) && (
                  <div className="text-muted-foreground">Freigabe: {h.old_release_status || '—'} → {h.new_release_status || '—'}</div>
                )}
                {h.note && <div className="mt-1">{h.note}</div>}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string | number; tone?: 'ok' | 'warn' | 'danger' }) {
  const toneCls = tone === 'danger' ? 'text-destructive'
    : tone === 'warn' ? 'text-amber-400'
    : tone === 'ok' ? 'text-emerald-400'
    : '';
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn('text-2xl font-semibold mt-1', toneCls)}>{value}</div>
    </div>
  );
}

function BookingDialog({ open, deposit, onClose, onDone }: {
  open: boolean; deposit: Deposit | null; onClose: () => void; onDone: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<string>('ueberweisung');
  const [reference, setReference] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (deposit) { setAmount(String(deposit.open_amount || '')); setReference(''); setNote(''); setFile(null); setDate(format(new Date(), 'yyyy-MM-dd')); setMethod('ueberweisung'); }
  }, [deposit]);

  const save = async () => {
    if (!deposit) return;
    const n = Number(amount.replace(',', '.'));
    if (!n || n <= 0) { toast.error('Betrag ungültig'); return; }
    setSaving(true);
    try {
      let proofPath: string | null = null;
      if (file) {
        const path = `${deposit.id}/${Date.now()}_${file.name}`;
        const { error: upErr } = await supabase.storage.from('finance-deposits').upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        proofPath = path;
      }
      const { error } = await supabase.rpc('finance_deposit_book' as any, {
        p_deposit_id: deposit.id,
        p_amount: n,
        p_method: method,
        p_reference: reference || null,
        p_booking_date: date,
        p_proof_path: proofPath,
        p_note: note || null,
      });
      if (error) throw error;
      toast.success('Anzahlung gebucht');
      onDone();
      onClose();
    } catch (e: any) {
      toast.error('Fehler: ' + (e?.message ?? 'Unbekannt'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Anzahlung buchen</DialogTitle>
          <DialogDescription>
            {deposit?.invoice_number || deposit?.deposit_number} · {deposit?.customer_name}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Buchungsdatum</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Betrag</Label>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />
          </div>
          <div>
            <Label>Zahlungsart</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ueberweisung">Überweisung</SelectItem>
                <SelectItem value="bar">Bar</SelectItem>
                <SelectItem value="ec">EC</SelectItem>
                <SelectItem value="kreditkarte">Kreditkarte</SelectItem>
                <SelectItem value="sonstige">Sonstige</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Referenznummer</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="z.B. Bankreferenz" />
          </div>
          <div className="col-span-2">
            <Label>Zahlungsbeleg (optional)</Label>
            <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <div className="col-span-2">
            <Label>Interner Vermerk</Label>
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Abbrechen</Button>
          <Button onClick={save} disabled={saving} className="gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

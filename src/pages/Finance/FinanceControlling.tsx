import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, AlertTriangle, FileText, Search, RefreshCw, ExternalLink, CheckCircle2, XCircle, CalendarCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  FC_STATUS, FC_TRAFFIC, FC_APPROVAL, fmtEur, listFcCases, listFcEvents, loadCaseInvoices,
  setFcStatus, addFcEvent, updateFcCase, setFcApproval, loadFcMonthClose, type FcCase,
  FC_DRAFT_TYPE, FC_DRAFT_STATUS, listFcDrafts, setFcDraftStatus, createFcDraft, type FcInvoiceDraft,
} from '@/lib/finance/controlling';

const FILTERS = [
  { key: 'alle', label: 'Alle' },
  { key: 'neu', label: 'Neu' },
  { key: 'rechnung_fehlt', label: 'Rechnung fehlt' },
  { key: 'differenzen', label: 'Differenzen' },
  { key: 'AUFTRAG', label: 'Aufträge' },
  { key: 'LIEFERUNG', label: 'Lieferungen' },
  { key: 'TEILLIEFERUNG', label: 'Teillieferungen' },
  { key: 'REPARATUR', label: 'Reparaturen' },
  { key: 'SCHLUSSRECHNUNG', label: 'Schlussrechnungen' },
  { key: 'kritisch', label: 'Kritisch' },
  { key: 'freigabe_offen', label: 'Freigabe offen' },
  { key: 'eskaliert', label: 'Eskaliert' },
  { key: 'wiedervorlage', label: 'Wiedervorlage fällig' },
  { key: 'heute', label: 'Heute' },
  { key: 'woche', label: 'Diese Woche' },
  { key: 'abgeschlossen', label: 'Abgeschlossen' },
  { key: 'meine', label: 'Meine Vorgänge' },
];

const PRIORITIES: Record<string, string> = { normal: 'Normal', hoch: 'Hoch', kritisch: 'Kritisch' };

function monthBounds() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}


function Kpi({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn('text-2xl font-semibold mt-1', tone)}>{value}</div>
    </div>
  );
}

export default function FinanceControlling() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, hasAnyRole } = useAuth();
  const canApprove = hasAnyRole(['Super Admin', 'Admin', 'Buchhaltung']);
  const [filter, setFilter] = useState('alle');
  const [search, setSearch] = useState('');
  const [active, setActive] = useState<FcCase | null>(null);
  const [comment, setComment] = useState('');
  const [monthOpen, setMonthOpen] = useState(false);
  const [range, setRange] = useState(monthBounds());
  const [period, setPeriod] = useState<string>('alle');
  const [pageSize, setPageSize] = useState<string>('50');
  const [page, setPage] = useState(1);


  const { data: employees = [] } = useQuery({
    queryKey: ['fc-employees'],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('id, full_name, email')
        .eq('is_active', true)
        .order('full_name');
      return (data ?? []) as { id: string; full_name: string | null; email: string | null }[];
    },
  });

  const { data: cases = [], isLoading, refetch } = useQuery({
    queryKey: ['fc-cases'],
    queryFn: listFcCases,
  });

  const { data: events = [] } = useQuery({
    queryKey: ['fc-events', active?.id],
    queryFn: () => listFcEvents(active!.id),
    enabled: !!active,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['fc-invoices', active?.reference_number],
    queryFn: () => loadCaseInvoices(active!.reference_number),
    enabled: !!active,
  });

  const kpis = useMemo(() => {
    const open = cases.filter(c => !['abgeschlossen', 'freigegeben'].includes(c.status));
    return {
      open: open.length,
      needsInvoice: cases.filter(c => c.open_to_invoice > 0.01 && c.status !== 'abgeschlossen').length,
      invoiced: cases.filter(c => c.open_to_invoice <= 0.01).length,
      diff: cases.filter(c => Math.abs(c.open_to_invoice) > 0.01).length,
      partial: cases.filter(c => c.case_type === 'TEILLIEFERUNG' && c.open_to_invoice > 0.01).length,
      repairs: cases.filter(c => c.case_type === 'REPARATUR' && c.open_to_invoice > 0.01).length,
      critical: cases.filter(c => c.traffic === 'kritisch' && c.status !== 'abgeschlossen').length,
      awaitingApproval: cases.filter(c => c.approval_status !== 'freigegeben' && c.status !== 'abgeschlossen').length,
    };
  }, [cases]);

  const periodBounds = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    switch (period) {
      case 'dieser_monat': return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) };
      case 'letzter_monat': return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
      case 'dieses_jahr': return { from: `${y}-01-01`, to: `${y}-12-31` };
      case 'letztes_jahr': return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
      default: return null;
    }
  }, [period]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const today = new Date().toISOString().slice(0, 10);

    return cases.filter(c => {
      if (periodBounds) {
        const d = (c.created_at ?? '').slice(0, 10);
        if (d < periodBounds.from || d > periodBounds.to) return false;
      }
      if (q) {
        const hay = [c.customer_name, c.customer_number, c.reference_number, c.case_type, c.status]
          .map(v => (v ?? '').toString().toLowerCase()).join(' ');
        if (!hay.includes(q)) return false;
      }
      switch (filter) {
        case 'alle': return c.status !== 'abgeschlossen';
        case 'neu': return c.status === 'neu';
        case 'rechnung_fehlt': return c.open_to_invoice > 0.01 && c.status !== 'abgeschlossen';
        case 'differenzen': return Math.abs(c.open_to_invoice) > 0.01;
        case 'kritisch': return c.traffic === 'kritisch';
        case 'freigabe_offen': return c.approval_status !== 'freigegeben' && c.status !== 'abgeschlossen';
        case 'eskaliert': return !!c.escalated_at && c.status !== 'abgeschlossen';
        case 'wiedervorlage': return !!c.followup_date && c.followup_date <= today && c.status !== 'abgeschlossen';
        case 'heute': return c.created_at.slice(0, 10) === today;
        case 'woche': return new Date(c.created_at) >= startOfWeek;
        case 'abgeschlossen': return c.status === 'abgeschlossen';
        case 'meine': return !!user && c.assigned_to === user.id && c.status !== 'abgeschlossen';
        default: return c.case_type === filter;
      }
    });
  }, [cases, filter, search, user, periodBounds]);

  const perPage = pageSize === 'alle' ? rows.length || 1 : Number(pageSize);
  const pageCount = Math.max(1, Math.ceil(rows.length / perPage));
  const currentPage = Math.min(page, pageCount);
  const visibleRows = useMemo(
    () => rows.slice((currentPage - 1) * perPage, currentPage * perPage),
    [rows, currentPage, perPage],
  );


  const openCase = (c: FcCase) => { setActive(c); setComment(''); };

  const doStatus = async (c: FcCase, status: string) => {
    try {
      await setFcStatus(c, status);
      toast.success(`Status: ${FC_STATUS[status] ?? status}`);
      qc.invalidateQueries({ queryKey: ['fc-cases'] });
      qc.invalidateQueries({ queryKey: ['fc-events', c.id] });
      setActive({ ...c, status });
    } catch (e: any) {
      toast.error(e.message ?? 'Fehler');
    }
  };

  const doApproval = async (c: FcCase, approval: 'offen' | 'freigegeben' | 'abgelehnt') => {
    try {
      await setFcApproval(c, approval);
      toast.success(`Freigabe: ${FC_APPROVAL[approval].label}`);
      setActive({ ...c, approval_status: approval, approved_at: approval === 'offen' ? null : new Date().toISOString() });
      qc.invalidateQueries({ queryKey: ['fc-cases'] });
      qc.invalidateQueries({ queryKey: ['fc-events', c.id] });
    } catch (e: any) {
      toast.error(e.message ?? 'Fehler');
    }
  };


  const saveComment = async () => {
    if (!active || !comment.trim()) return;
    try {
      await addFcEvent(active.id, { event_type: 'kommentar', comment: comment.trim() });
      setComment('');
      qc.invalidateQueries({ queryKey: ['fc-events', active.id] });
      toast.success('Kommentar gespeichert');
    } catch (e: any) { toast.error(e.message ?? 'Fehler'); }
  };

  const goInvoice = (c: FcCase) => {
    if (c.case_type === 'REPARATUR') navigate('/finance/rechnungsvorschlaege');
    else if (c.order_id) navigate(`/auftraege/${c.order_id}`);
    else navigate('/finance/rechnungen');
  };

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-semibold">Finance Controlling</h1>
          <span className="text-xs text-muted-foreground">Zentrale Rechnungs-Kontrollstelle</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setMonthOpen(true)}>
            <CalendarCheck className="w-4 h-4 mr-2" />Monatsabschluss
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />Aktualisieren
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        <Kpi label="Offene Prüfungen" value={kpis.open} />
        <Kpi label="Rechnung erforderlich" value={kpis.needsInvoice} tone="text-destructive" />
        <Kpi label="Rechnung vorhanden" value={kpis.invoiced} tone="text-emerald-400" />
        <Kpi label="Differenzen" value={kpis.diff} tone="text-amber-400" />
        <Kpi label="Teillieferungen" value={kpis.partial} />
        <Kpi label="Reparaturen" value={kpis.repairs} />
        <Kpi label="Kritisch" value={kpis.critical} tone="text-red-400" />
        <Kpi label="Freigabe offen" value={kpis.awaitingApproval} tone="text-amber-400" />
      </div>


      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suche: Kunde, Kundennummer, Auftragsnummer, Rechnungsnummer, Reparaturnummer, Seriennummer…"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'px-3 py-1.5 text-xs rounded-md transition-colors border',
                filter === f.key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'text-muted-foreground border-border hover:text-foreground hover:bg-muted/50',
              )}
            >{f.label}</button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground mr-1">Datum:</span>
            {[
              { k: 'dieser_monat', l: 'Dieser Monat' },
              { k: 'letzter_monat', l: 'Letzter Monat' },
              { k: 'dieses_jahr', l: 'Dieses Jahr' },
              { k: 'letztes_jahr', l: 'Letztes Jahr' },
              { k: 'alle', l: 'Alle' },
            ].map(o => (
              <button
                key={o.k}
                onClick={() => { setPeriod(o.k); setPage(1); }}
                className={cn(
                  'px-2.5 py-1 text-xs rounded-md border transition-colors',
                  period === o.k
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'text-muted-foreground border-border hover:text-foreground hover:bg-muted/50',
                )}
              >{o.l}</button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground mr-1">Anzeige:</span>
            {['20', '50', '100', 'alle'].map(o => (
              <button
                key={o}
                onClick={() => { setPageSize(o); setPage(1); }}
                className={cn(
                  'px-2.5 py-1 text-xs rounded-md border transition-colors',
                  pageSize === o
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'text-muted-foreground border-border hover:text-foreground hover:bg-muted/50',
                )}
              >{o === 'alle' ? 'Alle' : o}</button>
            ))}
          </div>
          <div className="text-xs text-muted-foreground">{rows.length} Vorgänge</div>
        </div>

      </div>

      <div className="rounded-xl border border-border bg-card w-full max-w-full overflow-x-auto">
        <table className="w-full min-w-[1000px] text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground sticky top-0 z-10">
            <tr>
              <th className="text-left p-2">Vorgang</th>
              <th className="text-left p-2">Kunde / Status</th>
              <th className="text-right p-2">Auftrag / Fakturiert</th>
              <th className="text-right p-2">Offen</th>
              <th className="text-left p-2">Verantwortlich / Datum</th>
              <th className="text-left p-2">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Lade…</td></tr>}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Keine Vorgänge</td></tr>
            )}
            {visibleRows.map((c, i) => {
              const t = FC_TRAFFIC[c.traffic] ?? FC_TRAFFIC.gelb;
              return (
                <tr key={c.id} className={cn('border-t border-border hover:bg-muted/30 cursor-pointer align-top', i % 2 === 1 && 'bg-muted/10')}
                    onClick={() => openCase(c)}>
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap px-2 py-0.5 rounded-full text-xs border', t.cls)}>
                        <span className={cn('w-2 h-2 rounded-full shrink-0', t.dot)} />
                        {t.label}
                      </span>
                      <span className="font-medium">{c.case_type}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {c.reference_number || '—'} · Prio {c.priority}
                    </div>
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{c.customer_name || '—'}</span>
                      <span className={cn('inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] border',
                        (FC_APPROVAL[c.approval_status] ?? FC_APPROVAL.offen).cls)}>
                        {(FC_APPROVAL[c.approval_status] ?? FC_APPROVAL.offen).label}
                      </span>
                      {c.escalated_at && (
                        <span className="text-[10px] text-red-400 whitespace-nowrap">eskaliert</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {FC_STATUS[c.status] ?? c.status} · {c.trigger_event}
                    </div>
                  </td>
                  <td className="p-2 text-right">
                    <div>{fmtEur(c.order_amount)}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">fakt. {fmtEur(c.invoiced_amount)} · bez. {fmtEur(c.paid_amount)}</div>
                  </td>
                  <td className="p-2 text-right">
                    <div className={cn(c.open_to_invoice > 0.01 && 'text-destructive font-medium')}>{fmtEur(c.open_to_invoice)}</div>
                    <div className={cn('text-xs mt-0.5', c.open_to_pay > 0.01 ? 'text-amber-400' : 'text-muted-foreground')}>
                      zu zahlen {fmtEur(c.open_to_pay)}
                    </div>
                  </td>
                  <td className="p-2">
                    <div className="text-xs">{employees.find(e => e.id === c.assigned_to)?.full_name || '—'}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{new Date(c.created_at).toLocaleDateString('de-DE')}</div>
                  </td>
                  <td className="p-2" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="outline" onClick={() => goInvoice(c)}>
                      <FileText className="w-3.5 h-3.5 mr-1" />
                      {c.invoiced_amount > 0 ? 'Schlussrechnung' : 'Rechnung erstellen'}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pageSize !== 'alle' && pageCount > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Seite {currentPage} von {pageCount}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Zurück</Button>
            <Button size="sm" variant="outline" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>Weiter</Button>
          </div>
        </div>
      )}


      <Sheet open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <SheetContent
          className="w-full sm:max-w-xl overflow-y-auto"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {active && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {active.case_type} · {active.reference_number || '—'}
                  {active.traffic === 'kritisch' && <AlertTriangle className="w-4 h-4 text-red-400" />}
                </SheetTitle>
              </SheetHeader>

              <div className="mt-4 space-y-4 text-sm">
                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs text-muted-foreground mb-2">Kunde</div>
                  <div className="font-medium">{active.customer_name || '—'}</div>
                  <div className="text-xs text-muted-foreground">{active.customer_number || ''}</div>
                </div>

                <div className="rounded-lg border border-border p-3 space-y-1">
                  <div className="text-xs text-muted-foreground mb-2">Finanzübersicht</div>
                  <div className="flex justify-between"><span>Auftragswert</span><span>{fmtEur(active.order_amount)}</span></div>
                  <div className="flex justify-between"><span>Bereits fakturiert</span><span>{fmtEur(active.invoiced_amount)}</span></div>
                  <div className="flex justify-between font-medium"><span>Noch zu fakturieren</span>
                    <span className={active.open_to_invoice > 0.01 ? 'text-destructive' : 'text-emerald-400'}>{fmtEur(active.open_to_invoice)}</span></div>
                  <div className="h-px bg-border my-2" />
                  <div className="flex justify-between"><span>Bereits bezahlt</span><span>{fmtEur(active.paid_amount)}</span></div>
                  <div className="flex justify-between font-medium"><span>Noch zu bezahlen</span>
                    <span className={active.open_to_pay > 0.01 ? 'text-amber-400' : 'text-emerald-400'}>{fmtEur(active.open_to_pay)}</span></div>
                </div>

                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs text-muted-foreground mb-2">Rechnungen</div>
                  {invoices.length === 0 && <div className="text-muted-foreground text-xs">Keine Rechnung vorhanden</div>}
                  {invoices.map((inv: any) => (
                    <div key={inv.id} className="flex justify-between py-1 border-b border-border/50 last:border-0">
                      <div>
                        <div className="font-medium">{inv.invoice_number}{inv.is_deposit ? ' (Anzahlung)' : ''}</div>
                        <div className="text-xs text-muted-foreground">
                          {inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString('de-DE') : ''} · {inv.status}
                        </div>
                      </div>
                      <div className="text-right">
                        <div>{fmtEur(inv.total)}</div>
                        <div className="text-xs text-muted-foreground">offen {fmtEur(inv.balance)}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-muted-foreground">Rechnungsentwürfe (automatisch)</div>
                    <Button size="sm" variant="outline" onClick={() => void doCreateDraft(active)}>Entwurf erzeugen</Button>
                  </div>
                  {drafts.length === 0 && <div className="text-muted-foreground text-xs">Kein Entwurf vorhanden</div>}
                  {drafts.map((d) => (
                    <div key={d.id} className="flex items-center justify-between py-1 border-b border-border/50 last:border-0">
                      <div>
                        <div className="font-medium">{fmtEur(d.amount)} · {FC_DRAFT_TYPE[d.draft_type] ?? d.draft_type}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(d.created_at).toLocaleDateString('de-DE')} · {FC_DRAFT_STATUS[d.status] ?? d.status}
                        </div>
                      </div>
                      {d.status === 'entwurf' && (
                        <div className="flex gap-2">
                          <Button size="sm" variant="secondary" onClick={() => void doDraftStatus(d, 'erstellt')}>Erledigt</Button>
                          <Button size="sm" variant="ghost" onClick={() => void doDraftStatus(d, 'verworfen')}>Verwerfen</Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => goInvoice(active)}>
                    <ExternalLink className="w-3.5 h-3.5 mr-1" />
                    {active.invoiced_amount > 0 ? 'Schlussrechnung erstellen' : 'Rechnung erstellen'}
                  </Button>
                  <select
                    aria-label="Rechnungsstatus"
                    className="h-9 w-[260px] rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
                    value={active.status}
                    onChange={(e) => void doStatus(active, e.target.value)}
                  >
                    {Object.entries(FC_STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                </div>

                <div className="rounded-lg border border-border p-3 space-y-2">
                  <div className="text-xs text-muted-foreground">Finance-Freigabe</div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs border',
                      (FC_APPROVAL[active.approval_status] ?? FC_APPROVAL.offen).cls)}>
                      {(FC_APPROVAL[active.approval_status] ?? FC_APPROVAL.offen).label}
                    </span>
                    {active.approved_at && (
                      <span className="text-xs text-muted-foreground">
                        am {new Date(active.approved_at).toLocaleString('de-DE')}
                      </span>
                    )}
                  </div>
                  {canApprove ? (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => doApproval(active, 'freigegeben')}>
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />Freigeben
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => doApproval(active, 'abgelehnt')}>
                        <XCircle className="w-3.5 h-3.5 mr-1" />Ablehnen
                      </Button>
                      {active.approval_status !== 'offen' && (
                        <Button size="sm" variant="ghost" onClick={() => doApproval(active, 'offen')}>Zurücksetzen</Button>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">
                      Nur Buchhaltung / Admin kann freigeben. Ohne Freigabe ist kein Abschluss möglich.
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-border p-3 space-y-2">
                  <div className="text-xs text-muted-foreground">Verantwortlich / Fällig am / Wiedervorlage / Priorität</div>
                  <div className="flex flex-wrap gap-2">
                    <Select
                      value={active.assigned_to ?? 'none'}
                      onValueChange={async (v) => {
                        const val = v === 'none' ? null : v;
                        await updateFcCase(active.id, { assigned_to: val } as any);
                        const emp = employees.find(e => e.id === val);
                        await addFcEvent(active.id, {
                          event_type: 'zuordnung',
                          comment: val ? `Verantwortlich: ${emp?.full_name || emp?.email || val}` : 'Zuordnung entfernt',
                        });
                        setActive({ ...active, assigned_to: val });
                        qc.invalidateQueries({ queryKey: ['fc-cases'] });
                        qc.invalidateQueries({ queryKey: ['fc-events', active.id] });
                      }}
                    >
                      <SelectTrigger className="w-[220px] h-9"><SelectValue placeholder="Verantwortlich" /></SelectTrigger>
                      <SelectContent className="z-[120]" position="popper">
                        <SelectItem value="none">— nicht zugewiesen —</SelectItem>
                        {employees.map(e => (
                          <SelectItem key={e.id} value={e.id}>{e.full_name || e.email}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="date"
                      className="w-[170px]"
                      defaultValue={active.due_date ?? ''}
                      onBlur={async (e) => {
                        await updateFcCase(active.id, { due_date: e.target.value || null } as any);
                        qc.invalidateQueries({ queryKey: ['fc-cases'] });
                      }}
                    />
                    <Input
                      type="date"
                      className="w-[170px]"
                      title="Wiedervorlage"
                      defaultValue={active.followup_date ?? ''}
                      onBlur={async (e) => {
                        await updateFcCase(active.id, { followup_date: e.target.value || null } as any);
                        qc.invalidateQueries({ queryKey: ['fc-cases'] });
                      }}
                    />
                    <Select
                      value={active.priority}
                      onValueChange={async (v) => {
                        await updateFcCase(active.id, { priority: v } as any);
                        setActive({ ...active, priority: v });
                        qc.invalidateQueries({ queryKey: ['fc-cases'] });
                      }}
                    >
                      <SelectTrigger className="w-[150px] h-9"><SelectValue /></SelectTrigger>
                      <SelectContent className="z-[120]" position="popper">
                        {Object.entries(PRIORITIES).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    placeholder="Notiz"
                    defaultValue={active.notes ?? ''}
                    onBlur={async (e) => {
                      await updateFcCase(active.id, { notes: e.target.value || null } as any);
                      qc.invalidateQueries({ queryKey: ['fc-cases'] });
                    }}
                  />
                </div>

                <div className="rounded-lg border border-border p-3 space-y-2">
                  <div className="text-xs text-muted-foreground">Interner Kommentar</div>
                  <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
                  <Button size="sm" variant="outline" onClick={saveComment}>Kommentar speichern</Button>
                </div>

                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs text-muted-foreground mb-2">Historie</div>
                  <div className="space-y-2">
                    {events.map(ev => (
                      <div key={ev.id} className="text-xs">
                        <div className="text-muted-foreground">
                          {new Date(ev.created_at).toLocaleString('de-DE')} · {ev.user_name || 'System'}
                        </div>
                        <div>
                          {ev.event_type}
                          {ev.new_status ? ` → ${FC_STATUS[ev.new_status] ?? ev.new_status}` : ''}
                          {ev.comment ? ` · ${ev.comment}` : ''}
                        </div>
                      </div>
                    ))}
                    {events.length === 0 && <div className="text-xs text-muted-foreground">Keine Einträge</div>}
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <MonthCloseDialog open={monthOpen} onOpenChange={setMonthOpen} range={range} setRange={setRange} />
    </div>
  );
}

function MonthCloseDialog({ open, onOpenChange, range, setRange }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  range: { from: string; to: string };
  setRange: (r: { from: string; to: string }) => void;
}) {
  const { data, isFetching } = useQuery({
    queryKey: ['fc-month-close', range.from, range.to],
    queryFn: () => loadFcMonthClose(range.from, range.to),
    enabled: open,
  });

  const items: { label: string; value: string | number; tone?: string }[] = data ? [
    { label: 'Aufträge abgeschlossen', value: data.orders_closed },
    { label: 'Rechnungen erstellt', value: data.invoices_created, tone: 'text-emerald-400' },
    { label: 'Fehlende Rechnungen', value: data.invoices_missing, tone: 'text-destructive' },
    { label: 'Umsatz noch nicht fakturiert', value: fmtEur(data.revenue_not_invoiced), tone: 'text-destructive' },
    { label: 'Offene Schlussrechnungen', value: data.open_final_invoices },
    { label: 'Offene Reparaturrechnungen', value: data.open_repair_invoices },
    { label: 'Offene Teillieferungen', value: data.open_partial_deliveries },
    { label: 'Noch offen zu zahlen', value: fmtEur(data.open_to_pay_total), tone: 'text-amber-400' },
    { label: 'Freigegeben', value: data.approved, tone: 'text-emerald-400' },
    { label: 'Freigabe ausstehend', value: data.awaiting_approval, tone: 'text-amber-400' },
  ] : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Monatsabschluss</DialogTitle></DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Input type="date" className="w-[170px]" value={range.from}
                 onChange={(e) => setRange({ ...range, from: e.target.value })} />
          <span className="text-muted-foreground text-sm">bis</span>
          <Input type="date" className="w-[170px]" value={range.to}
                 onChange={(e) => setRange({ ...range, to: e.target.value })} />
          {isFetching && <span className="text-xs text-muted-foreground">Lade…</span>}
        </div>
        <div className="grid grid-cols-2 gap-3 mt-2">
          {items.map(i => (
            <div key={i.label} className="rounded-lg border border-border p-3">
              <div className="text-xs text-muted-foreground">{i.label}</div>
              <div className={cn('text-lg font-semibold mt-1', i.tone)}>{i.value}</div>
            </div>
          ))}
          {!data && !isFetching && <div className="text-sm text-muted-foreground">Keine Daten</div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DataCard, PageError } from '@/components/PageShell';
import { SkeletonTable } from '@/components/infinity/Skeleton';
import { EmptyState } from '@/components/infinity/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Coins, RefreshCw, CheckCircle2, XCircle, Ban, CalendarClock, Undo2 } from 'lucide-react';
import {
  STATUS_LABELS, STATUS_CLASSES, EMPLOYEE_ROLES, REVERSAL_REASONS,
  fmtMoney, fmtDate, fmtPercent, type CommissionStatus,
} from '@/lib/commission/constants';
import { useCommissionPermissions } from '@/hooks/useCommissionPermissions';

export type Entry = {
  id: string;
  entry_number: string;
  order_id: string | null;
  order_number: string | null;
  customer_name: string | null;
  employee_id: string;
  employee_role: string;
  device_name: string | null;
  device_count: number;
  order_date: string | null;
  delivery_date: string | null;
  net_amount: number;
  gross_amount: number;
  basis: string;
  basis_amount: number;
  commission_type: string;
  commission_percent: number;
  commission_amount: number;
  paid_amount: number;
  open_amount: number;
  currency: string;
  customer_payment_status: string | null;
  customer_paid_percent: number;
  effective_at: string | null;
  payout_due_date: string | null;
  status: CommissionStatus;
  approval_state: string;
  block_reason: string | null;
  cost_center: string | null;
  notes: string | null;
};

export function StatusPill({ status }: { status: CommissionStatus }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium', STATUS_CLASSES[status])}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function TrafficDot({ state }: { state: string }) {
  const cls = state === 'green' ? 'bg-emerald-400' : state === 'red' ? 'bg-rose-400' : 'bg-amber-400';
  return <span className={cn('inline-block h-2.5 w-2.5 rounded-full', cls)} />;
}

export const BUCKETS = {
  all: [] as CommissionStatus[],
  open: ['preliminary', 'condition_open', 'effective', 'in_review'] as CommissionStatus[],
  approval: ['pending_approval'] as CommissionStatus[],
  approved: ['approved', 'payout_scheduled'] as CommissionStatus[],
  paid: ['paid', 'partially_paid', 'closed'] as CommissionStatus[],
  cancelled: ['cancelled', 'reclaimed', 'blocked'] as CommissionStatus[],
};

export type BucketKey = keyof typeof BUCKETS;

export function CommissionList({ bucket }: { bucket: BucketKey }) {
  const perms = useCommissionPermissions();
  const [rows, setRows] = useState<Entry[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<Entry | null>(null);
  const [conditions, setConditions] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [reverseOpen, setReverseOpen] = useState(false);
  const [reverseCode, setReverseCode] = useState('storno');
  const [reverseReason, setReverseReason] = useState('');
  const [reverseReclaim, setReverseReclaim] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    let q = supabase.from('commission_entries').select('*').order('created_at', { ascending: false }).limit(1000);
    const list = BUCKETS[bucket];
    if (list.length) q = q.in('status', list);
    const { data, error } = await q;
    if (error) setError(error.message);
    setRows((data ?? []) as unknown as Entry[]);
    const { data: profiles } = await supabase.from('user_profiles').select('id, full_name, email');
    const map: Record<string, string> = {};
    (profiles ?? []).forEach((p: any) => { map[p.id] = p.full_name || p.email || p.id; });
    setNames(map);
    setLoading(false);
  }, [bucket]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (e: Entry) => {
    setDetail(e);
    const [{ data: c }, { data: h }] = await Promise.all([
      supabase.from('commission_conditions').select('*').eq('entry_id', e.id).order('condition_key'),
      supabase.from('commission_status_history').select('*').eq('entry_id', e.id).order('changed_at', { ascending: false }).limit(20),
    ]);
    setConditions(c ?? []);
    setHistory(h ?? []);
  };

  const call = async (payload: Record<string, unknown>, okMsg: string) => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('commission-engine', { body: payload });
    setBusy(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? 'Aktion fehlgeschlagen');
      return false;
    }
    toast.success(okMsg);
    setSelected(new Set());
    await load();
    return true;
  };

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (!s) return true;
      return [r.entry_number, r.order_number, r.customer_name, names[r.employee_id], r.device_name]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(s));
    });
  }, [rows, search, statusFilter, names]);

  const sums = useMemo(() => ({
    total: filtered.reduce((s, r) => s + Number(r.commission_amount), 0),
    open: filtered.reduce((s, r) => s + Number(r.open_amount), 0),
  }), [filtered]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  if (loading) return <SkeletonTable rows={8} />;

  return (
    <div className="space-y-4">
      {error && <PageError message={error} onRetry={load} />}

      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Suche Provisionsnr., Auftrag, Kunde, Mitarbeiter…" value={search}
          onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-2" />Aktualisieren</Button>
        <div className="ml-auto text-sm text-muted-foreground">
          {filtered.length} Posten · Summe <span className="text-foreground font-medium">{fmtMoney(sums.total)}</span> · offen {fmtMoney(sums.open)}
        </div>
      </div>

      {perms.canManage && selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
          <span className="text-sm text-muted-foreground">{selected.size} ausgewählt</span>
          <Button size="sm" disabled={busy} onClick={() => call({ action: 'decide', decision: 'approve', entry_ids: [...selected] }, 'Provision freigegeben')}>
            <CheckCircle2 className="h-4 w-4 mr-2" />Freigeben
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setRejectOpen(true)}>
            <XCircle className="h-4 w-4 mr-2" />Ablehnen
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => call({ action: 'decide', decision: 'schedule', entry_ids: [...selected] }, 'Zur Auszahlung vorgemerkt')}>
            <CalendarClock className="h-4 w-4 mr-2" />Zur Auszahlung vormerken
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => call({ action: 'decide', decision: 'block', entry_ids: [...selected], reason: 'Manuell gesperrt' }, 'Provision gesperrt')}>
            <Ban className="h-4 w-4 mr-2" />Sperren
          </Button>
        </div>
      )}

      <DataCard className="overflow-hidden p-0">
        {filtered.length === 0 ? (
          <EmptyState icon={Coins} title="Keine Provisionen" description="In dieser Ansicht sind aktuell keine Provisionsposten vorhanden." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  {perms.canManage && <th className="w-10 p-3" />}
                  <th className="p-3 text-left">Provisionsnr.</th>
                  <th className="p-3 text-left">Mitarbeiter</th>
                  <th className="p-3 text-left">Auftrag</th>
                  <th className="p-3 text-left">Kunde</th>
                  <th className="p-3 text-right">Basis</th>
                  <th className="p-3 text-right">Satz</th>
                  <th className="p-3 text-right">Provision</th>
                  <th className="p-3 text-right">Offen</th>
                  <th className="p-3 text-left">Wirksam</th>
                  <th className="p-3 text-left">Zahltermin</th>
                  <th className="p-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t border-border hover:bg-muted/30 cursor-pointer" onClick={() => openDetail(r)}>
                    {perms.canManage && (
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} />
                      </td>
                    )}
                    <td className="p-3 font-mono text-xs">{r.entry_number}</td>
                    <td className="p-3">{names[r.employee_id] ?? '–'}</td>
                    <td className="p-3">{r.order_number ?? '–'}</td>
                    <td className="p-3">{r.customer_name ?? '–'}</td>
                    <td className="p-3 text-right">{fmtMoney(r.basis_amount, r.currency)}</td>
                    <td className="p-3 text-right">{r.commission_type === 'fixed_per_device' ? 'fix' : fmtPercent(r.commission_percent)}</td>
                    <td className="p-3 text-right font-medium">{fmtMoney(r.commission_amount, r.currency)}</td>
                    <td className="p-3 text-right">{fmtMoney(r.open_amount, r.currency)}</td>
                    <td className="p-3">{fmtDate(r.effective_at)}</td>
                    <td className="p-3">{fmtDate(r.payout_due_date)}</td>
                    <td className="p-3"><StatusPill status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataCard>

      {/* Detail-Panel */}
      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {detail && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {detail.entry_number} <StatusPill status={detail.status} />
                </SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-5">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Info label="Mitarbeiter" value={names[detail.employee_id]} />
                  <Info label="Rolle" value={EMPLOYEE_ROLES.find((r) => r.value === detail.employee_role)?.label} />
                  <Info label="Auftrag" value={detail.order_number} />
                  <Info label="Kunde" value={detail.customer_name} />
                  <Info label="Gerät" value={detail.device_name} />
                  <Info label="Anzahl Geräte" value={String(detail.device_count)} />
                  <Info label="Netto" value={fmtMoney(detail.net_amount, detail.currency)} />
                  <Info label="Brutto" value={fmtMoney(detail.gross_amount, detail.currency)} />
                  <Info label="Berechnungsgrundlage" value={fmtMoney(detail.basis_amount, detail.currency)} />
                  <Info label="Provisionssatz" value={fmtPercent(detail.commission_percent)} />
                  <Info label="Provisionsbetrag" value={fmtMoney(detail.commission_amount, detail.currency)} />
                  <Info label="Bereits ausgezahlt" value={fmtMoney(detail.paid_amount, detail.currency)} />
                  <Info label="Kunde bezahlt" value={fmtPercent(detail.customer_paid_percent)} />
                  <Info label="Wirksam ab" value={fmtDate(detail.effective_at)} />
                  <Info label="Zahltermin" value={fmtDate(detail.payout_due_date)} />
                  <Info label="Kostenstelle" value={detail.cost_center} />
                </div>

                {detail.block_reason && (
                  <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
                    Sperre / Ablehnung: {detail.block_reason}
                  </div>
                )}

                <div>
                  <h3 className="mb-2 text-sm font-semibold">Auszahlungsvoraussetzungen</h3>
                  <div className="space-y-1.5">
                    {conditions.length === 0 && <p className="text-sm text-muted-foreground">Keine Prüfungen hinterlegt.</p>}
                    {conditions.map((c) => (
                      <div key={c.id} className="flex items-center gap-2 text-sm">
                        <TrafficDot state={c.state} />
                        <span className="flex-1">{c.label}</span>
                        <span className="text-xs text-muted-foreground">{c.detail ?? ''}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-semibold">Provisionshistorie</h3>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {history.map((h) => (
                      <div key={h.id}>
                        {fmtDate(h.changed_at)} · {h.old_status ? `${STATUS_LABELS[h.old_status as CommissionStatus]} → ` : ''}
                        {STATUS_LABELS[h.new_status as CommissionStatus]}
                      </div>
                    ))}
                  </div>
                </div>

                {perms.canManage && (
                  <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                    <Button size="sm" disabled={busy} onClick={() => call({ action: 'recalc_entry', entry_id: detail.id }, 'Provision neu berechnet').then(() => setDetail(null))}>
                      <RefreshCw className="h-4 w-4 mr-2" />Neu berechnen
                    </Button>
                    <Button size="sm" disabled={busy} onClick={() => call({ action: 'decide', decision: 'approve', entry_ids: [detail.id] }, 'Provision freigegeben').then(() => setDetail(null))}>
                      <CheckCircle2 className="h-4 w-4 mr-2" />Freigeben
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => { setSelected(new Set([detail.id])); setRejectOpen(true); }}>
                      <XCircle className="h-4 w-4 mr-2" />Ablehnen
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => setReverseOpen(true)}>
                      <Undo2 className="h-4 w-4 mr-2" />Storno / Rückforderung
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Ablehnung */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Provision ablehnen</DialogTitle></DialogHeader>
          <Textarea placeholder="Begründung (Pflichtfeld)" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Abbrechen</Button>
            <Button disabled={!rejectReason.trim() || busy} onClick={async () => {
              const ok = await call({ action: 'decide', decision: 'reject', entry_ids: [...selected], reason: rejectReason }, 'Provision abgelehnt');
              if (ok) { setRejectOpen(false); setRejectReason(''); setDetail(null); }
            }}>Ablehnen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Storno / Rückforderung */}
      <Dialog open={reverseOpen} onOpenChange={setReverseOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Storno / Rückforderung</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={reverseCode} onValueChange={setReverseCode}>
              <SelectTrigger><SelectValue placeholder="Grund" /></SelectTrigger>
              <SelectContent>
                {REVERSAL_REASONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Textarea placeholder="Begründung" value={reverseReason} onChange={(e) => setReverseReason(e.target.value)} />
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={reverseReclaim} onCheckedChange={(v) => setReverseReclaim(!!v)} />
              Rückforderung erzeugen (negativer Provisionsposten)
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReverseOpen(false)}>Abbrechen</Button>
            <Button variant="destructive" disabled={!reverseReason.trim() || busy} onClick={async () => {
              const ok = await call({ action: 'reverse', entry_id: detail?.id, reason_code: reverseCode, reason: reverseReason, is_reclaim: reverseReclaim }, 'Vorgang gespeichert');
              if (ok) { setReverseOpen(false); setReverseReason(''); setDetail(null); }
            }}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm text-foreground">{value || '–'}</div>
    </div>
  );
}

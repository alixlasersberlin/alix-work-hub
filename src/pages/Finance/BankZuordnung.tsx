import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Banknote, CheckCircle2, HelpCircle, Layers, Loader2, RefreshCw, Search, ShieldAlert,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageHeader } from '@/components/infinity/PageHeader';
import { SkeletonTable } from '@/components/infinity/Skeleton';
import { EmptyState } from '@/components/infinity/EmptyState';
import { cn } from '@/lib/utils';

type Tx = {
  id: string;
  booking_date: string | null;
  value_date: string | null;
  amount: number | null;
  currency: string | null;
  sender_name: string | null;
  sender_iban: string | null;
  purpose: string | null;
  bank_account: string | null;
  status: string | null;
  is_allocated: boolean | null;
  allocated_amount: number | null;
  case_open: boolean | null;
  case_reason: string | null;
  best_score: number | null;
  best_invoice_id: string | null;
  best_invoice_number: string | null;
  best_customer_name: string | null;
  best_open_amount: number | null;
  best_reasons: string[] | null;
  best_suggested: number | null;
};

type Suggestion = {
  invoice_id: string;
  invoice_number: string | null;
  customer_id: string | null;
  customer_name: string | null;
  invoice_total: number | null;
  open_amount: number | null;
  due_date: string | null;
  currency: string | null;
  score: number | null;
  reasons: string[] | null;
  suggested_amount: number | null;
};

type Filter = 'neu' | 'vorschlag' | 'unklar' | 'teilzahlung' | 'ueberzahlung' | 'zugeordnet' | 'alle';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'neu', label: 'Neu' },
  { key: 'vorschlag', label: 'Vorschlag' },
  { key: 'unklar', label: 'Unklar' },
  { key: 'teilzahlung', label: 'Teilzahlung' },
  { key: 'ueberzahlung', label: 'Überzahlung' },
  { key: 'zugeordnet', label: 'Zugeordnet' },
  { key: 'alle', label: 'Alle' },
];

const CASE_REASONS = [
  'Zahler unbekannt', 'Rechnung nicht gefunden', 'Betrag unklar', 'Doppelzahlung vermutet',
  'Rückfrage beim Kunden', 'Sonstiges',
];

const fmt = (n: number | null | undefined, currency?: string | null) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: currency || 'EUR' }).format(Number(n || 0));

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString('de-DE') : '—';

const rpc = (name: string, args?: Record<string, unknown>) =>
  (supabase.rpc as unknown as (n: string, a?: Record<string, unknown>) => Promise<{ data: any; error: any }>)(name, args);

const scoreTone = (s: number) =>
  s >= 85 ? 'text-emerald-500' : s >= 70 ? 'text-amber-500' : s >= 40 ? 'text-orange-500' : 'text-muted-foreground';

export default function BankZuordnung() {
  const [rows, setRows] = useState<Tx[]>([]);
  const [kpi, setKpi] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('neu');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  // Schnellbestätigung
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [reviewOpen, setReviewOpen] = useState(false);

  // Detail / andere Rechnung
  const [detail, setDetail] = useState<Tx | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [group, setGroup] = useState<Suggestion[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [manualAmounts, setManualAmounts] = useState<Record<string, string>>({});

  // Klärung
  const [caseTx, setCaseTx] = useState<Tx | null>(null);
  const [caseReason, setCaseReason] = useState(CASE_REASONS[0]);
  const [caseNote, setCaseNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [list, dash] = await Promise.all([
      rpc('fibu_light_bank_list', { p_filter: filter, p_search: search || null, p_limit: 200 }),
      rpc('fibu_light_bank_dashboard'),
    ]);
    if (list.error) toast.error(list.error.message);
    setRows((list.data as Tx[]) || []);
    if (!dash.error) setKpi((dash.data as Record<string, number>) || {});
    setChecked({});
    setLoading(false);
  }, [filter, search]);

  useEffect(() => { void load(); }, [load]);

  const safeRows = useMemo(() => rows.filter((r) => !r.is_allocated && (r.best_score || 0) >= 85), [rows]);
  const selectedRows = useMemo(() => rows.filter((r) => checked[r.id]), [rows, checked]);

  const openDetail = async (tx: Tx) => {
    setDetail(tx);
    setDetailLoading(true);
    setManualAmounts({});
    const [s, g] = await Promise.all([
      rpc('fibu_light_bank_suggestions', { p_transaction_id: tx.id, p_limit: 6 }),
      rpc('fibu_light_bank_group_suggestion', { p_transaction_id: tx.id }),
    ]);
    setSuggestions((s.data as Suggestion[]) || []);
    setGroup(((g.data as Suggestion[]) || []).length > 1 ? (g.data as Suggestion[]) : []);
    setDetailLoading(false);
  };

  const confirm = async (
    tx: Tx,
    allocations: { invoice_id: string; amount: number; score?: number | null; reasons?: string[] | null }[],
    overpay: 'guthaben' | 'klaeren',
    source: string,
  ) => {
    const { data, error } = await rpc('fibu_light_bank_confirm', {
      p_transaction_id: tx.id,
      p_allocations: allocations,
      p_overpay: overpay,
      p_source: source,
    });
    if (error) throw new Error(error.message);
    return data;
  };

  const confirmBulk = async () => {
    setBusy(true);
    let ok = 0; let failed = 0;
    for (const tx of selectedRows) {
      try {
        await confirm(
          tx,
          [{ invoice_id: tx.best_invoice_id as string, amount: Number(tx.best_suggested || 0), score: tx.best_score, reasons: tx.best_reasons }],
          'guthaben',
          'vorschlag',
        );
        ok += 1;
      } catch (e) {
        failed += 1;
        toast.error(`${fmt(tx.amount, tx.currency)}: ${(e as Error).message}`);
      }
    }
    setBusy(false);
    setReviewOpen(false);
    toast.success(`${ok} Zuordnung(en) verbindlich gebucht${failed ? `, ${failed} abgewiesen` : ''}.`);
    void load();
  };

  const confirmSingle = async (
    allocations: { invoice_id: string; amount: number; score?: number | null; reasons?: string[] | null }[],
    overpay: 'guthaben' | 'klaeren',
  ) => {
    if (!detail) return;
    setBusy(true);
    try {
      await confirm(detail, allocations, overpay, 'manuell');
      toast.success('Zahlung zugeordnet.');
      setDetail(null);
      void load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const saveCase = async () => {
    if (!caseTx) return;
    setBusy(true);
    const { error } = await rpc('fibu_light_bank_set_case', {
      p_transaction_id: caseTx.id, p_reason: caseReason, p_note: caseNote || null, p_action: 'unklar',
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Klärungsfall angelegt.');
    setCaseTx(null); setCaseNote('');
    void load();
  };

  const kpiCards = [
    { label: 'Bankumsätze ungeprüft', value: kpi.ungeprueft ?? 0, icon: Banknote },
    { label: 'Zuordnungsvorschläge', value: kpi.vorschlaege ?? 0, icon: CheckCircle2 },
    { label: 'Unklare Zahlungen', value: kpi.unklar ?? 0, icon: HelpCircle },
    { label: 'Heute zugeordnet', value: kpi.heute_zugeordnet ?? 0, icon: Layers },
  ];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="Bank & Zuordnung"
        subtitle="Bankzahlung → Rechnung finden → Vorschlag → bestätigen → offener Posten ausgeglichen"
        icon={Banknote}
        noBreadcrumbs
        actions={
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} /> Aktualisieren
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <k.icon className="h-4 w-4" /> {k.label}
            </div>
            <div className="mt-2 text-2xl font-semibold">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <Button key={f.key} size="sm" variant={filter === f.key ? 'default' : 'outline'} onClick={() => setFilter(f.key)}>
            {f.label}
          </Button>
        ))}
        <div className="relative ml-auto w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Betrag, Kunde, Rechnung, Verwendungszweck, ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {safeRows.length > 0 && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-emerald-500">
            <CheckCircle2 className="h-4 w-4" /> Sichere Vorschläge ({safeRows.length})
          </div>
          <div className="space-y-2">
            {safeRows.map((r) => (
              <label key={r.id} className="flex flex-wrap items-center gap-3 text-sm">
                <Checkbox
                  checked={!!checked[r.id]}
                  onCheckedChange={(v) => setChecked((p) => ({ ...p, [r.id]: !!v }))}
                />
                <span className="font-medium">{fmt(r.amount, r.currency)}</span>
                <span className="text-muted-foreground">→</span>
                <span>{r.best_invoice_number}</span>
                <span className="text-muted-foreground">{r.best_customer_name}</span>
                <span className={cn('ml-auto text-xs font-semibold', scoreTone(r.best_score || 0))}>
                  {r.best_score}% Übereinstimmung
                </span>
              </label>
            ))}
          </div>
          <Button className="mt-3" disabled={selectedRows.length === 0} onClick={() => setReviewOpen(true)}>
            {selectedRows.length} Zuordnung(en) prüfen
          </Button>
        </div>
      )}

      {loading ? (
        <SkeletonTable />
      ) : rows.length === 0 ? (
        <EmptyState title="Keine Bankumsätze" description="Für diesen Filter liegen keine Bankumsätze vor." />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-semibold">{fmt(r.amount, r.currency)}</span>
                    <span className="text-sm text-muted-foreground">{r.sender_name || 'Unbekannter Zahler'}</span>
                    {r.is_allocated && <Badge variant="secondary">Zugeordnet</Badge>}
                    {r.case_open && <Badge variant="outline">Klärung: {r.case_reason}</Badge>}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Buchung {fmtDate(r.booking_date)} · Wertstellung {fmtDate(r.value_date)} · {r.bank_account || 'Bankkonto unbekannt'}
                  </div>
                  <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.purpose}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">Transaktions-ID: {r.id}</div>
                </div>

                {!r.is_allocated && r.best_invoice_id && (
                  <div className="w-full max-w-sm rounded-lg border border-border/60 bg-muted/30 p-3">
                    <div className={cn('text-sm font-semibold', scoreTone(r.best_score || 0))}>
                      {r.best_score}% Übereinstimmung
                    </div>
                    <div className="mt-1 text-sm">{r.best_invoice_number} · {r.best_customer_name}</div>
                    <div className="text-xs text-muted-foreground">Offen: {fmt(r.best_open_amount, r.currency)}</div>
                    <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                      {(r.best_reasons || []).map((x) => <li key={x}>✓ {x}</li>)}
                    </ul>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => void openDetail(r)}>Zahlung zuordnen</Button>
                      <Button size="sm" variant="outline" onClick={() => void openDetail(r)}>Andere Rechnung</Button>
                      <Button size="sm" variant="ghost" onClick={() => { setCaseTx(r); setCaseReason(CASE_REASONS[0]); }}>
                        Klären
                      </Button>
                    </div>
                  </div>
                )}

                {!r.is_allocated && !r.best_invoice_id && (
                  <div className="w-full max-w-sm rounded-lg border border-orange-500/40 bg-orange-500/5 p-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-orange-500">
                      <AlertTriangle className="h-4 w-4" /> Unklare Zahlung
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => void openDetail(r)}>Rechnung suchen</Button>
                      <Button size="sm" variant="ghost" onClick={() => { setCaseTx(r); setCaseReason(CASE_REASONS[0]); }}>
                        Klärungsfall anlegen
                      </Button>
                    </div>
                  </div>
                )}

                {r.is_allocated && (
                  <div className="w-full max-w-sm rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
                    Zugeordnet: {fmt(r.allocated_amount, r.currency)}
                    <div className="mt-1 text-xs text-muted-foreground">
                      Korrekturen ausschließlich über „Zuordnungsfehler melden“ in Finance.
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Zweite Bestätigung für Massenzuordnung */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{selectedRows.length} Zuordnungen prüfen</DialogTitle></DialogHeader>
          <div className="space-y-2 text-sm">
            {selectedRows.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-2">
                <span>{fmt(r.amount, r.currency)} → {r.best_invoice_number}</span>
                <span className="text-muted-foreground">{r.best_customer_name}</span>
                <span className={cn('text-xs font-semibold', scoreTone(r.best_score || 0))}>{r.best_score}%</span>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              Die Buchung erfolgt verbindlich und kann in FIBU LIGHT nicht gelöscht werden.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewOpen(false)}>Abbrechen</Button>
            <Button onClick={() => void confirmBulk()} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {selectedRows.length} Zahlungen verbindlich zuordnen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail: Vorschläge, Teil-, Sammel-, Über- und Unterzahlung */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>Bankzahlung zuordnen</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-4 text-sm">
              <div className="rounded-lg border border-border p-3">
                <div className="text-lg font-semibold">{fmt(detail.amount, detail.currency)}</div>
                <div className="text-muted-foreground">{detail.sender_name}</div>
                <div className="mt-1 text-xs text-muted-foreground">Verwendungszweck: {detail.purpose}</div>
              </div>

              {detailLoading ? (
                <SkeletonTable />
              ) : (
                <>
                  {group.length > 1 && (
                    <div className="rounded-lg border border-blue-500/40 bg-blue-500/5 p-3">
                      <div className="flex items-center gap-2 font-semibold text-blue-500">
                        <Layers className="h-4 w-4" /> Mögliche Sammelzahlung erkannt
                      </div>
                      <ul className="mt-2 space-y-1">
                        {group.map((g) => (
                          <li key={g.invoice_id} className="flex justify-between">
                            <span>{g.invoice_number}</span>
                            <span>{fmt(g.open_amount, detail.currency)}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-2 flex justify-between font-medium">
                        <span>Summe</span>
                        <span>{fmt(group.reduce((s, g) => s + Number(g.open_amount || 0), 0), detail.currency)}</span>
                      </div>
                      <Button
                        className="mt-3"
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          void confirmSingle(
                            group.map((g) => ({ invoice_id: g.invoice_id, amount: Number(g.open_amount || 0) })),
                            'guthaben',
                          )
                        }
                      >
                        Aufteilung bestätigen und zuordnen
                      </Button>
                    </div>
                  )}

                  {suggestions.length === 0 && (
                    <EmptyState title="Kein Vorschlag" description="Keine plausible Rechnung gefunden. Bitte Klärungsfall anlegen." />
                  )}

                  {suggestions.map((s) => {
                    const open = Number(s.open_amount || 0);
                    const amount = Number(detail.amount || 0);
                    const over = amount > open + 0.009;
                    const under = amount < open - 0.009;
                    const key = s.invoice_id;
                    const manual = manualAmounts[key] ?? String(Math.min(amount, open).toFixed(2));
                    return (
                      <div key={key} className="rounded-lg border border-border p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="font-medium">{s.invoice_number} · {s.customer_name}</div>
                            <div className="text-xs text-muted-foreground">
                              Offen: {fmt(open, s.currency)} · fällig {fmtDate(s.due_date)}
                            </div>
                          </div>
                          <div className={cn('text-sm font-semibold', scoreTone(s.score || 0))}>{s.score}% Übereinstimmung</div>
                        </div>
                        <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                          {(s.reasons || []).map((x) => <li key={x}>✓ {x}</li>)}
                        </ul>

                        {over && (
                          <div className="mt-2 rounded border border-amber-500/40 bg-amber-500/5 p-2 text-xs">
                            ÜBERZAHLUNG {fmt(amount - open, s.currency)} — {fmt(open, s.currency)} auf die Rechnung,
                            Rest als ungeklärtes Kundenguthaben. Keine automatische Verrechnung.
                          </div>
                        )}
                        {under && (
                          <div className="mt-2 rounded border border-blue-500/40 bg-blue-500/5 p-2 text-xs">
                            Differenz {fmt(open - amount, s.currency)} — als Teilzahlung buchen oder Differenz klären.
                            Keine Ausbuchung durch FIBU LIGHT.
                          </div>
                        )}

                        <div className="mt-3 flex flex-wrap items-end gap-2">
                          <div>
                            <Label className="text-xs">Zuzuordnender Betrag</Label>
                            <Input
                              className="w-36"
                              value={manual}
                              onChange={(e) => setManualAmounts((p) => ({ ...p, [key]: e.target.value }))}
                            />
                          </div>
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              void confirmSingle(
                                [{ invoice_id: s.invoice_id, amount: Number(String(manual).replace(',', '.')), score: s.score, reasons: s.reasons }],
                                'guthaben',
                              )
                            }
                          >
                            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Zahlung zuordnen
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setCaseTx(detail); setDetail(null); }}>
                            Klären
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Klärungsfall */}
      <Dialog open={!!caseTx} onOpenChange={(o) => !o && setCaseTx(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Klärungsfall anlegen</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldAlert className="h-4 w-4" /> Der Bankumsatz bleibt vollständig erhalten.
            </div>
            <div>
              <Label>Grund</Label>
              <select
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={caseReason}
                onChange={(e) => setCaseReason(e.target.value)}
              >
                {CASE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <Label>Notiz</Label>
              <Textarea value={caseNote} onChange={(e) => setCaseNote(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCaseTx(null)}>Abbrechen</Button>
            <Button onClick={() => void saveCase()} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

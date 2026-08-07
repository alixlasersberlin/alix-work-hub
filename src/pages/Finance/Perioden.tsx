import { useEffect, useMemo, useState } from 'react';
import { CalendarCheck, Lock, LockOpen, Loader2, RefreshCw, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DataCard } from '@/components/PageShell';
import { PageHeader } from '@/components/infinity/PageHeader';
import { SkeletonTable } from '@/components/infinity/Skeleton';
import { KpiTile } from '@/components/infinity/KpiTile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { useAccountingRegion } from '@/contexts/AccountingRegionContext';
import { useAuth } from '@/hooks/useAuth';
import { useFinancePermissions } from '@/hooks/useFinancePermissions';
import { RegionChip } from '@/components/finance/RegionChip';
import { regionCurrency, regionFileName } from '@/lib/finance/region';

const MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

type Period = {
  id: string;
  accounting_region: 'EU' | 'CH';
  fiscal_year: number;
  period_month: number;
  status: string;
  closed_at: string | null;
  closed_by: string | null;
  reopened_at: string | null;
  note: string | null;
};

type MonthStat = { count: number; net: number; vat: number; gross: number };

const STATUS_META: Record<string, { label: string; cls: string }> = {
  open: { label: 'offen', cls: 'bg-emerald-500/10 border-emerald-500/40 text-emerald-500' },
  soft_closed: { label: 'vorläufig geschlossen', cls: 'bg-yellow-500/10 border-yellow-500/40 text-yellow-500' },
  hard_locked: { label: 'hart gesperrt', cls: 'bg-red-500/10 border-red-500/40 text-red-500' },
  geschlossen: { label: 'geschlossen', cls: 'bg-red-500/10 border-red-500/40 text-red-500' },
};

export default function Perioden() {
  const { region } = useAccountingRegion();
  const { hasRole } = useAuth();
  const { canWrite } = useFinancePermissions();
  const isSuperAdmin = hasRole('Super Admin');
  const currency = regionCurrency(region);

  const [year, setYear] = useState(new Date().getFullYear());
  const [rows, setRows] = useState<Period[]>([]);
  const [stats, setStats] = useState<Record<number, MonthStat>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    const from = `${year}-01-01`;
    const to = `${year}-12-31`;
    const [{ data: per, error: perErr }, { data: jour, error: jErr }] = await Promise.all([
      (supabase as any).from('finance_periods').select('*')
        .in('accounting_region', String(region) === 'ALL' ? ['EU','CH'] : [region]).eq('fiscal_year', year).order('period_month'),
      (supabase as any).from('finance_journal')
        .select('booking_date, amount_net, amount_vat, amount_gross')
        .in('accounting_region', String(region) === 'ALL' ? ['EU','CH'] : [region]).gte('booking_date', from).lte('booking_date', to),
    ]);
    if (perErr) toast({ title: 'Fehler', description: perErr.message, variant: 'destructive' });
    if (jErr) toast({ title: 'Fehler', description: jErr.message, variant: 'destructive' });
    setRows((per as Period[]) ?? []);
    const agg: Record<number, MonthStat> = {};
    for (const j of (jour as any[]) ?? []) {
      const m = Number(String(j.booking_date).slice(5, 7));
      const cur = agg[m] ?? { count: 0, net: 0, vat: 0, gross: 0 };
      cur.count += 1;
      cur.net += Number(j.amount_net ?? 0);
      cur.vat += Number(j.amount_vat ?? 0);
      cur.gross += Number(j.amount_gross ?? 0);
      agg[m] = cur;
    }
    setStats(agg);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [region, year]);

  const fmt = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(n || 0);

  const totals = useMemo(() => {
    const all = Object.values(stats);
    const closed = rows.filter(r => r.status !== 'open').length;
    return {
      gross: all.reduce((s, x) => s + x.gross, 0),
      count: all.reduce((s, x) => s + x.count, 0),
      closed,
      open: 12 - closed,
    };
  }, [stats, rows]);

  const initYear = async () => {
    const existing = new Set(rows.map(r => r.period_month));
    const toCreate = Array.from({ length: 12 }, (_, i) => i + 1)
      .filter(m => !existing.has(m))
      .map(m => ({ accounting_region: (String(region) === 'ALL' ? 'EU' : region), fiscal_year: year, period_month: m, status: 'open' }));
    if (!toCreate.length) return toast({ title: 'Alle Perioden bereits angelegt' });
    const { error } = await (supabase as any).from('finance_periods').insert(toCreate);
    if (error) return toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    toast({ title: `${toCreate.length} Perioden angelegt` });
    load();
  };

  const setStatus = async (month: number, status: string) => {
    const row = rows.find(r => r.period_month === month) ?? null;
    if (status === 'open' && row && row.status !== 'open' && !isSuperAdmin) {
      return toast({ title: 'Nicht erlaubt', description: 'Nur Super Admin darf Perioden wieder öffnen.', variant: 'destructive' });
    }
    setBusy(month);
    const closing = status !== 'open';
    const patch: Record<string, unknown> = {
      status,
      closed_at: closing ? new Date().toISOString() : null,
      closed_by: closing ? (await supabase.auth.getUser()).data.user?.id ?? null : null,
    };
    if (!closing) patch.reopened_at = new Date().toISOString();
    const { error } = row
      ? await (supabase as any).from('finance_periods').update(patch).eq('id', row.id)
      : await (supabase as any).from('finance_periods').insert({
          accounting_region: (String(region) === 'ALL' ? 'EU' : region), fiscal_year: year, period_month: month, ...patch,
        });
    setBusy(null);
    if (error) return toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    toast({ title: `${MONTHS[month - 1]} ${year}: ${STATUS_META[status]?.label ?? status}` });
    load();
  };

  const exportCsv = () => {
    const head = ['Monat', 'Status', 'Buchungen', 'Netto', 'USt/MwSt', 'Brutto', 'Geschlossen am'];
    const lines = Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
      const r = rows.find(x => x.period_month === m);
      const s = stats[m] ?? { count: 0, net: 0, vat: 0, gross: 0 };
      return [
        `${MONTHS[m - 1]} ${year}`,
        STATUS_META[r?.status ?? 'open']?.label ?? (r?.status ?? 'offen'),
        s.count, s.net.toFixed(2), s.vat.toFixed(2), s.gross.toFixed(2),
        r?.closed_at ? new Date(r.closed_at).toLocaleDateString('de-DE') : '',
      ].join(';');
    });
    const blob = new Blob(['\ufeff' + [head.join(';'), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = regionFileName(`Periodenabschluss_${year}`, region, 'csv');
    a.click();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={CalendarCheck}
        title="Periodenabschluss & Periodensperre"
        subtitle="Monatsperioden schließen — gesperrte Perioden lassen keine Buchungen mehr zu"
        actions={
          <div className="flex items-center gap-2">
            <RegionChip />
            <Input type="number" value={year} onChange={e => setYear(parseInt(e.target.value) || year)} className="w-24 h-9" />
            <Button size="sm" variant="outline" onClick={load}><RefreshCw className="w-4 h-4 mr-1" />Aktualisieren</Button>
            <Button size="sm" variant="outline" onClick={exportCsv}><Download className="w-4 h-4 mr-1" />CSV</Button>
            {canWrite && <Button size="sm" onClick={initYear}>Jahr initialisieren</Button>}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile label="Offene Perioden" value={String(totals.open)} icon={LockOpen} />
        <KpiTile label="Geschlossene Perioden" value={String(totals.closed)} icon={Lock} />
        <KpiTile label="Buchungen im Jahr" value={String(totals.count)} icon={CalendarCheck} />
        <KpiTile label="Brutto-Volumen" value={fmt(totals.gross)} icon={CalendarCheck} />
      </div>

      <DataCard title={`Perioden ${region} · Geschäftsjahr ${year}`}>
        {loading ? (
          <SkeletonTable rows={6} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
              const r = rows.find(x => x.period_month === m) ?? null;
              const status = r?.status ?? 'open';
              const meta = STATUS_META[status] ?? STATUS_META.open;
              const s = stats[m] ?? { count: 0, net: 0, vat: 0, gross: 0 };
              const locked = status !== 'open';
              return (
                <div key={m} className={`rounded-lg border p-3 ${meta.cls.replace(/text-[a-z-0-9]+/, '')}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm">{MONTHS[m - 1]} {year}</span>
                    {locked ? <Lock className="w-4 h-4 text-red-500" /> : <LockOpen className="w-4 h-4 text-emerald-500" />}
                  </div>
                  <Badge variant="outline" className={`text-[10px] mb-2 ${meta.cls}`}>{meta.label}</Badge>
                  <div className="text-[11px] text-muted-foreground space-y-0.5">
                    <div>{s.count} Buchungen</div>
                    <div>Netto {fmt(s.net)}</div>
                    <div>Brutto {fmt(s.gross)}</div>
                    {r?.closed_at && <div>geschlossen {new Date(r.closed_at).toLocaleDateString('de-DE')}</div>}
                  </div>
                  {canWrite && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {busy === m ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs"
                            disabled={locked && !isSuperAdmin}
                            onClick={() => setStatus(m, 'open')}>Öffnen</Button>
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-yellow-500"
                            onClick={() => setStatus(m, 'soft_closed')}>Vorläufig</Button>
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-red-500"
                            onClick={() => {
                              if (confirm(`${MONTHS[m - 1]} ${year} (${region}) hart sperren? Danach sind keine Buchungen mehr möglich.`)) setStatus(m, 'hard_locked');
                            }}>Sperren</Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground mt-4">
          Gesperrte Perioden blockieren Anlegen, Ändern und Löschen in Buchungen, Journal, Kassenbuch und Bankbuchungen — getrennt je Buchungskreis. Wiedereröffnen ist ausschließlich Super Admin vorbehalten.
        </p>
      </DataCard>
    </div>
  );
}

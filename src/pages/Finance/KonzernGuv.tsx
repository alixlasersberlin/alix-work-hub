import { useEffect, useMemo, useState } from 'react';
import { Globe2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DataCard } from '@/components/PageShell';
import { PageHeader } from '@/components/infinity/PageHeader';
import { SkeletonTable } from '@/components/infinity/Skeleton';
import { InfinityStatusBadge } from '@/components/infinity/StatusBadge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

type Tx = { amount: number; transaction_type: string | null; booking_date: string; accounting_region: 'EU' | 'CH' | null; is_intercompany?: boolean | null };
type Ii = { amount_gross: number | null; amount_net: number | null; description: string | null; accounting_region: 'EU' | 'CH' | null };
type Afa = { amount: number; period: string; accounting_region?: 'EU' | 'CH' | null };

const fmtEur = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n || 0);

export default function KonzernGuv() {
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [eu, setEu] = useState<{ tx: Tx[]; ii: Ii[]; afa: Afa[] }>({ tx: [], ii: [], afa: [] });
  const [ch, setCh] = useState<{ tx: Tx[]; ii: Ii[]; afa: Afa[] }>({ tx: [], ii: [], afa: [] });
  const [chfRate, setChfRate] = useState(1);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const s = `${year}-01-01`, e = `${year}-12-31`;
      const [t, ii, afa, fx] = await Promise.all([
        supabase.from('finance_transactions').select('amount, transaction_type, booking_date, accounting_region, is_intercompany').gte('booking_date', s).lte('booking_date', e),
        supabase.from('finance_incoming_invoices').select('amount_gross, amount_net, description, accounting_region').gte('invoice_date', s).lte('invoice_date', e),
        supabase.from('finance_asset_depreciations').select('amount, period').gte('period', s).lte('period', e),
        supabase.from('finance_fx_rates' as any).select('rate_to_eur').eq('currency', 'CHF').lte('rate_date', e).order('rate_date', { ascending: false }).limit(1),
      ]);
      const txAll = (t.data ?? []) as Tx[];
      const iiAll = (ii.data ?? []) as Ii[];
      const afaAll = (afa.data ?? []) as Afa[];
      setEu({ tx: txAll.filter(r => r.accounting_region !== 'CH'), ii: iiAll.filter(r => r.accounting_region !== 'CH'), afa: afaAll });
      setCh({ tx: txAll.filter(r => r.accounting_region === 'CH'), ii: iiAll.filter(r => r.accounting_region === 'CH'), afa: [] });
      setChfRate(Number(((fx.data as any[])?.[0]?.rate_to_eur) ?? 1) || 1);
      setLoading(false);
    })();
  }, [year]);

  const compute = (set: { tx: Tx[]; ii: Ii[]; afa: Afa[] }) => {
    const lower = (s: string | null) => (s || '').toLowerCase();
    const umsatz = set.tx.filter(r => !r.is_intercompany && ['rechnung', 'einnahme', 'erlös', 'erloes'].some(x => lower(r.transaction_type).includes(x))).reduce((s, r) => s + Math.abs(Number(r.amount) || 0), 0);
    const wareneinsatz = set.ii.filter(r => (r.description || '').toLowerCase().includes('warenein')).reduce((s, r) => s + (Number(r.amount_net || r.amount_gross) || 0), 0);
    const sbA = set.ii.filter(r => !(r.description || '').toLowerCase().includes('warenein')).reduce((s, r) => s + (Number(r.amount_net || r.amount_gross) || 0), 0);
    const sonstigeAufw = set.tx.filter(r => !r.is_intercompany && ['ausgabe', 'aufwand'].some(x => lower(r.transaction_type).includes(x))).reduce((s, r) => s + Math.abs(Number(r.amount) || 0), 0);
    const abschr = set.afa.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const zinsen = set.tx.filter(r => lower(r.transaction_type).includes('zins')).reduce((s, r) => s + Math.abs(Number(r.amount) || 0), 0);
    return { umsatz, wareneinsatz, sbA, sonstigeAufw, abschr, zinsen };
  };

  const dataEu = useMemo(() => compute(eu), [eu]);
  const dataChLocal = useMemo(() => compute(ch), [ch]);
  const dataCh = useMemo(() => {
    const k = chfRate;
    return {
      umsatz: dataChLocal.umsatz * k, wareneinsatz: dataChLocal.wareneinsatz * k,
      sbA: dataChLocal.sbA * k, sonstigeAufw: dataChLocal.sonstigeAufw * k,
      abschr: dataChLocal.abschr * k, zinsen: dataChLocal.zinsen * k,
    };
  }, [dataChLocal, chfRate]);

  // Intercompany elimination proxy: umsatz vs intercompany-flagged tx
  const icEliminationEu = useMemo(
    () => eu.tx.filter(r => r.is_intercompany).reduce((s, r) => s + Math.abs(Number(r.amount) || 0), 0),
    [eu.tx]
  );
  const icEliminationCh = useMemo(
    () => ch.tx.filter(r => r.is_intercompany).reduce((s, r) => s + Math.abs(Number(r.amount) || 0), 0) * chfRate,
    [ch.tx, chfRate]
  );

  const sum = (a: number, b: number) => a + b;
  const total = {
    umsatz: sum(dataEu.umsatz, dataCh.umsatz),
    wareneinsatz: sum(dataEu.wareneinsatz, dataCh.wareneinsatz),
    sbA: sum(dataEu.sbA, dataCh.sbA),
    sonstigeAufw: sum(dataEu.sonstigeAufw, dataCh.sonstigeAufw),
    abschr: sum(dataEu.abschr, dataCh.abschr),
    zinsen: sum(dataEu.zinsen, dataCh.zinsen),
    icElim: icEliminationEu + icEliminationCh,
  };

  const rohertragBrutto = total.umsatz - total.wareneinsatz;
  const rohertrag = rohertragBrutto - total.icElim;
  const betriebsergebnis = rohertrag - total.sbA - total.sonstigeAufw - total.abschr;
  const ergebnisVorSteuern = betriebsergebnis - total.zinsen;

  const Row = ({ label, eu, ch, konz, bold, elim }: { label: string; eu: number; ch: number; konz: number; bold?: boolean; elim?: number }) => (
    <tr className={bold ? 'bg-primary/5 border-t border-border font-bold' : 'border-t border-border/40'}>
      <td className="px-4 py-2">{label}</td>
      <td className="px-4 py-2 text-right tabular-nums">{fmtEur(eu)}</td>
      <td className="px-4 py-2 text-right tabular-nums">{fmtEur(ch)}</td>
      <td className="px-4 py-2 text-right tabular-nums text-destructive">{elim ? `-${fmtEur(elim)}` : ''}</td>
      <td className="px-4 py-2 text-right tabular-nums">{fmtEur(konz)}</td>
    </tr>
  );

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <PageHeader
        icon={Globe2}
        title="Konzern-GuV · 🇪🇺 EU + 🇨🇭 CH"
        subtitle={`Konsolidierte Gewinn- und Verlustrechnung · Geschäftsjahr ${year} · CHF-Kurs ${chfRate.toFixed(4)}`}
        noBreadcrumbs
        meta={<InfinityStatusBadge kind={loading ? 'progress' : 'done'} label={loading ? 'Lädt' : 'Konsolidiert'} pulse={loading} />}
        actions={
          <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
            <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{[year + 1, year, year - 1, year - 2].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
        }
      />

      <div className="flex flex-wrap gap-2 text-xs">
        <Badge variant="outline">🇪🇺 EU: EUR</Badge>
        <Badge variant="outline">🇨🇭 CH → EUR via FX {chfRate.toFixed(4)}</Badge>
        <Badge variant="outline">Intercompany eliminiert: {fmtEur(total.icElim)}</Badge>
      </div>

      <DataCard title="Konsolidierte GuV-Aufstellung (alles in EUR)">
        {loading ? <SkeletonTable rows={9} cols={5} /> : (
          <table className="w-full text-sm">
            <thead className="text-muted-foreground text-xs uppercase">
              <tr className="border-b border-border/40">
                <th className="text-left px-4 py-2">Position</th>
                <th className="text-right px-4 py-2">🇪🇺 EU</th>
                <th className="text-right px-4 py-2">🇨🇭 CH</th>
                <th className="text-right px-4 py-2">Elim.</th>
                <th className="text-right px-4 py-2">Konzern</th>
              </tr>
            </thead>
            <tbody>
              <Row label="1. Umsatzerlöse" eu={dataEu.umsatz} ch={dataCh.umsatz} konz={total.umsatz} />
              <Row label="2. Wareneinsatz" eu={-dataEu.wareneinsatz} ch={-dataCh.wareneinsatz} konz={-total.wareneinsatz} />
              <Row label="3. Intercompany-Eliminierung" eu={0} ch={0} konz={-total.icElim} elim={total.icElim} />
              <Row label="= Rohertrag" eu={dataEu.umsatz - dataEu.wareneinsatz} ch={dataCh.umsatz - dataCh.wareneinsatz} konz={rohertrag} bold />
              <Row label="4. Sonstige betriebliche Aufwendungen" eu={-dataEu.sbA} ch={-dataCh.sbA} konz={-total.sbA} />
              <Row label="5. Sonstige Aufwendungen" eu={-dataEu.sonstigeAufw} ch={-dataCh.sonstigeAufw} konz={-total.sonstigeAufw} />
              <Row label="6. Abschreibungen" eu={-dataEu.abschr} ch={-dataCh.abschr} konz={-total.abschr} />
              <Row label="= Betriebsergebnis (EBIT)" eu={dataEu.umsatz - dataEu.wareneinsatz - dataEu.sbA - dataEu.sonstigeAufw - dataEu.abschr} ch={dataCh.umsatz - dataCh.wareneinsatz - dataCh.sbA - dataCh.sonstigeAufw - dataCh.abschr} konz={betriebsergebnis} bold />
              <Row label="7. Zinsaufwand" eu={-dataEu.zinsen} ch={-dataCh.zinsen} konz={-total.zinsen} />
              <Row label="= Ergebnis vor Steuern (EBT)" eu={(dataEu.umsatz - dataEu.wareneinsatz - dataEu.sbA - dataEu.sonstigeAufw - dataEu.abschr) - dataEu.zinsen} ch={(dataCh.umsatz - dataCh.wareneinsatz - dataCh.sbA - dataCh.sonstigeAufw - dataCh.abschr) - dataCh.zinsen} konz={ergebnisVorSteuern} bold />
            </tbody>
          </table>
        )}
      </DataCard>

      <div className="text-xs text-muted-foreground">
        Hinweis: Vereinfachte konsolidierte GuV. CHF-Positionen werden mit dem letzten hinterlegten FX-Kurs zum Bilanzstichtag umgerechnet. Intercompany-Eliminierung basiert auf <code>is_intercompany = true</code>-markierten Buchungen.
      </div>
    </div>
  );
}

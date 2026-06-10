import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader, PageLoading, DataCard } from '@/components/PageShell';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const fmt = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n || 0);

export default function FinanceGuV() {
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [tx, setTx] = useState<any[]>([]);
  const [afa, setAfa] = useState<any[]>([]);
  const [incoming, setIncoming] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const s = `${year}-01-01`, e = `${year}-12-31`;
      const [t, a, ii] = await Promise.all([
        supabase.from('finance_transactions').select('amount, transaction_type, booking_date').gte('booking_date', s).lte('booking_date', e),
        supabase.from('finance_asset_depreciations').select('amount, period').gte('period', s).lte('period', e),
        supabase.from('finance_incoming_invoices').select('amount_gross, amount_net, description').gte('invoice_date', s).lte('invoice_date', e),
      ]);
      setTx(t.data ?? []);
      setAfa(a.data ?? []);
      setIncoming(ii.data ?? []);
      setLoading(false);
    })();
  }, [year]);

  const data = useMemo(() => {
    const lower = (s: string) => (s || '').toLowerCase();
    const umsatz = tx.filter(r => ['rechnung', 'einnahme', 'erlös', 'erloes'].some(x => lower(r.transaction_type).includes(x))).reduce((s, r) => s + Math.abs(Number(r.amount) || 0), 0);
    const wareneinsatz = (incoming as any[]).filter(r => (r.description || '').toLowerCase().includes('warenein')).reduce((s, r) => s + (Number(r.amount_net || r.amount_gross) || 0), 0);
    const sbA = (incoming as any[]).filter(r => !(r.description || '').toLowerCase().includes('warenein')).reduce((s, r) => s + (Number(r.amount_net || r.amount_gross) || 0), 0);
    const sonstigeAufw = tx.filter(r => ['ausgabe', 'aufwand'].some(x => lower(r.transaction_type).includes(x))).reduce((s, r) => s + Math.abs(Number(r.amount) || 0), 0);
    const abschr = afa.reduce((s, r) => s + Number(r.amount) || 0, 0);
    const zinsen = tx.filter(r => lower(r.transaction_type).includes('zins')).reduce((s, r) => s + Math.abs(Number(r.amount) || 0), 0);
    return { umsatz, wareneinsatz, sbA, sonstigeAufw, abschr, zinsen };
  }, [tx, afa, incoming]);

  const rohertrag = data.umsatz - data.wareneinsatz;
  const betriebsergebnis = rohertrag - data.sbA - data.sonstigeAufw - data.abschr;
  const ergebnisVorSteuern = betriebsergebnis - data.zinsen;

  if (loading) return <PageLoading />;

  const Row = ({ label, val, bold }: { label: string; val: number; bold?: boolean }) => (
    <tr className={bold ? 'bg-primary/5 border-t border-border font-bold' : 'border-t border-border/40'}>
      <td className="px-4 py-2">{label}</td>
      <td className="px-4 py-2 text-right tabular-nums">{fmt(val)}</td>
    </tr>
  );

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Gewinn- und Verlustrechnung" subtitle={`§ 275 HGB Gesamtkostenverfahren · ${year}`} />
      <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
        <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
        <SelectContent>{[year + 1, year, year - 1, year - 2].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
      </Select>

      <DataCard title="GuV-Schema">
        <table className="w-full text-sm">
          <tbody>
            <Row label="1. Umsatzerlöse" val={data.umsatz} />
            <Row label="2. Wareneinsatz" val={-data.wareneinsatz} />
            <Row label="= Rohertrag" val={rohertrag} bold />
            <Row label="3. Sonst. betriebliche Aufwendungen (Eingangsrechnungen)" val={-data.sbA} />
            <Row label="4. Sonstige Aufwendungen (gebucht)" val={-data.sonstigeAufw} />
            <Row label="5. Abschreibungen auf Anlagen" val={-data.abschr} />
            <Row label="= Betriebsergebnis (EBIT)" val={betriebsergebnis} bold />
            <Row label="6. Zinsaufwendungen" val={-data.zinsen} />
            <Row label="= Ergebnis vor Steuern (EBT)" val={ergebnisVorSteuern} bold />
          </tbody>
        </table>
      </DataCard>
    </div>
  );
}

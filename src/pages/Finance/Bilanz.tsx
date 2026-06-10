import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader, PageLoading, DataCard } from '@/components/PageShell';
import { Input } from '@/components/ui/input';

const fmt = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n || 0);

export default function FinanceBilanz() {
  const [loading, setLoading] = useState(true);
  const [stichtag, setStichtag] = useState(new Date().toISOString().slice(0, 10));
  const [assets, setAssets] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [bankLines, setBankLines] = useState<any[]>([]);
  const [incoming, setIncoming] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [a, ac, bl, ii] = await Promise.all([
        supabase.from('finance_assets').select('book_value, acquisition_value, status, acquisition_date').lte('acquisition_date', stichtag),
        supabase.from('finance_accounts').select('current_balance, overdue_balance'),
        supabase.from('finance_bank_lines').select('amount, value_date, statement_id').lte('value_date', stichtag),
        supabase.from('finance_incoming_invoices').select('amount_gross, paid_at, invoice_date').lte('invoice_date', stichtag),
      ]);
      setAssets(a.data ?? []);
      setAccounts(ac.data ?? []);
      setBankLines(bl.data ?? []);
      setIncoming(ii.data ?? []);
      setLoading(false);
    })();
  }, [stichtag]);

  const data = useMemo(() => {
    const anlagevermoegen = assets.filter(a => a.status !== 'abgegangen' && a.status !== 'verkauft' && a.status !== 'verschrottet').reduce((s, a) => s + Number(a.book_value || 0), 0);
    const forderungen = accounts.reduce((s, a) => s + Number(a.current_balance || 0), 0);
    const bank = bankLines.reduce((s, l) => s + Number(l.amount || 0), 0);
    const verbindlichkeiten = (incoming as any[]).filter(i => !i.paid_at).reduce((s, i) => s + Number(i.amount_gross || 0), 0);
    const aktivaSumme = anlagevermoegen + forderungen + Math.max(bank, 0);
    const eigenkapital = aktivaSumme - verbindlichkeiten;
    return { anlagevermoegen, forderungen, bank, verbindlichkeiten, aktivaSumme, eigenkapital };
  }, [assets, accounts, bankLines, incoming]);

  if (loading) return <PageLoading />;

  const Row = ({ label, val, bold }: { label: string; val: number; bold?: boolean }) => (
    <tr className={bold ? 'bg-primary/5 border-t border-border font-bold' : 'border-t border-border/40'}>
      <td className="px-4 py-2">{label}</td>
      <td className="px-4 py-2 text-right tabular-nums">{fmt(val)}</td>
    </tr>
  );

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Bilanz (vereinfacht)" subtitle={`Stichtag ${new Date(stichtag).toLocaleDateString('de-DE')}`} />
      <Input type="date" value={stichtag} onChange={e => setStichtag(e.target.value)} className="w-48" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <DataCard title="AKTIVA">
          <table className="w-full text-sm">
            <tbody>
              <Row label="A. Anlagevermögen" val={data.anlagevermoegen} bold />
              <Row label="B. Umlaufvermögen" val={data.forderungen + Math.max(data.bank, 0)} bold />
              <Row label="  Forderungen aus L+L" val={data.forderungen} />
              <Row label="  Bankguthaben / Kasse" val={Math.max(data.bank, 0)} />
              <Row label="Summe Aktiva" val={data.aktivaSumme} bold />
            </tbody>
          </table>
        </DataCard>

        <DataCard title="PASSIVA">
          <table className="w-full text-sm">
            <tbody>
              <Row label="A. Eigenkapital (Restgröße)" val={data.eigenkapital} bold />
              <Row label="B. Verbindlichkeiten" val={data.verbindlichkeiten} bold />
              <Row label="  davon Verb. aus L+L (offene Eingangsrg.)" val={data.verbindlichkeiten} />
              <Row label="Summe Passiva" val={data.eigenkapital + data.verbindlichkeiten} bold />
            </tbody>
          </table>
        </DataCard>
      </div>

      <div className="text-xs text-muted-foreground">
        Hinweis: Vereinfachte HGB-nahe Auswertung. Für die offizielle Bilanz bitte Steuerberater/DATEV-Abschluss verwenden.
      </div>
    </div>
  );
}

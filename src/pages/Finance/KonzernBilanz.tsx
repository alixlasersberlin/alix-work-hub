import { useEffect, useMemo, useState } from 'react';
import { Globe2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DataCard } from '@/components/PageShell';
import { PageHeader } from '@/components/infinity/PageHeader';
import { SkeletonTable } from '@/components/infinity/Skeleton';
import { InfinityStatusBadge } from '@/components/infinity/StatusBadge';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

const fmtEur = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n || 0);

type Asset = { book_value: number | null; status: string | null; acquisition_date: string };
type Acc = { current_balance: number | null; overdue_balance: number | null; accounting_region: 'EU' | 'CH' | null };
type BankLine = { amount: number; value_date: string; accounting_region: 'EU' | 'CH' | null };
type Ii = { amount_gross: number | null; paid_at: string | null; invoice_date: string; accounting_region: 'EU' | 'CH' | null };

export default function KonzernBilanz() {
  const [loading, setLoading] = useState(true);
  const [stichtag, setStichtag] = useState(new Date().toISOString().slice(0, 10));
  const [chfRate, setChfRate] = useState(1);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [accounts, setAccounts] = useState<Acc[]>([]);
  const [bankLines, setBankLines] = useState<BankLine[]>([]);
  const [incoming, setIncoming] = useState<Ii[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [a, ac, bl, ii, fx] = await Promise.all([
        supabase.from('finance_assets').select('book_value, status, acquisition_date').lte('acquisition_date', stichtag),
        supabase.from('finance_accounts').select('current_balance, overdue_balance, accounting_region'),
        supabase.from('finance_bank_lines').select('amount, value_date, accounting_region').lte('value_date', stichtag),
        supabase.from('finance_incoming_invoices').select('amount_gross, paid_at, invoice_date, accounting_region').lte('invoice_date', stichtag),
        supabase.from('finance_fx_rates' as any).select('rate_to_eur').eq('currency', 'CHF').lte('rate_date', stichtag).order('rate_date', { ascending: false }).limit(1),
      ]);
      setAssets((a.data ?? []) as any);
      setAccounts((ac.data ?? []) as any);
      setBankLines((bl.data ?? []) as any);
      setIncoming((ii.data ?? []) as any);
      setChfRate(Number(((fx.data as any[])?.[0]?.rate_to_eur) ?? 1) || 1);
      setLoading(false);
    })();
  }, [stichtag]);

  const bucket = (region: 'EU' | 'CH') => {
    const anlage = assets.filter(a => a.status !== 'abgegangen' && a.status !== 'verkauft' && a.status !== 'verschrottet').reduce((s, a) => s + Number(a.book_value || 0), 0);
    // Anlagen können nicht per accounting_region getrennt werden (Feld fehlt in finance_assets),
    // daher zeigen wir sie komplett unter EU.
    const forderungen = accounts.filter(x => (x.accounting_region ?? 'EU') === region).reduce((s, x) => s + Number(x.current_balance || 0), 0);
    const bank = bankLines.filter(x => (x.accounting_region ?? 'EU') === region).reduce((s, x) => s + Number(x.amount || 0), 0);
    const verbindlichkeiten = incoming.filter(x => (x.accounting_region ?? 'EU') === region && !x.paid_at).reduce((s, x) => s + Number(x.amount_gross || 0), 0);
    return { anlage: region === 'EU' ? anlage : 0, forderungen, bank, verbindlichkeiten };
  };

  const eu = useMemo(() => bucket('EU'), [assets, accounts, bankLines, incoming]);
  const chLocal = useMemo(() => bucket('CH'), [assets, accounts, bankLines, incoming]);
  const ch = useMemo(() => ({
    anlage: chLocal.anlage * chfRate,
    forderungen: chLocal.forderungen * chfRate,
    bank: chLocal.bank * chfRate,
    verbindlichkeiten: chLocal.verbindlichkeiten * chfRate,
  }), [chLocal, chfRate]);

  const total = {
    anlage: eu.anlage + ch.anlage,
    forderungen: eu.forderungen + ch.forderungen,
    bank: Math.max(eu.bank, 0) + Math.max(ch.bank, 0),
    verbindlichkeiten: eu.verbindlichkeiten + ch.verbindlichkeiten,
  };
  const aktivaSumme = total.anlage + total.forderungen + total.bank;
  const eigenkapital = aktivaSumme - total.verbindlichkeiten;

  const Row = ({ label, eu, ch, konz, bold }: { label: string; eu: number; ch: number; konz: number; bold?: boolean }) => (
    <tr className={bold ? 'bg-primary/5 border-t border-border font-bold' : 'border-t border-border/40'}>
      <td className="px-4 py-2">{label}</td>
      <td className="px-4 py-2 text-right tabular-nums">{fmtEur(eu)}</td>
      <td className="px-4 py-2 text-right tabular-nums">{fmtEur(ch)}</td>
      <td className="px-4 py-2 text-right tabular-nums">{fmtEur(konz)}</td>
    </tr>
  );

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <PageHeader
        icon={Globe2}
        title="Konzern-Bilanz · 🇪🇺 EU + 🇨🇭 CH"
        subtitle={`Konsolidierte Bilanz zum ${new Date(stichtag).toLocaleDateString('de-DE')} · CHF-Kurs ${chfRate.toFixed(4)}`}
        noBreadcrumbs
        meta={<InfinityStatusBadge kind={loading ? 'progress' : 'done'} label={loading ? 'Lädt' : 'Konsolidiert'} pulse={loading} />}
        actions={<Input type="date" value={stichtag} onChange={e => setStichtag(e.target.value)} className="w-44 h-9" />}
      />

      <div className="flex flex-wrap gap-2 text-xs">
        <Badge variant="outline">Alle Beträge in EUR</Badge>
        <Badge variant="outline">🇨🇭 CH via FX-Kurs {chfRate.toFixed(4)}</Badge>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DataCard><SkeletonTable rows={5} cols={4} /></DataCard>
          <DataCard><SkeletonTable rows={4} cols={4} /></DataCard>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DataCard title="AKTIVA">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground text-xs uppercase">
                <tr className="border-b border-border/40">
                  <th className="text-left px-4 py-2">Position</th>
                  <th className="text-right px-4 py-2">🇪🇺 EU</th>
                  <th className="text-right px-4 py-2">🇨🇭 CH</th>
                  <th className="text-right px-4 py-2">Konzern</th>
                </tr>
              </thead>
              <tbody>
                <Row label="A. Anlagevermögen" eu={eu.anlage} ch={ch.anlage} konz={total.anlage} bold />
                <Row label="B. Umlaufvermögen" eu={eu.forderungen + Math.max(eu.bank, 0)} ch={ch.forderungen + Math.max(ch.bank, 0)} konz={total.forderungen + total.bank} bold />
                <Row label="  Forderungen aus L+L" eu={eu.forderungen} ch={ch.forderungen} konz={total.forderungen} />
                <Row label="  Bankguthaben / Kasse" eu={Math.max(eu.bank, 0)} ch={Math.max(ch.bank, 0)} konz={total.bank} />
                <Row label="Summe Aktiva" eu={eu.anlage + eu.forderungen + Math.max(eu.bank, 0)} ch={ch.anlage + ch.forderungen + Math.max(ch.bank, 0)} konz={aktivaSumme} bold />
              </tbody>
            </table>
          </DataCard>

          <DataCard title="PASSIVA">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground text-xs uppercase">
                <tr className="border-b border-border/40">
                  <th className="text-left px-4 py-2">Position</th>
                  <th className="text-right px-4 py-2">🇪🇺 EU</th>
                  <th className="text-right px-4 py-2">🇨🇭 CH</th>
                  <th className="text-right px-4 py-2">Konzern</th>
                </tr>
              </thead>
              <tbody>
                <Row label="A. Eigenkapital (Restgröße)" eu={eu.anlage + eu.forderungen + Math.max(eu.bank, 0) - eu.verbindlichkeiten} ch={ch.anlage + ch.forderungen + Math.max(ch.bank, 0) - ch.verbindlichkeiten} konz={eigenkapital} bold />
                <Row label="B. Verbindlichkeiten" eu={eu.verbindlichkeiten} ch={ch.verbindlichkeiten} konz={total.verbindlichkeiten} bold />
                <Row label="  davon Verb. aus L+L (offen)" eu={eu.verbindlichkeiten} ch={ch.verbindlichkeiten} konz={total.verbindlichkeiten} />
                <Row label="Summe Passiva" eu={eu.anlage + eu.forderungen + Math.max(eu.bank, 0)} ch={ch.anlage + ch.forderungen + Math.max(ch.bank, 0)} konz={aktivaSumme} bold />
              </tbody>
            </table>
          </DataCard>
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        Hinweis: Vereinfachte konsolidierte Bilanz. CHF-Positionen werden mit dem letzten hinterlegten FX-Kurs zum Bilanzstichtag umgerechnet. Anlagevermögen wird derzeit dem EU-Kreis zugeordnet, da in <code>finance_assets</code> keine Regionentrennung existiert.
      </div>
    </div>
  );
}

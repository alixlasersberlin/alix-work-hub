import { useEffect, useState } from 'react';
import { Wallet, Banknote, AlertTriangle, ArrowDownToLine, Landmark, BookOpen } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { KpiTile } from '@/components/infinity/KpiTile';

const fmt = (n: number) => (n || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

export default function Zahlungsuebersicht() {
  const [k, setK] = useState({ offeneRg: 0, offeneAnz: 0, ueberfaellig: 0, eingaenge: 0, kasse: 0, bank: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [accs, tx, dep, cb, bp] = await Promise.all([
        (supabase as any).from('finance_accounts').select('current_balance, overdue_balance'),
        (supabase as any).from('finance_transactions').select('amount, transaction_type'),
        (supabase as any).from('finance_deposits').select('open_amount'),
        (supabase as any).from('finance_cashbook').select('amount_gross, booking_type, status'),
        (supabase as any).from('finance_bank_postings').select('amount, posting_type, status'),
      ]);
      const offeneRg = (accs.data || []).reduce((s: number, a: any) => s + Number(a.current_balance || 0), 0);
      const ueberfaellig = (accs.data || []).reduce((s: number, a: any) => s + Number(a.overdue_balance || 0), 0);
      const offeneAnz = (dep.data || []).reduce((s: number, d: any) => s + Number(d.open_amount || 0), 0);
      const eingaenge = (tx.data || []).filter((t: any) => t.transaction_type === 'Zahlung').reduce((s: number, t: any) => s + Number(t.amount || 0), 0);
      const kasseEin = (cb.data || []).filter((r: any) => r.status === 'aktiv' && r.booking_type === 'einnahme').reduce((s: number, r: any) => s + Number(r.amount_gross || 0), 0);
      const kasseAus = (cb.data || []).filter((r: any) => r.status === 'aktiv' && r.booking_type === 'ausgabe').reduce((s: number, r: any) => s + Number(r.amount_gross || 0), 0);
      const bankIn = (bp.data || []).filter((r: any) => r.status === 'aktiv' && ['eingang','erstattung'].includes(r.posting_type)).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
      const bankOut = (bp.data || []).filter((r: any) => r.status === 'aktiv' && ['ausgang','lastschrift','ruecklastschrift'].includes(r.posting_type)).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
      setK({ offeneRg, offeneAnz, ueberfaellig, eingaenge, kasse: kasseEin - kasseAus, bank: bankIn - bankOut });
      setLoading(false);
    })();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <PageHeader icon={Wallet} title="Zahlungsübersicht" subtitle="Konsolidierte Sicht über Forderungen, Eingänge und Bestände" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiTile label="Offene Rechnungen" value={loading ? '…' : fmt(k.offeneRg)} icon={Banknote} accent="gold" />
        <KpiTile label="Überfällige Forderungen" value={loading ? '…' : fmt(k.ueberfaellig)} icon={AlertTriangle} accent="rose" />
        <KpiTile label="Offene Anzahlungen" value={loading ? '…' : fmt(k.offeneAnz)} icon={Wallet} accent="sky" />
        <KpiTile label="Zahlungseingänge" value={loading ? '…' : fmt(k.eingaenge)} icon={ArrowDownToLine} accent="emerald" />
        <KpiTile label="Kassenbestand" value={loading ? '…' : fmt(k.kasse)} icon={BookOpen} accent="gold" />
        <KpiTile label="Bankbestand (manuelle Buchungen)" value={loading ? '…' : fmt(k.bank)} icon={Landmark} accent="violet" />
      </div>
    </div>
  );
}

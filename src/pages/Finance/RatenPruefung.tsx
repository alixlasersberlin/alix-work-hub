import { useEffect, useMemo, useState } from 'react';
import { SearchCheck, Loader2, Undo2, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DataCard, PageError } from '@/components/PageShell';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { useAccountingRegion } from '@/contexts/AccountingRegionContext';
import { useFinancePermissions } from '@/hooks/useFinancePermissions';

const fmt = (n: number, c = 'EUR') =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: c, maximumFractionDigits: 2 }).format(n || 0);
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('de-DE') : '—');

type Profile = {
  id: string;
  recurrence_name: string | null;
  reference_number: string | null;
  customer_name: string | null;
  company_name: string | null;
  start_date: string | null;
  end_date: string | null;
  last_sent_date: string | null;
  total: number | null;
  currency: string | null;
  updated_at?: string | null;
};

export default function RatenPruefung() {
  const { region } = useAccountingRegion();
  const { canWrite } = useFinancePermissions();
  const [rows, setRows] = useState<Profile[]>([]);
  const [held, setHeld] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('zoho_recurring_profiles')
      .select('id, recurrence_name, reference_number, customer_name, company_name, start_date, end_date, last_sent_date, total, currency, updated_at')
      .eq('accounting_region', region === 'CH' ? 'CH' : 'EU')
      .eq('status', 'pruefung_hold')
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(2000);
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    const list = (data ?? []) as Profile[];
    setRows(list);
    if (list.length) {
      const { data: inv } = await supabase
        .from('ratenplan_generated_invoices')
        .select('profile_id')
        .in('profile_id', list.map(p => p.id))
        .eq('status', 'zurueckgehalten');
      const counts: Record<string, number> = {};
      for (const r of (inv ?? []) as any[]) counts[r.profile_id] = (counts[r.profile_id] ?? 0) + 1;
      setHeld(counts);
    } else {
      setHeld({});
    }
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [region]);

  /** Zurück in Wiederkehrende Zahler → zurückgehaltene Rechnungen automatisch versenden */
  async function release(p: Profile) {
    if (!confirm(`Vertrag „${p.recurrence_name || p.reference_number || ''}“ zurück in Wiederkehrende Zahler?\n\nAlle zurückgehaltenen Rechnungen werden jetzt automatisch an den Kunden versendet.`)) return;
    setBusy(p.id);
    const { error } = await supabase
      .from('zoho_recurring_profiles')
      .update({ status: 'active' } as any)
      .eq('id', p.id);
    if (error) {
      setBusy(null);
      toast({ title: 'Zurückholen fehlgeschlagen', description: error.message, variant: 'destructive' });
      return;
    }
    const { data, error: fnErr } = await supabase.functions.invoke('pruefung-release', {
      body: { profile_id: p.id },
    });
    setBusy(null);
    if (fnErr) {
      toast({ title: 'Vertrag zurückgeholt – Versand fehlgeschlagen', description: fnErr.message, variant: 'destructive' });
    } else {
      const sent = (data as any)?.sent ?? 0;
      toast({ title: 'Zurückgeholt', description: `${sent} zurückgehaltene Rechnung(en) versendet.` });
    }
    setRows(prev => prev.filter(r => r.id !== p.id));
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      `${r.recurrence_name ?? ''} ${r.reference_number ?? ''} ${r.customer_name ?? ''} ${r.company_name ?? ''}`
        .toLowerCase().includes(q));
  }, [rows, search]);

  const sum = filtered.reduce((a, r) => a + Number(r.total || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={SearchCheck}
        title="PRÜFUNG"
        subtitle="Rechnungen werden weiterhin erzeugt, aber nicht an den Kunden versendet – beim Zurückholen erfolgt der Versand automatisch"
      />

      {error && <PageError message={error} onRetry={load} />}

      <DataCard>
        <div className="flex items-center gap-3 p-3 border-b border-border">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Kunde, Referenz…" className="pl-8" />
          </div>
          <Badge variant="secondary">{filtered.length} Verträge</Badge>
          <div className="ml-auto text-sm font-semibold tabular-nums">{fmt(sum)}</div>
        </div>

        {loading ? (
          <div className="p-8 flex items-center justify-center text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Lade…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Keine Verträge in Prüfung.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left px-3 py-2">Kunde</th>
                  <th className="text-left px-3 py-2">Vertrag / Referenz</th>
                  <th className="text-left px-3 py-2">Start</th>
                  <th className="text-left px-3 py-2">Letzter Versand</th>
                  <th className="text-center px-3 py-2">Zurückgehalten</th>
                  <th className="text-right px-3 py-2">Rate</th>
                  <th className="text-right px-3 py-2">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.id} className={i % 2 ? 'bg-muted/30' : ''}>
                    <td className="px-3 py-2 font-semibold">{r.company_name || r.customer_name || '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.reference_number || r.recurrence_name || '—'}</td>
                    <td className="px-3 py-2">{fmtDate(r.start_date)}</td>
                    <td className="px-3 py-2">{fmtDate(r.last_sent_date)}</td>
                    <td className="px-3 py-2 text-center">
                      <Badge variant={held[r.id] ? 'default' : 'secondary'}>{held[r.id] ?? 0}</Badge>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt(Number(r.total || 0), r.currency || 'EUR')}</td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canWrite || busy === r.id}
                        onClick={() => release(r)}
                        title="Zurück zu Wiederkehrende Zahler – zurückgehaltene Rechnungen werden versendet"
                      >
                        {busy === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Undo2 className="w-3.5 h-3.5 mr-1" />}
                        Zurück & versenden
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataCard>
    </div>
  );
}

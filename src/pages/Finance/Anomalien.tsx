import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader, PageLoading, DataCard } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Play, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { fmt } from './_controlling';

const SEVERITY_COLOR: Record<string, string> = {
  high: 'bg-red-500/15 text-red-500',
  medium: 'bg-amber-500/15 text-amber-500',
  low: 'bg-blue-500/15 text-blue-500',
};
const REASON_LABEL: Record<string, string> = {
  zscore_outlier: 'Statistischer Ausreißer',
  duplicate_suspect: 'Duplikat-Verdacht',
  round_large_amount: 'Auffällig runder Betrag',
  unusual_supplier: 'Ungewöhnlicher Lieferant',
};

export default function FinanceAnomalien() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<'open' | 'reviewed' | 'dismissed' | 'all'>('open');
  const [scanning, setScanning] = useState(false);

  async function load() {
    setLoading(true);
    let q: any = supabase.from('finance_anomalies' as any).select('*').order('detected_at', { ascending: false }).limit(500);
    if (statusFilter !== 'all') q = q.eq('status', statusFilter);
    const { data } = await q;
    setRows((data as any[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [statusFilter]);

  async function runScan() {
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke('finance-anomaly-detect', { body: {} });
      if (error) throw error;
      toast.success(`Scan abgeschlossen: ${(data as any)?.created ?? 0} neue Treffer`);
      await load();
    } catch (e: any) { toast.error(e.message || 'Scan fehlgeschlagen'); }
    finally { setScanning(false); }
  }

  async function setStatus(id: string, status: 'reviewed' | 'dismissed') {
    const { error } = await supabase.from('finance_anomalies' as any).update({
      status, reviewed_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Aktualisiert');
    await load();
  }

  if (loading) return <PageLoading />;

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Anomalie-Erkennung" subtitle="Auffälligkeiten in Transaktionen & Eingangsrechnungen" />
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Offen</SelectItem>
            <SelectItem value="reviewed">Geprüft</SelectItem>
            <SelectItem value="dismissed">Verworfen</SelectItem>
            <SelectItem value="all">Alle</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={runScan} disabled={scanning} variant="outline">
          {scanning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
          Scan jetzt starten
        </Button>
      </div>

      <DataCard title={`${rows.length} Treffer`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="px-3 py-2 text-left">Datum</th>
                <th className="px-3 py-2 text-left">Quelle</th>
                <th className="px-3 py-2 text-left">Grund</th>
                <th className="px-3 py-2 text-left">Severity</th>
                <th className="px-3 py-2 text-right">Betrag</th>
                <th className="px-3 py-2 text-left">Beschreibung</th>
                <th className="px-3 py-2 text-right">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t border-border/40">
                  <td className="px-3 py-2 whitespace-nowrap">{new Date(r.detected_at).toLocaleDateString('de-DE')}</td>
                  <td className="px-3 py-2">{r.source_type === 'transaction' ? 'Transaktion' : 'Eingangsrechnung'}</td>
                  <td className="px-3 py-2">{REASON_LABEL[r.reason] || r.reason}</td>
                  <td className="px-3 py-2"><Badge className={SEVERITY_COLOR[r.severity] || ''}>{r.severity}</Badge></td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.amount ? fmt(Number(r.amount)) : '–'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.description}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {r.status === 'open' ? (
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="outline" onClick={() => setStatus(r.id, 'reviewed')}><Check className="h-3 w-3" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => setStatus(r.id, 'dismissed')}><X className="h-3 w-3" /></Button>
                      </div>
                    ) : <Badge variant="secondary">{r.status}</Badge>}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">Keine Treffer</td></tr>}
            </tbody>
          </table>
        </div>
      </DataCard>
    </div>
  );
}

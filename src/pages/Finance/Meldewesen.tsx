import { useEffect, useState } from 'react';
import { FileSpreadsheet, Loader2, Download, Play } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader, PageLoading, DataCard, PageEmpty } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';

type FilingType = 'ustva' | 'zm' | 'oss' | 'intrastat' | 'ebilanz';
const TYPES: { value: FilingType; label: string; period: string }[] = [
  { value: 'ustva', label: 'UStVA (ELSTER)', period: '2026-03' },
  { value: 'zm', label: 'Zusammenfassende Meldung', period: '2026-Q1' },
  { value: 'oss', label: 'OSS-Meldung', period: '2026-Q1' },
  { value: 'intrastat', label: 'Intrastat', period: '2026-03' },
  { value: 'ebilanz', label: 'E-Bilanz', period: '2026' },
];

export default function FinanceMeldewesen() {
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<any[]>([]);
  const [filings, setFilings] = useState<any[]>([]);
  const [tab, setTab] = useState<FilingType>('ustva');
  const [period, setPeriod] = useState('2026-03');
  const [tenantId, setTenantId] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: t }, { data: f }] = await Promise.all([
      supabase.from('tenants' as any).select('id,name,flag_emoji').eq('is_active', true).order('sort_order'),
      supabase.from('finance_tax_filings' as any).select('*').order('created_at', { ascending: false }).limit(100),
    ]);
    setTenants((t ?? []) as any);
    setFilings((f ?? []) as any);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const def = TYPES.find((x) => x.value === tab)?.period;
    if (def) setPeriod(def);
  }, [tab]);

  const tname = (id: string | null) => {
    const t = tenants.find((x) => x.id === id);
    return t ? `${t.flag_emoji ?? ''} ${t.name}`.trim() : '–';
  };

  const generate = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('finance-tax-export', {
        body: { filing_type: tab, period_value: period, tenant_id: tenantId || null },
      });
      if (error) throw error;
      toast({ title: 'Meldung erzeugt', description: `${(data as any)?.filing_id?.slice(0, 8)}…` });
      load();
    } catch (e: any) {
      toast({ title: 'Fehler', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const downloadFiling = (f: any) => {
    if (!f.export_content) return toast({ title: 'Keine Exportdatei', variant: 'destructive' });
    const ext = f.export_format === 'xml' ? 'xml' : f.export_format === 'csv' ? 'csv' : 'txt';
    const blob = new Blob([f.export_content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${f.filing_type}-${f.period_value}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <PageLoading />;

  const filtered = filings.filter((f) => f.filing_type === tab);

  return (
    <div className="space-y-6 container mx-auto px-4 py-8">
      <PageHeader
        title="Steuer & Meldewesen"
        subtitle={`${filings.length} Meldungen insgesamt`}
        icon={FileSpreadsheet}
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as FilingType)}>
        <TabsList>
          {TYPES.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
          ))}
        </TabsList>

        {TYPES.map((t) => (
          <TabsContent key={t.value} value={t.value} className="space-y-4">
            <DataCard title={`Neue ${t.label} erzeugen`}>
              <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
                <select value={tenantId} onChange={(e) => setTenantId(e.target.value)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">Alle Mandanten</option>
                  {tenants.map((x) => <option key={x.id} value={x.id}>{tname(x.id)}</option>)}
                </select>
                <Input placeholder="Periode (z. B. 2026-03 oder 2026-Q1)" value={period}
                  onChange={(e) => setPeriod(e.target.value)} />
                <div className="md:col-span-2">
                  <Button onClick={generate} disabled={busy}>
                    {busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Play className="w-4 h-4 mr-1.5" />}
                    Erzeugen
                  </Button>
                </div>
              </div>
            </DataCard>

            {filtered.length === 0 ? <PageEmpty message="Noch keine Meldungen dieses Typs." /> : (
              <DataCard title={`${filtered.length} ${t.label}`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border/40 text-muted-foreground">
                      <tr>
                        <th className="text-left p-3">Periode</th>
                        <th className="text-left p-3">Mandant</th>
                        <th className="text-right p-3">Summe</th>
                        <th className="text-center p-3">Status</th>
                        <th className="text-left p-3">Format</th>
                        <th className="p-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((f) => (
                        <tr key={f.id} className="border-b border-border/20">
                          <td className="p-3 font-medium">{f.period_value}</td>
                          <td className="p-3">{tname(f.tenant_id)}</td>
                          <td className="p-3 text-right">
                            {new Intl.NumberFormat('de-DE', { style: 'currency', currency: f.currency || 'EUR' })
                              .format(Number(f.total_amount ?? 0))}
                          </td>
                          <td className="p-3 text-center"><Badge variant="outline">{f.status}</Badge></td>
                          <td className="p-3 uppercase text-xs">{f.export_format ?? '–'}</td>
                          <td className="p-3 text-right">
                            {f.export_content && (
                              <Button size="sm" variant="outline" onClick={() => downloadFiling(f)}>
                                <Download className="w-4 h-4 mr-1.5" />Download
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </DataCard>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

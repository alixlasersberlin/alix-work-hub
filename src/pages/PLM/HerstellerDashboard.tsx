import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart3, Loader2 } from 'lucide-react';
import { findDuplicateGroups } from '@/lib/plm/manufacturers';

function Kpi({ label, value, tone }: { label: string; value: number | string; tone?: 'ok' | 'bad' | 'warn' }) {
  const cls = tone === 'ok' ? 'text-emerald-500' : tone === 'bad' ? 'text-destructive' : tone === 'warn' ? 'text-amber-500' : 'text-foreground';
  return (
    <Card><CardContent className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-semibold ${cls}`}>{value}</p>
    </CardContent></Card>
  );
}

export default function PlmHerstellerDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [mfrs, setMfrs] = useState<any[]>([]);
  const [parts, setParts] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [m, p, l, d] = await Promise.all([
      (supabase.from('plm_manufacturers' as any) as any).select('*').limit(2000),
      (supabase.from('plm_parts' as any) as any).select('id,name,part_number,manufacturer_id,manufacturer_part_number,price,moq').limit(5000),
      (supabase.from('plm_manufacturer_suppliers' as any) as any).select('manufacturer_id,price,moq').limit(5000),
      (supabase.from('plm_manufacturer_documents' as any) as any).select('manufacturer_id,valid_until,doc_type').limit(5000),
    ]);
    setMfrs((m.data as any[]) || []);
    setParts((p.data as any[]) || []);
    setLinks((l.data as any[]) || []);
    setDocs((d.data as any[]) || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="p-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  const today = new Date();
  const in30 = new Date(today.getTime() + 30 * 864e5);
  const isSoon = (d?: string | null) => !!d && new Date(d) <= in30;

  const approved = mfrs.filter(m => m.approval_status === 'freigegeben');
  const blocked = mfrs.filter(m => m.approval_status === 'gesperrt');
  const certSoon = mfrs.filter(m => isSoon(m.cert_valid_until)).concat(docs.filter(x => isSoon(x.valid_until)) as any);
  const auditsDue = mfrs.filter(m => isSoon(m.next_audit_date));
  const newMfrs = mfrs.filter(m => new Date(m.created_at).getTime() > today.getTime() - 30 * 864e5);
  const critical = mfrs.filter(m => m.is_critical);
  const partsNoMfr = parts.filter(p => !p.manufacturer_id);
  const partsNoMpn = parts.filter(p => !p.manufacturer_part_number);
  const docMfrIds = new Set(docs.map(d => d.manufacturer_id));
  const partsNoCert = parts.filter(p => p.manufacturer_id && !docMfrIds.has(p.manufacturer_id));
  const dupes = findDuplicateGroups(mfrs);

  const volume = new Map<string, number>();
  for (const p of parts) if (p.manufacturer_id) volume.set(p.manufacturer_id, (volume.get(p.manufacturer_id) || 0) + (Number(p.price) || 0) * (Number(p.moq) || 1));
  for (const l of links) if (l.manufacturer_id) volume.set(l.manufacturer_id, (volume.get(l.manufacturer_id) || 0) + (Number(l.price) || 0) * (Number(l.moq) || 1));
  const top20 = [...volume.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)
    .map(([id, v]) => ({ m: mfrs.find(x => x.id === id), v })).filter(x => x.m);

  return (
    <div className="container max-w-[1600px] py-6 space-y-6">
      <PageHeader icon={BarChart3} title="Hersteller-Dashboard (MFR)" subtitle="Kennzahlen zu Herstellern, Zertifikaten, Audits und Datenqualität." noBreadcrumbs />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Hersteller gesamt" value={mfrs.length} />
        <Kpi label="Freigegeben" value={approved.length} tone="ok" />
        <Kpi label="Gesperrt" value={blocked.length} tone="bad" />
        <Kpi label="Zertifikate laufen in 30 Tagen ab" value={certSoon.length} tone="warn" />
        <Kpi label="Audits fällig" value={auditsDue.length} tone="warn" />
        <Kpi label="Neue Hersteller (30 Tage)" value={newMfrs.length} />
        <Kpi label="Kritische Lieferanten" value={critical.length} tone="warn" />
        <Kpi label="Dubletten-Gruppen" value={dupes.length} tone={dupes.length ? 'warn' : 'ok'} />
        <Kpi label="Teile ohne Hersteller" value={partsNoMfr.length} tone={partsNoMfr.length ? 'bad' : 'ok'} />
        <Kpi label="Teile ohne Hersteller-Partnummer" value={partsNoMpn.length} tone={partsNoMpn.length ? 'warn' : 'ok'} />
        <Kpi label="Teile ohne Zertifikate" value={partsNoCert.length} tone={partsNoCert.length ? 'warn' : 'ok'} />
        <Kpi label="Hersteller/Lieferant-Verknüpfungen" value={links.length} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => navigate('/produktion/hersteller')}>Herstellerliste</Button>
        <Button variant="outline" onClick={() => navigate('/produktion/hersteller-dubletten')}>Dubletten prüfen</Button>
        <Button variant="outline" onClick={() => navigate('/produktion/bom-import')}>BOM-Import</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Top 20 Hersteller nach Einkaufsvolumen (kalkuliert)</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {top20.length ? top20.map(({ m, v }) => (
            <div key={m.id} className="flex items-center gap-3 text-sm border-b border-border/60 pb-2 last:border-0 cursor-pointer"
              onClick={() => navigate(`/produktion/hersteller/${m.id}`)}>
              <span className="flex-1">{m.name}</span>
              <Badge variant="outline">{v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}</Badge>
            </div>
          )) : <p className="text-sm text-muted-foreground">Noch keine Preisdaten hinterlegt.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

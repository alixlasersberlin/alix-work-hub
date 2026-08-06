import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart3, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { plmLabel, statusTone } from '@/lib/plm/config';

interface Row { id: string; [k: string]: any }
const pct = (n: number) => `${(n * 100).toFixed(1)} %`;
const days = (a?: string | null, b?: string | null) =>
  a && b ? Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)) : null;

const toneClass: Record<string, string> = {
  ok: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  warn: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  bad: 'bg-destructive/15 text-destructive border-destructive/30',
  muted: 'bg-muted text-muted-foreground border-border',
};

export default function PlmQualitaetskennzahlen() {
  const [loading, setLoading] = useState(true);
  const [receipts, setReceipts] = useState<Row[]>([]);
  const [changes, setChanges] = useState<Row[]>([]);
  const [orders, setOrders] = useState<Row[]>([]);
  const [parts, setParts] = useState<Row[]>([]);
  const [docs, setDocs] = useState<Row[]>([]);

  useEffect(() => {
    (async () => {
      const [g, c, o, p, d] = await Promise.all([
        supabase.from('plm_goods_receipts' as any).select('*').limit(5000),
        supabase.from('plm_changes' as any).select('*').limit(2000),
        supabase.from('plm_production_orders' as any).select('*').limit(2000),
        supabase.from('plm_parts' as any).select('id,name,part_number,release_status,criticality,blocked').limit(5000),
        supabase.from('plm_documents' as any).select('id,title,release_status,valid_until').limit(2000),
      ]);
      const err = g.error || c.error || o.error || p.error || d.error;
      if (err) toast.error(err.message);
      setReceipts((g.data as any[]) || []);
      setChanges((c.data as any[]) || []);
      setOrders((o.data as any[]) || []);
      setParts((p.data as any[]) || []);
      setDocs((d.data as any[]) || []);
      setLoading(false);
    })();
  }, []);

  const m = useMemo(() => {
    const weTotal = receipts.length;
    const weInspected = receipts.filter(r => r.inspection_result && r.inspection_result !== 'offen').length;
    const weBad = receipts.filter(r => r.blocked || ['abweichung', 'gesperrt', 'rueckgesendet'].includes(r.inspection_result)).length;

    const changeDurations = changes
      .map(c => days(c.created_at, c.approved_at))
      .filter((n): n is number => n !== null);
    const avgChange = changeDurations.length
      ? Math.round(changeDurations.reduce((a, b) => a + b, 0) / changeDurations.length)
      : null;

    const openChanges = changes.filter(c => !['umgesetzt', 'geschlossen', 'abgelehnt'].includes(c.status));
    const lateOrders = orders.filter(o => o.planned_end && !o.actual_end && new Date(o.planned_end) < new Date());
    const doneOrders = orders.filter(o => ['fertig', 'freigegeben'].includes(o.status));
    const onTime = doneOrders.filter(o => o.planned_end && o.actual_end && new Date(o.actual_end) <= new Date(o.planned_end)).length;

    return {
      weTotal, weInspected, weBad,
      inspectRate: weTotal ? weInspected / weTotal : 0,
      defectRate: weTotal ? weBad / weTotal : 0,
      avgChange,
      openChanges: openChanges.length,
      lateOrders: lateOrders.length,
      onTimeRate: doneOrders.length ? onTime / doneOrders.length : 0,
      blockedParts: parts.filter(p => p.blocked).length,
      unreleasedParts: parts.filter(p => p.release_status !== 'freigegeben').length,
      criticalParts: parts.filter(p => ['hoch', 'sicherheitsrelevant'].includes(p.criticality)).length,
      expiredDocs: docs.filter(d => d.valid_until && new Date(d.valid_until) < new Date()).length,
      openChangeList: openChanges.slice(0, 15),
      deviationList: receipts.filter(r => r.blocked || ['abweichung', 'gesperrt', 'rueckgesendet'].includes(r.inspection_result)).slice(0, 15),
    };
  }, [receipts, changes, orders, parts, docs]);

  const kpis = [
    { label: 'Prüfquote Wareneingang', value: pct(m.inspectRate), tone: m.inspectRate >= 0.95 ? 'ok' : 'warn' },
    { label: 'Fehlerquote Wareneingang', value: pct(m.defectRate), tone: m.defectRate <= 0.05 ? 'ok' : 'bad' },
    { label: 'Ø Genehmigungsdauer ECR/ECO', value: m.avgChange === null ? '—' : `${m.avgChange} Tage`, tone: 'muted' },
    { label: 'Offene Änderungen', value: m.openChanges, tone: m.openChanges ? 'warn' : 'ok' },
    { label: 'Termintreue Produktion', value: pct(m.onTimeRate), tone: m.onTimeRate >= 0.9 ? 'ok' : 'warn' },
    { label: 'Verzögerte Aufträge', value: m.lateOrders, tone: m.lateOrders ? 'bad' : 'ok' },
    { label: 'Gesperrte Teile', value: m.blockedParts, tone: m.blockedParts ? 'bad' : 'ok' },
    { label: 'Abgelaufene Dokumente', value: m.expiredDocs, tone: m.expiredDocs ? 'bad' : 'ok' },
  ];

  return (
    <div className="container max-w-7xl py-6 space-y-6">
      <PageHeader
        icon={BarChart3}
        title="Qualitätskennzahlen"
        subtitle="QM-Kennzahlen für Managementbewertung und Audits nach ISO 13485 / MDR."
        noBreadcrumbs
      />

      {loading ? (
        <div className="flex items-center gap-2 p-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Lade …</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {kpis.map(k => (
              <Card key={k.label}>
                <CardContent className="p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{k.label}</div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-2xl font-semibold">{k.value}</span>
                    <Badge variant="outline" className={toneClass[k.tone]}>&nbsp;</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Offene Änderungen (ECR/ECO)</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Nr.</TableHead><TableHead>Titel</TableHead><TableHead>Risiko</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {m.openChangeList.length === 0 && <TableRow><TableCell colSpan={4} className="text-muted-foreground">Keine offenen Änderungen.</TableCell></TableRow>}
                    {m.openChangeList.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-xs">{c.change_number || '—'}</TableCell>
                        <TableCell>{c.title}</TableCell>
                        <TableCell>{plmLabel(c.risk_level)}</TableCell>
                        <TableCell><Badge variant="outline" className={toneClass[statusTone(c.status)]}>{plmLabel(c.status)}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Abweichungen Wareneingang</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>WE-Nr.</TableHead><TableHead>Charge</TableHead><TableHead>Ergebnis</TableHead><TableHead>Abweichung</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {m.deviationList.length === 0 && <TableRow><TableCell colSpan={4} className="text-muted-foreground">Keine Abweichungen.</TableCell></TableRow>}
                    {m.deviationList.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">{r.receipt_number || '—'}</TableCell>
                        <TableCell>{r.batch_number || '—'}</TableCell>
                        <TableCell><Badge variant="outline" className={toneClass[statusTone(r.inspection_result)]}>{plmLabel(r.inspection_result)}</Badge></TableCell>
                        <TableCell className="max-w-[240px] truncate">{r.deviation || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Teilestamm-Status</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3 text-sm">
              <div><div className="text-muted-foreground">Nicht freigegebene Teile</div><div className="text-xl font-semibold">{m.unreleasedParts}</div></div>
              <div><div className="text-muted-foreground">Sicherheitsrelevante Teile</div><div className="text-xl font-semibold">{m.criticalParts}</div></div>
              <div><div className="text-muted-foreground">Wareneingänge gesamt</div><div className="text-xl font-semibold">{m.weTotal}</div></div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

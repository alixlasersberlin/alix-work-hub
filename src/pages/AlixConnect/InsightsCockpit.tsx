import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileBarChart, Send, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function AlixConnectInsightsCockpit() {
  const [kpi, setKpi] = useState<any>(null);
  const [snaps, setSnaps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - 7 * 86400_000).toISOString();
    const [convs, breaches, health, journeys, playbooks, snapsRes] = await Promise.all([
      supabase.from('ac_conversations').select('id,status,priority').gte('created_at', since),
      supabase.from('ac_sla_breaches').select('id,breach_type').gte('created_at', since),
      supabase.from('ac_customer_health').select('score,stage'),
      supabase.from('ac_journey_runs').select('id,status').gte('created_at', since),
      supabase.from('ac_lifecycle_runs').select('id,status').gte('created_at', since),
      supabase.from('ac_report_snapshots').select('*').eq('granularity', 'weekly').order('created_at', { ascending: false }).limit(8),
    ]);
    const bucket = (arr: any[] | null, key: string) => {
      const m: Record<string, number> = {};
      (arr ?? []).forEach((r) => { m[r[key] ?? '—'] = (m[r[key] ?? '—'] ?? 0) + 1; });
      return m;
    };
    setKpi({
      conversations: convs.data?.length ?? 0,
      convs_by_status: bucket(convs.data, 'status'),
      sla_breaches: breaches.data?.length ?? 0,
      breaches_by_type: bucket(breaches.data, 'breach_type'),
      avg_health: health.data?.length ? Math.round(health.data.reduce((s, r: any) => s + (Number(r.score) || 0), 0) / health.data.length) : 0,
      health_by_stage: bucket(health.data as any, 'stage'),
      journey_runs: journeys.data?.length ?? 0,
      playbook_runs: playbooks.data?.length ?? 0,
    });
    setSnaps(snapsRes.data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const sendReport = async () => {
    setSending(true);
    const t = toast.loading('Report wird erstellt & versendet…');
    const { data, error } = await supabase.functions.invoke('ac-exec-report');
    toast.dismiss(t); setSending(false);
    if (error) return toast.error(error.message);
    toast.success(`Report an ${(data as any)?.sent ?? 0} Admins gesendet`);
    load();
  };

  if (loading || !kpi) return <div className="p-6 text-sm text-muted-foreground">Lade Cockpit…</div>;

  const tiles = [
    { label: 'Konversationen (7T)', value: kpi.conversations },
    { label: 'SLA-Verstöße', value: kpi.sla_breaches, danger: true },
    { label: 'Ø Health-Score', value: kpi.avg_health },
    { label: 'Journey-Runs', value: kpi.journey_runs },
    { label: 'Playbook-Runs', value: kpi.playbook_runs },
  ];

  return (
    <div className="h-full overflow-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileBarChart className="h-5 w-5 text-primary" /> Insights Cockpit
            <Badge variant="outline">Phase 30</Badge>
          </h2>
          <p className="text-sm text-muted-foreground">Konsolidierte KPIs · Automatischer Wochenreport an Admins</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={load}><RefreshCw className="h-3.5 w-3.5 mr-1" />Aktualisieren</Button>
          <Button size="sm" onClick={sendReport} disabled={sending}><Send className="h-3.5 w-3.5 mr-1" />Wochenreport senden</Button>
        </div>
      </div>

      <div className="grid md:grid-cols-5 gap-3">
        {tiles.map((t) => (
          <Card key={t.label} className="p-4">
            <div className="text-xs text-muted-foreground">{t.label}</div>
            <div className={`text-2xl font-semibold ${t.danger && Number(t.value) > 0 ? 'text-destructive' : ''}`}>{t.value}</div>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="text-sm font-semibold mb-2">Konversationen nach Status</div>
          {Object.entries(kpi.convs_by_status).map(([k, v]: any) => (
            <div key={k} className="flex justify-between text-xs py-1 border-b"><span>{k}</span><b>{v}</b></div>
          ))}
        </Card>
        <Card className="p-4">
          <div className="text-sm font-semibold mb-2">SLA-Verstöße nach Typ</div>
          {Object.keys(kpi.breaches_by_type).length === 0 && <div className="text-xs text-muted-foreground">Keine Verstöße 🎉</div>}
          {Object.entries(kpi.breaches_by_type).map(([k, v]: any) => (
            <div key={k} className="flex justify-between text-xs py-1 border-b"><span>{k}</span><b>{v}</b></div>
          ))}
        </Card>
        <Card className="p-4">
          <div className="text-sm font-semibold mb-2">Health nach Stage</div>
          {Object.entries(kpi.health_by_stage).map(([k, v]: any) => (
            <div key={k} className="flex justify-between text-xs py-1 border-b"><span>{k}</span><b>{v}</b></div>
          ))}
        </Card>
      </div>

      <Card className="p-4">
        <div className="text-sm font-semibold mb-3">Letzte Wochenreports</div>
        {snaps.length === 0 ? <div className="text-xs text-muted-foreground">Noch keine Snapshots. Klicke „Wochenreport senden".</div> : (
          <table className="text-xs w-full">
            <thead><tr className="text-muted-foreground"><th className="text-left py-1">Erstellt</th><th className="text-right py-1">Konv.</th><th className="text-right py-1">Breaches</th><th className="text-right py-1">Journeys</th><th className="text-right py-1">Playbooks</th></tr></thead>
            <tbody>
              {snaps.map((s: any) => (
                <tr key={s.id} className="border-t">
                  <td className="py-1">{new Date(s.created_at).toLocaleString('de-DE')}</td>
                  <td className="text-right">{s.kpis?.conversations ?? '—'}</td>
                  <td className="text-right">{s.kpis?.sla_breaches ?? '—'}</td>
                  <td className="text-right">{s.kpis?.journey_runs ?? '—'}</td>
                  <td className="text-right">{s.kpis?.playbook_runs ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

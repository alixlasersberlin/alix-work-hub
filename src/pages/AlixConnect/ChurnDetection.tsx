import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, PlayCircle, Loader2, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';

type Row = {
  id: string;
  contact_id: string;
  score: number;
  risk_level: 'low' | 'medium' | 'high';
  suggested_action: string | null;
  payload: any;
  created_at: string;
  ac_contacts?: { name: string | null; email: string | null; phone: string | null } | null;
};

export default function ChurnDetection() {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('ac_predictions')
      .select('id, contact_id, score, risk_level, suggested_action, payload, created_at, ac_contacts(name,email,phone)')
      .eq('kind', 'churn_prediction')
      .order('score', { ascending: false })
      .limit(100);
    setRows((data as any) ?? []);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  async function runBatch() {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('ac-churn-predict', { body: { batch: true, limit: 200 } });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Churn-Scoring: ${data?.scored ?? 0} Kontakte · ${data?.high_risk ?? 0} High Risk`);
    void load();
  }

  const high = rows.filter(r => r.risk_level === 'high').length;
  const med = rows.filter(r => r.risk_level === 'medium').length;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><TrendingDown className="h-6 w-6 text-destructive" /> Churn Detection</h1>
          <p className="text-sm text-muted-foreground">Frühwarnsystem für Kundenabwanderung (Phase 48)</p>
        </div>
        <Button onClick={runBatch} disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PlayCircle className="w-4 h-4 mr-2" />} Batch-Scoring starten
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="border-red-500/40 bg-red-500/5"><CardContent className="p-4"><div className="text-xs text-muted-foreground">High Risk</div><div className="text-2xl font-semibold">{high}</div></CardContent></Card>
        <Card className="border-amber-500/40 bg-amber-500/5"><CardContent className="p-4"><div className="text-xs text-muted-foreground">Medium</div><div className="text-2xl font-semibold">{med}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Bewertet gesamt</div><div className="text-2xl font-semibold">{rows.length}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Top gefährdete Kontakte</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {loading ? <div className="text-sm text-muted-foreground">Lade…</div> :
            rows.length === 0 ? <div className="text-sm text-muted-foreground text-center py-6">Noch keine Bewertungen. „Batch-Scoring starten" klicken.</div> :
            rows.map(r => (
              <div key={r.id} className="flex items-start gap-3 p-3 rounded-lg border">
                <Badge className={r.risk_level === 'high' ? 'bg-red-600' : r.risk_level === 'medium' ? 'bg-amber-500' : 'bg-emerald-600'}>
                  {r.risk_level.toUpperCase()} · {Math.round(r.score * 100)}%
                </Badge>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{r.ac_contacts?.name ?? '—'} <span className="text-muted-foreground text-xs ml-2">{r.ac_contacts?.email ?? r.ac_contacts?.phone ?? ''}</span></div>
                  <div className="text-xs text-muted-foreground">
                    {r.payload?.days_since_activity != null && `Inaktiv seit ${r.payload.days_since_activity} Tagen`} · Aktion: <b>{r.suggested_action ?? '—'}</b>
                  </div>
                </div>
                {r.risk_level === 'high' && <AlertTriangle className="h-5 w-5 text-red-500" />}
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}

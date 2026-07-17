import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Timer, AlertTriangle, ShieldCheck, TrendingUp, ListChecks } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line,
} from 'recharts';

interface Doc {
  id: string; status: string; created_at: string; completed_at: string | null;
  document_type: string | null;
}
interface Approval { status: string; created_at: string; }

function fmtHours(ms: number) {
  if (!ms || !isFinite(ms)) return '–';
  const h = ms / 3_600_000;
  if (h < 1) return `${Math.round(h * 60)} Min`;
  if (h < 48) return `${h.toFixed(1)} Std`;
  return `${(h / 24).toFixed(1)} Tage`;
}

export default function SignSlaDashboard() {
  const navigate = useNavigate();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const [d, a] = await Promise.all([
        supabase.from('sig_documents')
          .select('id, status, created_at, completed_at, document_type')
          .gte('created_at', since),
        supabase.from('sig_approval_states')
          .select('status, created_at')
          .gte('created_at', since),
      ]);
      setDocs((d.data ?? []) as Doc[]);
      setApprovals((a.data ?? []) as Approval[]);
      setLoading(false);
    })();
  }, []);

  const kpis = useMemo(() => {
    const done = docs.filter((d) => d.completed_at);
    const times = done
      .map((d) => new Date(d.completed_at!).getTime() - new Date(d.created_at).getTime())
      .filter((n) => n > 0);
    const avg = times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0;
    const overdue = docs.filter((d) =>
      !d.completed_at && Date.now() - new Date(d.created_at).getTime() > 7 * 86400000
    ).length;
    const total = docs.length;
    const signed = docs.filter((d) => d.status === 'signiert').length;
    const conv = total ? Math.round((signed / total) * 100) : 0;
    const backlog = approvals.filter((a) => a.status === 'pending').length;
    return { avg, overdue, conv, backlog, total, signed };
  }, [docs, approvals]);

  const perDay = useMemo(() => {
    const map = new Map<string, { day: string; created: number; signed: number }>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      map.set(key, { day: key.slice(5), created: 0, signed: 0 });
    }
    docs.forEach((d) => {
      const k = d.created_at.slice(0, 10);
      const row = map.get(k); if (row) row.created += 1;
      if (d.completed_at) {
        const k2 = d.completed_at.slice(0, 10);
        const r2 = map.get(k2); if (r2) r2.signed += 1;
      }
    });
    return Array.from(map.values());
  }, [docs]);

  const byType = useMemo(() => {
    const m = new Map<string, number>();
    docs.forEach((d) => m.set(d.document_type || 'sonstiges', (m.get(d.document_type || 'sonstiges') || 0) + 1));
    return Array.from(m, ([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);
  }, [docs]);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/signaturen')}><ArrowLeft className="w-4 h-4 mr-2" />Zurück</Button>
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold">SLA-Dashboard · Letzte 30 Tage</h1>
        </div>
        <Badge variant="secondary">{loading ? '…' : `${kpis.total} Vorgänge`}</Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><Timer className="w-3.5 h-3.5" />Ø Signaturzeit</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{fmtHours(kpis.avg)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" />Overdue (&gt;7 Tage)</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold text-orange-500">{kpis.overdue}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" />Conversion</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold text-emerald-500">{kpis.conv}%</div><div className="text-[10px] text-muted-foreground">{kpis.signed} von {kpis.total} signiert</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><ListChecks className="w-3.5 h-3.5" />Approval-Backlog</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold text-blue-500">{kpis.backlog}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Requests / Signaturen pro Tag</CardTitle></CardHeader>
        <CardContent style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={perDay}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="day" fontSize={11} />
              <YAxis fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
              <Line type="monotone" dataKey="created" stroke="#3b82f6" strokeWidth={2} name="Erstellt" dot={false} />
              <Line type="monotone" dataKey="signed" stroke="#10b981" strokeWidth={2} name="Signiert" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Nach Dokumenttyp</CardTitle></CardHeader>
        <CardContent style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byType}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="type" fontSize={11} />
              <YAxis fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
              <Bar dataKey="count" fill="#a855f7" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Files, AlertTriangle, Clock, Database, Trash2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

type Stats = {
  generated_at: string;
  totals: { documents: number; trashed: number; last_30_days: number; total_bytes: number };
  expiring_soon: { id: string; title: string; expiry_date: string }[];
  pending_approvals: { id: string; document_id: string; step_index: number; created_at: string }[];
  by_status: { key: string; count: number }[];
  by_category: { key: string; count: number; name: string }[];
  by_source: { key: string; count: number }[];
  by_month: { month: string; count: number }[];
};

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export default function AlixDocsDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.functions.invoke('alixdocs-stats').then(({ data, error }) => {
      if (error || (data as any)?.error) { toast.error((data as any)?.error || error?.message); return; }
      setStats(data as Stats);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground"><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Lade …</div>;
  if (!stats) return <div className="p-8 text-muted-foreground">Keine Daten.</div>;

  const maxMonth = Math.max(1, ...stats.by_month.map(m => m.count));

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2"><Files className="w-6 h-6 text-primary" /> AlixDocs — Dashboard</h1>
        <p className="text-sm text-muted-foreground">Stand: {new Date(stats.generated_at).toLocaleString('de-DE')}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase">Dokumente</div>
            <div className="text-3xl font-bold mt-1">{stats.totals.documents.toLocaleString('de-DE')}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase">Letzte 30 Tage</div>
            <div className="text-3xl font-bold mt-1 text-emerald-400">+{stats.totals.last_30_days.toLocaleString('de-DE')}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase flex items-center gap-1"><Database className="w-3 h-3" /> Speicher</div>
            <div className="text-3xl font-bold mt-1">{fmtBytes(stats.totals.total_bytes)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase flex items-center gap-1"><Trash2 className="w-3 h-3" /> Papierkorb</div>
            <div className="text-3xl font-bold mt-1 text-muted-foreground">{stats.totals.trashed.toLocaleString('de-DE')}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="w-4 h-4" /> Uploads pro Monat</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-40">
              {stats.by_month.map(m => (
                <div key={m.month} className="flex-1 flex flex-col items-center justify-end gap-1" title={`${m.month}: ${m.count}`}>
                  <div className="w-full bg-primary/60 rounded-t" style={{ height: `${(m.count / maxMonth) * 100}%` }} />
                  <div className="text-[9px] text-muted-foreground">{m.month.slice(5)}</div>
                </div>
              ))}
              {stats.by_month.length === 0 && <div className="w-full text-center text-sm text-muted-foreground">Keine Daten</div>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Status-Verteilung</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.by_status.map(s => {
                const pct = (s.count / Math.max(1, stats.totals.documents)) * 100;
                return (
                  <div key={s.key ?? 'null'}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium">{s.key ?? '—'}</span>
                      <span className="text-muted-foreground">{s.count} ({pct.toFixed(1)}%)</span>
                    </div>
                    <div className="h-2 bg-muted rounded"><div className="h-2 bg-primary rounded" style={{ width: `${pct}%` }} /></div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-400" /> Läuft bald ab (60 Tage)</CardTitle></CardHeader>
          <CardContent>
            {stats.expiring_soon.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine ablaufenden Dokumente.</p>
            ) : (
              <div className="space-y-1">
                {stats.expiring_soon.map(d => (
                  <div key={d.id} className="flex justify-between items-center text-sm border-b border-border/50 py-1.5">
                    <span className="truncate">{d.title}</span>
                    <Badge variant="outline" className="text-amber-400 border-amber-500/40">{new Date(d.expiry_date).toLocaleDateString('de-DE')}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-400" /> Offene Freigaben</CardTitle></CardHeader>
          <CardContent>
            {stats.pending_approvals.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine offenen Freigaben.</p>
            ) : (
              <div className="space-y-1 text-sm">
                {stats.pending_approvals.map(p => (
                  <div key={p.id} className="flex justify-between border-b border-border/50 py-1.5">
                    <span className="font-mono text-xs truncate">{p.document_id.slice(0, 8)}…</span>
                    <span className="text-xs text-muted-foreground">Schritt {p.step_index} · {new Date(p.created_at).toLocaleDateString('de-DE')}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Nach Kategorie</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {stats.by_category.slice(0, 12).map(c => (
                <div key={c.key ?? 'null'} className="flex justify-between text-sm">
                  <span>{c.name}</span>
                  <span className="text-muted-foreground">{c.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Nach Quelle</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {stats.by_source.map(s => (
                <div key={s.key ?? 'null'} className="flex justify-between text-sm">
                  <span>{s.key ?? 'unbekannt'}</span>
                  <span className="text-muted-foreground">{s.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

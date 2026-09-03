/**
 * FEHLER & STÖRUNGEN (Prompt 9, Punkt 28–34)
 * Gruppierte Incidents aus dem produktiven Betrieb – keine Fake-Einträge.
 */
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { fetchIncidents, setIncidentStatus, type IncidentStatus, type MobileIncident } from '@/lib/mobil/golive';

const FILTERS: { key: IncidentStatus | 'ALLE'; label: string }[] = [
  { key: 'OPEN', label: 'Offen' },
  { key: 'INVESTIGATING', label: 'In Analyse' },
  { key: 'RESOLVED', label: 'Behoben' },
  { key: 'IGNORED', label: 'Ignoriert' },
  { key: 'ALLE', label: 'Alle' },
];

const SEV_CLASS: Record<string, string> = {
  CRITICAL: 'border-destructive text-destructive',
  ERROR: 'border-destructive/60',
  WARNING: 'border-amber-500/60 text-amber-600',
  INFO: 'border-border',
};

export default function MobilAdminStoerungen() {
  const { hasRole } = useAuth() as any;
  const allowed = typeof hasRole === 'function' ? hasRole('Super Admin') || hasRole('Admin') : false;
  const [rows, setRows] = useState<MobileIncident[]>([]);
  const [filter, setFilter] = useState<IncidentStatus | 'ALLE'>('OPEN');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchIncidents(filter === 'ALLE' ? undefined : filter));
    } catch (e: any) { toast.error(e.message); }
    setLoading(false);
  }, [filter]);

  useEffect(() => { if (allowed) void load(); else setLoading(false); }, [allowed, load]);

  if (!allowed) return <div className="p-6 text-sm text-muted-foreground">Nur für Admin und Super Admin.</div>;

  const critical = rows.filter((r) => r.severity === 'CRITICAL' && (r.status === 'OPEN' || r.status === 'INVESTIGATING'));

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold">Fehler & Störungen</h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
      </div>

      {critical.length > 0 && (
        <Card className="p-3 border-destructive bg-destructive/10 text-sm font-semibold">
          CRITICAL INCIDENT ACTIVE · {critical.length}
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs border ${filter === f.key ? 'bg-primary text-primary-foreground border-primary' : 'border-border'}`}
          >{f.label}</button>
        ))}
      </div>

      {!loading && rows.length === 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground">Keine Einträge.</Card>
      )}

      {rows.map((r) => (
        <Card key={r.id} className={`p-3 space-y-2 border ${SEV_CLASS[r.severity] ?? ''}`}>
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium break-words">{r.summary}</div>
              <div className="text-[11px] text-muted-foreground">
                {r.component} · {r.error_code} · {r.release_version ?? '–'} · {r.occurrence_count}×
              </div>
              <div className="text-[11px] text-muted-foreground">
                zuletzt {new Date(r.last_seen_at).toLocaleString('de-DE')}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge variant="outline" className="text-[10px]">{r.severity}</Badge>
              <Badge variant="outline" className="text-[10px]">{r.customer_impact}</Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['INVESTIGATING', 'RESOLVED', 'IGNORED'] as IncidentStatus[]).map((s) => (
              <Button
                key={s} size="sm" variant="outline" className="h-8 text-xs"
                disabled={r.status === s}
                onClick={async () => {
                  try { await setIncidentStatus(r.id, s); toast.success('Status aktualisiert'); void load(); }
                  catch (e: any) { toast.error(e.message); }
                }}
              >{s === 'INVESTIGATING' ? 'In Analyse' : s === 'RESOLVED' ? 'Behoben' : 'Ignorieren'}</Button>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

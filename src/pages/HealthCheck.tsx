import { useState } from 'react';
import { Activity, CheckCircle2, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/infinity/PageHeader';
import { supabase } from '@/integrations/supabase/client';

type CheckStatus = 'idle' | 'running' | 'ok' | 'error';
interface Result {
  key: string;
  label: string;
  endpoint: string;
  status: CheckStatus;
  httpStatus?: number;
  latencyMs?: number;
  detail?: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const INITIAL: Result[] = [
  { key: 'auth-health', label: 'Auth Endpoint (/auth/v1/health)', endpoint: `${SUPABASE_URL}/auth/v1/health`, status: 'idle' },
  { key: 'auth-settings', label: 'Auth Settings (/auth/v1/settings)', endpoint: `${SUPABASE_URL}/auth/v1/settings`, status: 'idle' },
  { key: 'auth-session', label: 'Auth getSession() (SDK)', endpoint: 'supabase.auth.getSession', status: 'idle' },
  { key: 'rest-root', label: 'REST Endpoint (/rest/v1/)', endpoint: `${SUPABASE_URL}/rest/v1/`, status: 'idle' },
  { key: 'rest-query', label: 'REST Query (SDK: system_maintenance)', endpoint: 'from(system_maintenance)', status: 'idle' },
];

async function timedFetch(url: string, init?: RequestInit): Promise<{ status: number; ms: number; text?: string }> {
  const t0 = performance.now();
  const res = await fetch(url, init);
  const ms = Math.round(performance.now() - t0);
  let text: string | undefined;
  try { text = await res.text(); } catch {}
  return { status: res.status, ms, text };
}

export default function HealthCheck() {
  const [results, setResults] = useState<Result[]>(INITIAL);
  const [running, setRunning] = useState(false);

  const update = (key: string, patch: Partial<Result>) =>
    setResults(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)));

  const runAll = async () => {
    setRunning(true);
    setResults(INITIAL.map(r => ({ ...r, status: 'running' })));

    // Auth health
    try {
      const { status, ms, text } = await timedFetch(`${SUPABASE_URL}/auth/v1/health`, { headers: { apikey: ANON } });
      update('auth-health', { status: status < 500 ? 'ok' : 'error', httpStatus: status, latencyMs: ms, detail: text?.slice(0, 120) });
    } catch (e: any) {
      update('auth-health', { status: 'error', detail: e?.message ?? 'Failed to fetch' });
    }

    // Auth settings
    try {
      const { status, ms, text } = await timedFetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: ANON } });
      update('auth-settings', { status: status < 500 ? 'ok' : 'error', httpStatus: status, latencyMs: ms, detail: text?.slice(0, 120) });
    } catch (e: any) {
      update('auth-settings', { status: 'error', detail: e?.message ?? 'Failed to fetch' });
    }

    // Auth SDK session
    try {
      const t0 = performance.now();
      const { data, error } = await supabase.auth.getSession();
      const ms = Math.round(performance.now() - t0);
      update('auth-session', {
        status: error ? 'error' : 'ok',
        latencyMs: ms,
        detail: error ? error.message : data.session ? `Session aktiv (${data.session.user.email})` : 'Keine aktive Session',
      });
    } catch (e: any) {
      update('auth-session', { status: 'error', detail: e?.message ?? 'Unbekannter Fehler' });
    }

    // REST root
    try {
      const { status, ms } = await timedFetch(`${SUPABASE_URL}/rest/v1/`, { headers: { apikey: ANON } });
      update('rest-root', { status: status < 500 ? 'ok' : 'error', httpStatus: status, latencyMs: ms });
    } catch (e: any) {
      update('rest-root', { status: 'error', detail: e?.message ?? 'Failed to fetch' });
    }

    // REST via SDK
    try {
      const t0 = performance.now();
      const { error } = await supabase.from('system_maintenance').select('enabled').limit(1);
      const ms = Math.round(performance.now() - t0);
      update('rest-query', { status: error ? 'error' : 'ok', latencyMs: ms, detail: error?.message });
    } catch (e: any) {
      update('rest-query', { status: 'error', detail: e?.message ?? 'Failed to fetch' });
    }

    setRunning(false);
  };

  const okCount = results.filter(r => r.status === 'ok').length;
  const errCount = results.filter(r => r.status === 'error').length;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        icon={Activity}
        title="Supabase Health Check"
        subtitle="Testet Auth- und REST-Endpunkte deiner Supabase-Instanz."
        noBreadcrumbs
        actions={
          <Button onClick={runAll} disabled={running} className="gold-gradient text-primary-foreground">
            {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            {running ? 'Prüfe…' : 'Health Check starten'}
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">
            Zielprojekt: <span className="text-foreground font-mono">{SUPABASE_URL}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Badge variant="outline" className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30">OK: {okCount}</Badge>
          <Badge variant="outline" className="bg-red-500/15 text-red-500 border-red-500/30">Fehler: {errCount}</Badge>
          <Badge variant="outline">Gesamt: {results.length}</Badge>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {results.map(r => (
          <Card key={r.key}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium">{r.label}</div>
                  <div className="text-xs text-muted-foreground font-mono truncate mt-1">{r.endpoint}</div>
                  {r.detail && <div className="text-xs text-muted-foreground mt-2 break-words">{r.detail}</div>}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {r.status === 'ok' && <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30" variant="outline"><CheckCircle2 className="w-3 h-3 mr-1" />OK</Badge>}
                  {r.status === 'error' && <Badge className="bg-red-500/15 text-red-500 border-red-500/30" variant="outline"><XCircle className="w-3 h-3 mr-1" />Fehler</Badge>}
                  {r.status === 'running' && <Badge variant="outline"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Prüfe…</Badge>}
                  {r.status === 'idle' && <Badge variant="outline">Bereit</Badge>}
                  {r.httpStatus !== undefined && <span className="text-xs text-muted-foreground">HTTP {r.httpStatus}</span>}
                  {r.latencyMs !== undefined && <span className="text-xs text-muted-foreground">{r.latencyMs} ms</span>}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

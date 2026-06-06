import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { Copy, KeyRound, PlugZap, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

const PROJECT_REF = 'xmrmkgfgpoundfwhnxfs';
const ENDPOINT = `https://${PROJECT_REF}.supabase.co/functions/v1/receive-alixsmart-ticket`;

interface SyncLog {
  id: string;
  external_ticket_id: string | null;
  direction: string | null;
  action: string | null;
  status: string | null;
  error_message: string | null;
  created_at: string;
}

export default function ApiSyncSettings() {
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');
  const [lastSuccess, setLastSuccess] = useState<SyncLog | null>(null);
  const [lastError, setLastError] = useState<SyncLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [okRes, errRes] = await Promise.all([
      supabase.from('ticket_sync_logs').select('*').eq('status', 'success').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('ticket_sync_logs').select('*').eq('status', 'error').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    setLastSuccess((okRes.data as SyncLog) || null);
    setLastError((errRes.data as SyncLog) || null);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function testApi() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(ENDPOINT, { method: 'GET' });
      const text = await res.text();
      if (res.ok) {
        setTestResult(`✅ Endpoint erreichbar (HTTP ${res.status}). Response: ${text}`);
        toast.success('API ist erreichbar');
      } else {
        setTestResult(`⚠️ HTTP ${res.status}: ${text}`);
        toast.warning('API antwortet, aber mit Fehler');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setTestResult(`❌ Fehler: ${msg}`);
      toast.error('API nicht erreichbar');
    } finally {
      setTesting(false);
    }
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    toast.success('In Zwischenablage kopiert');
  }

  if (!isAdmin) {
    return <div className="p-8">Nur für Administratoren sichtbar.</div>;
  }

  return (
    <div className="p-6 lg:p-8 animate-fade-in max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <PlugZap className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-display font-bold text-foreground">API Sync Einstellungen</h1>
        <Badge variant="outline" className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">aktiv</Badge>
      </div>

      <Card className="p-6 space-y-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">API Endpoint URL</div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm bg-muted/50 rounded px-3 py-2 font-mono break-all">{ENDPOINT}</code>
            <Button variant="outline" size="icon" onClick={() => copy(ENDPOINT)}><Copy className="w-4 h-4" /></Button>
          </div>
        </div>

        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Methode</div>
          <code className="text-sm bg-muted/50 rounded px-3 py-1 font-mono">POST</code>
        </div>

        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Auth-Header</div>
          <code className="text-sm bg-muted/50 rounded px-3 py-2 font-mono block">x-alix-sync-key: &lt;geheimer Key&gt;</code>
          <div className="flex items-start gap-2 mt-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm">
            <KeyRound className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <span className="text-amber-200">
              Der geheime API-Key (<code>ALIX_SYNC_KEY</code>) ist nur in den Supabase-Secrets gespeichert
              und darf <strong>niemals</strong> im Frontend, in Logs oder in dieser Oberfläche angezeigt werden.
              Verwaltung ausschließlich über die Supabase-Edge-Function-Secrets.
            </span>
          </div>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <h3 className="font-semibold">Letzter erfolgreicher Sync</h3>
          </div>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : lastSuccess ? (
            <div className="text-sm space-y-1">
              <div className="text-muted-foreground">{new Date(lastSuccess.created_at).toLocaleString('de-DE')}</div>
              <div>Ticket: <code className="text-xs">{lastSuccess.external_ticket_id || '—'}</code></div>
              <div>Aktion: <Badge variant="outline">{lastSuccess.action}</Badge></div>
            </div>
          ) : <div className="text-sm text-muted-foreground">Noch kein erfolgreicher Sync.</div>}
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <h3 className="font-semibold">Letzter Fehler</h3>
          </div>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : lastError ? (
            <div className="text-sm space-y-1">
              <div className="text-muted-foreground">{new Date(lastError.created_at).toLocaleString('de-DE')}</div>
              <div>Ticket: <code className="text-xs">{lastError.external_ticket_id || '—'}</code></div>
              <div>Aktion: <Badge variant="outline">{lastError.action}</Badge></div>
              <div className="text-red-400 text-xs mt-2 whitespace-pre-wrap">{lastError.error_message}</div>
            </div>
          ) : <div className="text-sm text-muted-foreground">Keine Fehler aufgetreten.</div>}
        </Card>
      </div>

      <Card className="p-6 space-y-3">
        <h3 className="font-semibold">API testen</h3>
        <p className="text-sm text-muted-foreground">
          Sendet einen GET-Aufruf an den Endpoint, um zu prüfen, ob die Edge Function erreichbar ist.
          Ein Schreibtest mit echten Daten muss von AlixSmart aus mit gültigem Key durchgeführt werden.
        </p>
        <div className="flex gap-2 items-center">
          <Button onClick={testApi} disabled={testing}>
            {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PlugZap className="w-4 h-4 mr-2" />}
            API testen
          </Button>
          <Button variant="outline" onClick={load} disabled={loading}>Neu laden</Button>
        </div>
        {testResult && (
          <pre className="text-xs bg-muted/50 rounded p-3 whitespace-pre-wrap break-all">{testResult}</pre>
        )}
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold mb-3">Status-Mapping (AlixSmart → AlixWork)</h3>
        <div className="grid sm:grid-cols-2 gap-2 text-sm">
          {[
            ['neu', 'offen'],
            ['in_pruefung', 'serviceprüfung'],
            ['in_bearbeitung', 'technik'],
            ['ersatzteil_benoetigt', 'ersatzteile benötigt'],
            ['rechnung_offen', 'finance'],
            ['abholung_geplant', 'tourenplanung'],
            ['geloest', 'abgeschlossen'],
            ['geschlossen', 'archiviert'],
          ].map(([a, b]) => (
            <div key={a} className="flex items-center gap-2">
              <code className="text-xs bg-muted/50 px-2 py-1 rounded">{a}</code>
              <span className="text-muted-foreground">→</span>
              <code className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">{b}</code>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

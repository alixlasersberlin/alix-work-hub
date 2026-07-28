import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, X, RefreshCw, ExternalLink, Send } from 'lucide-react';
import { toast } from 'sonner';

type Job = {
  id: string;
  post_id: string;
  client_id: string;
  platform: string;
  status: string;
  attempts: number;
  max_attempts: number;
  scheduled_for: string;
  started_at: string | null;
  finished_at: string | null;
  external_url: string | null;
  last_error: string | null;
  created_at: string;
};

const STATUS_STYLES: Record<string, string> = {
  queued: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  running: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  done: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  failed: 'bg-rose-500/10 text-rose-600 border-rose-500/30',
  cancelled: 'bg-muted text-muted-foreground border-border',
};

export default function SocialVeroeffentlichung() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [status, setStatus] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    let q = supabase.from('social_publish_jobs').select('*').order('scheduled_for', { ascending: false }).limit(200);
    if (status !== 'all') q = q.eq('status', status);
    const { data } = await q;
    setJobs((data as Job[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  const runNow = async (id: string) => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('social-publish', { body: { action: 'run_now', job_id: id } });
    setBusy(false);
    if (error || (data as any)?.error) return toast.error(error?.message ?? (data as any)?.error);
    toast.success('Job verarbeitet');
    load();
  };
  const cancel = async (id: string) => {
    const { error } = await supabase.functions.invoke('social-publish', { body: { action: 'cancel', job_id: id } });
    if (error) return toast.error(error.message);
    toast.success('Job abgebrochen');
    load();
  };
  const processDue = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('social-publish', { body: { action: 'process_due' } });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Fällige Jobs verarbeitet (${(data as any)?.processed ?? 0})`);
    load();
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Publishing-Queue</h1>
          <p className="text-muted-foreground mt-1">Geplante Veröffentlichungen, Retries und Ergebnisse</p>
        </div>
        <div className="flex gap-2 items-center">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Status</SelectItem>
              <SelectItem value="queued">Geplant</SelectItem>
              <SelectItem value="running">Läuft</SelectItem>
              <SelectItem value="done">Erledigt</SelectItem>
              <SelectItem value="failed">Fehlgeschlagen</SelectItem>
              <SelectItem value="cancelled">Abgebrochen</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" />Neu laden</Button>
          <Button onClick={processDue} disabled={busy}><Send className="mr-2 h-4 w-4" />Fällige verarbeiten</Button>
          <Button asChild variant="outline"><Link to="/social/analytics">Analytics</Link></Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Jobs</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-sm text-muted-foreground">lädt…</div>
          ) : jobs.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">Keine Jobs vorhanden. Beiträge werden aus dem Editor per „Veröffentlichung planen" in die Queue gelegt.</div>
          ) : (
            <div className="divide-y">
              {jobs.map(j => (
                <div key={j.id} className="flex items-start justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={STATUS_STYLES[j.status] ?? ''}>{j.status}</Badge>
                      <span className="capitalize font-medium">{j.platform}</span>
                      <span className="text-xs text-muted-foreground">geplant: {new Date(j.scheduled_for).toLocaleString('de-DE')}</span>
                      <span className="text-xs text-muted-foreground">Versuche: {j.attempts}/{j.max_attempts}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Post: <Link to={`/social/beitrag/${j.post_id}`} className="underline">{j.post_id.slice(0, 8)}</Link>
                      {j.external_url && (
                        <> · <a href={j.external_url} target="_blank" rel="noreferrer" className="inline-flex items-center underline">extern öffnen <ExternalLink className="ml-1 h-3 w-3" /></a></>
                      )}
                    </div>
                    {j.last_error && <div className="mt-1 text-xs text-rose-600 truncate max-w-xl">{j.last_error}</div>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {(j.status === 'queued' || j.status === 'failed') && (
                      <Button size="sm" onClick={() => runNow(j.id)} disabled={busy}><Play className="mr-1 h-3 w-3" />Jetzt</Button>
                    )}
                    {(j.status === 'queued' || j.status === 'failed') && (
                      <Button size="sm" variant="outline" onClick={() => cancel(j.id)}><X className="mr-1 h-3 w-3" />Abbrechen</Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

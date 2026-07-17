import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Activity } from 'lucide-react';

interface BulkJob {
  id: string;
  status: string;
  total: number;
  processed: number;
  failed: number;
  created_at: string;
  template_id?: string | null;
}

export function BulkJobsProgress() {
  const [jobs, setJobs] = useState<BulkJob[]>([]);

  const load = async () => {
    const { data } = await supabase
      .from('sig_bulk_jobs')
      .select('id, status, total, processed, failed, created_at, template_id')
      .order('created_at', { ascending: false })
      .limit(5);
    setJobs((data ?? []) as BulkJob[]);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel('sig-bulk-jobs-progress')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sig_bulk_jobs' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  if (jobs.length === 0) return null;

  const statusColor = (s: string) =>
    s === 'completed' ? 'bg-emerald-500/20 text-emerald-600' :
    s === 'running' ? 'bg-blue-500/20 text-blue-600' :
    s === 'failed' ? 'bg-red-500/20 text-red-600' : 'bg-muted';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          Laufende & letzte Bulk-Jobs
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {jobs.map((j) => {
          const pct = j.total > 0 ? Math.round((j.processed / j.total) * 100) : 0;
          return (
            <div key={j.id} className="space-y-1.5 border rounded-lg p-3">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{j.id.slice(0, 8)}</span>
                  <Badge className={statusColor(j.status)}>{j.status}</Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  {j.processed}/{j.total}{j.failed > 0 && ` · ${j.failed} Fehler`}
                </span>
              </div>
              <Progress value={pct} className="h-2" />
              <div className="text-[10px] text-muted-foreground">{new Date(j.created_at).toLocaleString('de-DE')}</div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default BulkJobsProgress;

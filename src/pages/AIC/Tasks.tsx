import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { CheckCircle2, X } from 'lucide-react';

export default function AicTasks() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['aic', 'tasks'],
    queryFn: async () => {
      const { data } = await supabase.from('aic_tasks').select('*').order('status', { ascending: true }).order('priority', { ascending: false }).order('created_at', { ascending: false }).limit(200);
      return data ?? [];
    },
  });
  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('aic_tasks').update({ status }).eq('id', id);
    if (error) toast.error(error.message); else { toast.success('Aktualisiert'); qc.invalidateQueries({ queryKey: ['aic'] }); }
  };
  return (
    <Card className="p-5">
      <h2 className="text-lg font-semibold mb-4">KI-Aufgaben</h2>
      {!data?.length ? <p className="text-sm text-muted-foreground">Keine Aufgaben.</p> : (
        <ul className="space-y-2">
          {data.map((t: any) => (
            <li key={t.id} className={`p-3 rounded-lg border flex items-start gap-3 ${t.status === 'open' ? 'border-border bg-card/50' : 'opacity-50'}`}>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono border border-primary/40 text-primary">P{t.priority}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-[10px]">{t.task_type}</Badge>
                  <span className="font-medium text-sm">{t.title}</span>
                  {t.status !== 'open' && <Badge variant="outline" className="text-[10px]">{t.status}</Badge>}
                </div>
                {t.description && <div className="text-xs text-muted-foreground mt-1">{t.description}</div>}
              </div>
              {t.status === 'open' && (
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setStatus(t.id, 'done')}><CheckCircle2 className="w-4 h-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => setStatus(t.id, 'dismissed')}><X className="w-4 h-4" /></Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

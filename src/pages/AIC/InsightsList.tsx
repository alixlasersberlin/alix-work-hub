import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, X } from 'lucide-react';
import { toast } from 'sonner';
import { SeverityBadge, CategoryBadge } from './Dashboard';

export default function InsightsList({ module, title }: { module: string; title: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['aic', 'insights', module],
    queryFn: async () => {
      const { data } = await supabase
        .from('aic_insights')
        .select('*')
        .eq('module', module)
        .order('status', { ascending: true })
        .order('severity', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  const setStatus = async (id: string, status: 'done' | 'dismissed') => {
    const { error } = await supabase.from('aic_insights').update({ status }).eq('id', id);
    if (error) toast.error(error.message);
    else {
      toast.success('Aktualisiert');
      qc.invalidateQueries({ queryKey: ['aic'] });
    }
  };

  return (
    <Card className="p-5">
      <h2 className="text-lg font-semibold mb-4">{title}</h2>
      {!data?.length ? (
        <p className="text-sm text-muted-foreground">Noch keine Erkenntnisse in diesem Bereich. Starte oben eine KI-Analyse.</p>
      ) : (
        <ul className="space-y-3">
          {data.map((i: any) => (
            <li key={i.id} className={`p-4 rounded-lg border ${i.status === 'open' ? 'border-border bg-card/50' : 'border-border/40 bg-muted/20 opacity-60'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <SeverityBadge severity={i.severity} />
                    <CategoryBadge category={i.category} />
                    {i.status !== 'open' && <Badge variant="outline" className="text-[10px]">{i.status}</Badge>}
                  </div>
                  <div className="font-medium">{i.title}</div>
                  {i.description && <div className="text-sm text-muted-foreground mt-1">{i.description}</div>}
                  <div className="text-[10px] text-muted-foreground mt-2">{new Date(i.created_at).toLocaleString('de-DE')}</div>
                </div>
                {i.status === 'open' && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setStatus(i.id, 'done')} title="Erledigt">
                      <CheckCircle2 className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setStatus(i.id, 'dismissed')} title="Verwerfen">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

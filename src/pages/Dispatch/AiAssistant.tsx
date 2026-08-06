import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, Check, X, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';

const CATEGORY_LABELS: Record<string, string> = {
  tourenvorschlag: 'Tourenvorschlag',
  auslastung: 'Auslastung',
  verspaetungsrisiko: 'Verspätungsrisiko',
  buendelung: 'Bündelung',
  ressourcen: 'Ressourcen',
};

const severityVariant = (s: string) => (s === 'kritisch' ? 'destructive' : s === 'warnung' ? 'secondary' : 'outline');

export default function DispatchAiAssistant() {
  const qc = useQueryClient();
  const today = format(new Date(), 'yyyy-MM-dd');
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(format(addDays(new Date(), 7), 'yyyy-MM-dd'));

  const { data: suggestions, isPending } = useQuery({
    queryKey: ['dispatch', 'ai-suggestions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dispatch_ai_suggestions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(60);
      if (error) throw error;
      return data ?? [];
    },
  });

  const analyze = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('dispatch-ai-assistant', { body: { from, to } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as any;
    },
    onSuccess: (d) => {
      toast.success(`${d.created ?? 0} Vorschläge erstellt`);
      qc.invalidateQueries({ queryKey: ['dispatch', 'ai-suggestions'] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Analyse fehlgeschlagen'),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('dispatch_ai_suggestions')
        .update({ status, reviewed_by: u.user?.id ?? null, reviewed_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dispatch', 'ai-suggestions'] }),
    onError: (e: any) => toast.error(e.message ?? 'Aktualisierung fehlgeschlagen'),
  });

  const open = (suggestions ?? []).filter((s: any) => (s.status ?? 'offen') === 'offen');
  const closed = (suggestions ?? []).filter((s: any) => (s.status ?? 'offen') !== 'offen');

  return (
    <div className="space-y-4">
      <PageHeader
        title="KI-Dispatch-Assistent"
        subtitle="Tourenvorschläge, Auslastungsoptimierung und Verspätungsprognosen"
        icon={Sparkles}
      />

      <Card className="p-4 flex flex-wrap items-end gap-3">
        <div><Label>Von</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-44" /></div>
        <div><Label>Bis</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-44" /></div>
        <Button onClick={() => analyze.mutate()} disabled={analyze.isPending}>
          {analyze.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Planung analysieren
        </Button>
      </Card>

      {isPending && <Card className="p-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></Card>}

      {!isPending && open.length === 0 && (
        <Card className="p-8 text-center text-muted-foreground">
          Noch keine offenen Vorschläge – starten Sie eine Analyse für den gewählten Zeitraum.
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {open.map((s: any) => (
          <Card key={s.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{s.title}</CardTitle>
                <Badge variant={severityVariant(s.severity) as any}>{s.severity}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {CATEGORY_LABELS[s.category] ?? s.category} · {format(new Date(s.created_at), 'dd.MM.yyyy HH:mm')}
              </p>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {s.detail && <p>{s.detail}</p>}
              {s.rationale && <p className="text-muted-foreground text-xs"><strong>Begründung:</strong> {s.rationale}</p>}
              {s.impact && <p className="text-muted-foreground text-xs"><strong>Effekt:</strong> {s.impact}</p>}
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={() => setStatus.mutate({ id: s.id, status: 'uebernommen' })}>
                  <Check className="h-3.5 w-3.5 mr-1" />Übernehmen
                </Button>
                <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: s.id, status: 'verworfen' })}>
                  <X className="h-3.5 w-3.5 mr-1" />Verwerfen
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {closed.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Bearbeitete Vorschläge</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {closed.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between border-b border-border/50 pb-2 text-sm last:border-0">
                <span className="truncate">{s.title}</span>
                <Badge variant="outline">{s.status === 'uebernommen' ? 'Übernommen' : 'Verworfen'}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

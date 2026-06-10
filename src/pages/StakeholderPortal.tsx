import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lock, FileBarChart, Loader2 } from 'lucide-react';

export default function StakeholderPortal() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('finance-stakeholder-portal', { body: { token } });
        if (error) throw error;
        if (data?.error) { setError(data.error); return; }
        setData(data);
      } catch (e: any) {
        setError(e.message ?? 'Unbekannter Fehler');
      } finally { setLoading(false); }
    })();
  }, [token]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="max-w-md w-full">
        <CardHeader><CardTitle className="flex items-center gap-2"><Lock className="h-5 w-5" />Zugriff verweigert</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground">{error}</p></CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="border-b border-border pb-4">
          <h1 className="text-2xl font-bold">Willkommen, {data?.stakeholder?.name}</h1>
          <p className="text-muted-foreground">Ihre Finance-Berichte · Rolle: <Badge variant="outline">{data?.stakeholder?.role}</Badge></p>
        </div>

        <div className="grid gap-4">
          {(data?.reports ?? []).length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">Es wurden noch keine Berichte freigegeben.</CardContent></Card>
          ) : (
            (data?.reports ?? []).map((r: any) => (
              <Card key={r.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><FileBarChart className="h-5 w-5 text-primary" />{r.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  {r.description && <p className="text-sm text-muted-foreground mb-2">{r.description}</p>}
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="outline">{r.visualization}</Badge>
                    {(r.metrics ?? []).map((m: string) => <Badge key={m} variant="secondary">{m}</Badge>)}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <div className="text-xs text-muted-foreground text-center pt-4 border-t border-border">
          Sicherer Token-Zugriff · Alle Zugriffe werden protokolliert
        </div>
      </div>
    </div>
  );
}

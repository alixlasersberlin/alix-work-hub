import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, Loader2, Share2 } from 'lucide-react';
import { toast } from 'sonner';

export default function CustomerPortalAlixDocs() {
  const [shares, setShares] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('alixdocs-portal-list', { body: {} });
    if (error || (data as any)?.error) { toast.error((data as any)?.error || error?.message); setLoading(false); return; }
    setShares((data as any)?.shares ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const open = async (share_id: string) => {
    setOpening(share_id);
    const { data, error } = await supabase.functions.invoke('alixdocs-portal-signed-url', { body: { share_id } });
    setOpening(null);
    if (error || (data as any)?.error) { toast.error((data as any)?.error || error?.message); return; }
    window.open((data as any).url, '_blank');
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-display gold-text flex items-center gap-2"><Share2 className="w-6 h-6" /> Meine Dokumente</h1>
        <p className="text-sm text-muted-foreground">Freigegebene Dokumente von Alix Lasers.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>{loading ? 'Lade…' : `${shares.length} Dokument(e)`}</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> :
            shares.length === 0 ? <p className="text-sm text-muted-foreground italic py-6 text-center">Aktuell keine freigegebenen Dokumente.</p> :
            shares.map((s: any) => (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded border hover:bg-muted/30">
                <FileText className="w-5 h-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{s.alixdocs_documents?.title}</div>
                  <div className="text-xs text-muted-foreground">
                    Freigegeben {new Date(s.shared_at).toLocaleDateString('de-DE')}
                    {s.expires_at && <> · gültig bis {new Date(s.expires_at).toLocaleDateString('de-DE')}</>}
                  </div>
                  {s.note && <div className="text-xs italic mt-1">{s.note}</div>}
                </div>
                <Badge variant="outline">v{s.alixdocs_documents?.current_version}</Badge>
                <Button size="sm" onClick={() => open(s.id)} disabled={opening === s.id}>
                  {opening === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Download className="w-3 h-3 mr-1" /> Öffnen</>}
                </Button>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}

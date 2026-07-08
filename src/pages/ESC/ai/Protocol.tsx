import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollText } from 'lucide-react';
import { getProtocol, subscribeAi, type AiProtocolEntry } from '@/lib/esc/ai/store';

export default function AiProtocol() {
  const [entries, setEntries] = useState<AiProtocolEntry[]>(getProtocol());
  useEffect(() => {
    const unsub = subscribeAi(() => setEntries(getProtocol()));
    return () => { unsub(); };
  }, []);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ScrollText className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold">KI-Protokoll</h1>
      </div>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Nachvollziehbarkeit aller AI-Vorschläge</CardTitle></CardHeader>
        <CardContent className="divide-y divide-border/50">
          {entries.length === 0 && <div className="py-3 text-[12.5px] text-muted-foreground">Noch keine Aktionen protokolliert.</div>}
          {entries.map((e) => (
            <div key={e.id} className="py-2 grid grid-cols-1 md:grid-cols-[160px_1fr_auto] gap-2 items-start text-[12.5px]">
              <div className="text-muted-foreground font-mono text-[11px]">{new Date(e.actedAt).toLocaleString()}</div>
              <div>
                <div className="font-medium">{e.title}</div>
                <div className="text-[11.5px] text-muted-foreground">{e.reason}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">{e.kind}</Badge>
                <Badge variant={e.status === 'accepted' ? 'default' : 'secondary'} className="text-[10px]">{e.status}</Badge>
                {e.actedBy && <span className="text-[10.5px] text-muted-foreground">{e.actedBy}</span>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

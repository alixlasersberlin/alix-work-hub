import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GitMerge, Loader2, Play, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

type Merge = { master: string; merged_count: number; dupes: string[] };

export default function OmnichannelMerge() {
  const [rows, setRows] = useState<Merge[]>([]);
  const [busy, setBusy] = useState(false);
  const [dryRun, setDryRun] = useState<boolean | null>(null);

  async function run(dry_run: boolean) {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('ac-omnichannel-merge', { body: { dry_run, limit: 1000 } });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setRows((data as any)?.merges ?? []);
    setDryRun(dry_run);
    toast.success(dry_run ? `${data?.groups ?? 0} Merge-Kandidaten` : `${data?.groups ?? 0} Kontakte zusammengeführt`);
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><GitMerge className="h-6 w-6" /> Omnichannel-Merge</h1>
          <p className="text-sm text-muted-foreground">Phase 50 — SMS + WhatsApp + Email desselben Kunden zu einer Konversation</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => run(true)} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}Kandidaten scannen</Button>
          <Button onClick={() => run(false)} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}Merge ausführen</Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Ergebnis {dryRun === true && <Badge variant="outline" className="ml-2">Dry-Run</Badge>}</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {rows.length === 0 ? <p className="text-sm text-muted-foreground">Noch keine Ergebnisse. „Kandidaten scannen" klicken.</p> :
            rows.map(r => (
              <div key={r.master} className="p-3 rounded-lg border text-sm">
                <div><b>Master:</b> <code className="text-xs">{r.master}</code></div>
                <div className="text-xs text-muted-foreground">{r.merged_count} Duplikate: {r.dupes.map(d => <code key={d} className="mx-1">{d.slice(0, 8)}</code>)}</div>
              </div>
            ))}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">Match-Kriterien: gleiche E-Mail (case-insensitiv) ODER gleiche Telefon-/WhatsApp-Nummer (letzte 8 Ziffern). Master ist immer der älteste Kontakt.</p>
    </div>
  );
}

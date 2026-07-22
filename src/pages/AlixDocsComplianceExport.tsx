import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { FileArchive, Download, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

export default function AlixDocsComplianceExport() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [category, setCategory] = useState('');
  const [busy, setBusy] = useState(false);
  const [manifest, setManifest] = useState<any>(null);

  async function generate() {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('alixdocs-compliance-export', {
      body: { date_from: dateFrom || undefined, date_to: dateTo || undefined, category: category || undefined, include_urls: true },
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    if ((data as any)?.error) { toast.error((data as any).error); return; }
    setManifest(data);
    toast.success(`Manifest mit ${data?.document_count ?? 0} Dokumenten erstellt`);
  }

  function download() {
    if (!manifest) return;
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alixdocs-compliance-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2"><FileArchive className="h-6 w-6" /> Compliance-Export</h1>
        <p className="text-sm text-muted-foreground">GoBD / DSGVO-konformer Massen-Export mit SHA-256 Prüfsummen (Phase 14)</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Filter</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div><Label>Von</Label><Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></div>
          <div><Label>Bis</Label><Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} /></div>
          <div><Label>Kategorie (optional)</Label><Input value={category} onChange={e => setCategory(e.target.value)} placeholder="z. B. rechnung" /></div>
          <div className="md:col-span-3 flex gap-2">
            <Button onClick={generate} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}Manifest erzeugen</Button>
            {manifest && <Button variant="outline" onClick={download}><Download className="w-4 h-4 mr-2" />Manifest herunterladen</Button>}
          </div>
        </CardContent>
      </Card>

      {manifest && (
        <Card>
          <CardHeader><CardTitle className="text-base">Manifest-Info</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><b>Erstellt:</b> {new Date(manifest.generated_at).toLocaleString('de-DE')} · <b>Von:</b> {manifest.generated_by}</div>
            <div><b>Standard:</b> <Badge>{manifest.standard}</Badge></div>
            <div><b>Dokumente:</b> {manifest.document_count}</div>
            <div><b>Manifest-Hash (SHA-256):</b> <code className="text-xs break-all">{manifest.manifest_hash}</code></div>
            <p className="text-xs text-muted-foreground mt-3">Signierte Download-URLs sind 7 Tage gültig. Prüfsumme jedes Dokuments ist enthalten — jede spätere Veränderung ist nachweisbar.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

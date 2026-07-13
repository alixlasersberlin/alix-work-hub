import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Cloud, Globe, Play, Plus, Trash2, RefreshCw } from 'lucide-react';

export default function KatalogImportManaged() {
  const c = supabase as any;
  const { toast } = useToast();
  const [sources, setSources] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [tab, setTab] = useState<'airtable' | 'website'>('airtable');
  const [busy, setBusy] = useState(false);

  // Airtable
  const [bases, setBases] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [baseId, setBaseId] = useState('');
  const [tableId, setTableId] = useState('');
  const [preview, setPreview] = useState<any[]>([]);
  const [mapping, setMapping] = useState({ sku: '', name: '', brand: '', model: '', notes: '' });

  // Website
  const [wUrl, setWUrl] = useState('');
  const [wLimit, setWLimit] = useState(20);
  const [wLinks, setWLinks] = useState<string[]>([]);
  const [wSelected, setWSelected] = useState<Record<string, boolean>>({});

  const load = async () => {
    const [{ data: s }, { data: j }] = await Promise.all([
      c.from('catalog_import_sources').select('*').order('created_at', { ascending: false }),
      c.from('catalog_import_jobs_v2').select('*').order('started_at', { ascending: false }).limit(30),
    ]);
    setSources(s ?? []); setJobs(j ?? []);
  };
  useEffect(() => { load(); }, []);

  const call = async (fn: string, body: any) => {
    const { data, error } = await supabase.functions.invoke(fn, { body });
    if (error) throw new Error(error.message);
    if ((data as any)?.error) throw new Error((data as any).error);
    return data as any;
  };

  const loadBases = async () => {
    setBusy(true);
    try { const d = await call('catalog-import-airtable', { action: 'list_bases' }); setBases(d.bases); }
    catch (e: any) { toast({ title: 'Fehler', description: e.message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };
  const loadTables = async (b: string) => {
    setBaseId(b); setTables([]); setTableId(''); setPreview([]);
    try { const d = await call('catalog-import-airtable', { action: 'list_tables', baseId: b }); setTables(d.tables); }
    catch (e: any) { toast({ title: 'Fehler', description: e.message, variant: 'destructive' }); }
  };
  const doPreview = async () => {
    try { const d = await call('catalog-import-airtable', { action: 'preview', baseId, tableId }); setPreview(d.records); }
    catch (e: any) { toast({ title: 'Fehler', description: e.message, variant: 'destructive' }); }
  };
  const runAirtable = async () => {
    if (!mapping.sku || !mapping.name) return toast({ title: 'Mapping unvollständig', description: 'SKU und Name benötigt', variant: 'destructive' });
    setBusy(true);
    try {
      const d = await call('catalog-import-airtable', { action: 'import', baseId, tableId, mapping });
      toast({ title: 'Import fertig', description: `+${d.inserted} · ~${d.updated} · ⏭${d.skipped}` });
      load();
    } catch (e: any) { toast({ title: 'Fehler', description: e.message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };

  const mapWebsite = async () => {
    setBusy(true);
    try { const d = await call('catalog-import-firecrawl', { action: 'map', url: wUrl, limit: wLimit }); setWLinks(d.links); }
    catch (e: any) { toast({ title: 'Fehler', description: e.message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };
  const runWebsite = async () => {
    const urls = Object.entries(wSelected).filter(([, v]) => v).map(([k]) => k);
    if (!urls.length) return toast({ title: 'Keine URLs gewählt', variant: 'destructive' });
    setBusy(true);
    try {
      const d = await call('catalog-import-firecrawl', { action: 'import', urls });
      toast({ title: 'Import fertig', description: `+${d.inserted} · ~${d.updated} · ⏭${d.skipped}` });
      load();
    } catch (e: any) { toast({ title: 'Fehler', description: e.message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };

  const previewFields = preview[0]?.fields ? Object.keys(preview[0].fields) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2"><Cloud className="h-5 w-5 text-primary" /><h2 className="text-xl font-semibold">Verwalteter Import</h2></div>

      <Tabs value={tab} onValueChange={v => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="airtable"><Cloud className="h-4 w-4 mr-2" />Airtable</TabsTrigger>
          <TabsTrigger value="website"><Globe className="h-4 w-4 mr-2" />Website (Firecrawl)</TabsTrigger>
        </TabsList>

        <TabsContent value="airtable" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Airtable → Katalog</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2 items-end">
                <Button onClick={loadBases} disabled={busy} variant="outline"><RefreshCw className="h-4 w-4 mr-2" />Bases laden</Button>
                {bases.length > 0 && (
                  <div className="flex-1"><Label>Base</Label>
                    <Select value={baseId} onValueChange={loadTables}>
                      <SelectTrigger><SelectValue placeholder="Wähle Base" /></SelectTrigger>
                      <SelectContent>{bases.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
                {tables.length > 0 && (
                  <div className="flex-1"><Label>Table</Label>
                    <Select value={tableId} onValueChange={setTableId}>
                      <SelectTrigger><SelectValue placeholder="Wähle Table" /></SelectTrigger>
                      <SelectContent>{tables.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
                {tableId && <Button onClick={doPreview} variant="secondary">Preview</Button>}
              </div>

              {previewFields.length > 0 && (
                <div className="grid md:grid-cols-5 gap-3">
                  {(['sku', 'name', 'brand', 'model', 'notes'] as const).map(k => (
                    <div key={k}><Label>{k}</Label>
                      <Select value={(mapping as any)[k]} onValueChange={v => setMapping({ ...mapping, [k]: v })}>
                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>{previewFields.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              )}
              {preview.length > 0 && (
                <div className="text-xs text-muted-foreground border rounded p-2 max-h-40 overflow-auto">
                  <pre>{JSON.stringify(preview.slice(0, 3).map(r => r.fields), null, 2)}</pre>
                </div>
              )}
              {tableId && <Button onClick={runAirtable} disabled={busy}><Play className="h-4 w-4 mr-2" />Import starten</Button>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="website" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Website (alix-lasers.com &c.) → Katalog</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2 items-end">
                <div className="flex-1"><Label>Start-URL</Label><Input value={wUrl} onChange={e => setWUrl(e.target.value)} placeholder="https://alix-lasers.com" /></div>
                <div className="w-32"><Label>Limit</Label><Input type="number" value={wLimit} onChange={e => setWLimit(parseInt(e.target.value) || 20)} /></div>
                <Button onClick={mapWebsite} disabled={busy || !wUrl}><RefreshCw className="h-4 w-4 mr-2" />URLs mappen</Button>
              </div>
              {wLinks.length > 0 && (
                <>
                  <div className="text-sm">{wLinks.length} URLs gefunden. Ausgewählte werden importiert (max 50).</div>
                  <div className="border rounded max-h-72 overflow-auto">
                    {wLinks.map(u => (
                      <label key={u} className="flex items-center gap-2 px-2 py-1 text-xs border-b last:border-0 hover:bg-muted">
                        <input type="checkbox" checked={!!wSelected[u]} onChange={e => setWSelected({ ...wSelected, [u]: e.target.checked })} />
                        <span className="truncate">{u}</span>
                      </label>
                    ))}
                  </div>
                  <Button onClick={runWebsite} disabled={busy}><Play className="h-4 w-4 mr-2" />Ausgewählte importieren</Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader><CardTitle className="text-base">Letzte Jobs</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Zeit</TableHead><TableHead>Typ</TableHead><TableHead>Status</TableHead><TableHead>Stats</TableHead></TableRow></TableHeader>
            <TableBody>
              {jobs.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Keine Jobs</TableCell></TableRow>}
              {jobs.map(j => (
                <TableRow key={j.id}>
                  <TableCell className="text-xs">{new Date(j.started_at).toLocaleString('de-DE')}</TableCell>
                  <TableCell><Badge variant="outline">{j.kind}</Badge></TableCell>
                  <TableCell><Badge className={j.status === 'success' ? 'bg-emerald-600' : j.status === 'partial' ? 'bg-amber-500' : ''}>{j.status}</Badge></TableCell>
                  <TableCell className="text-xs">{JSON.stringify(j.stats)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

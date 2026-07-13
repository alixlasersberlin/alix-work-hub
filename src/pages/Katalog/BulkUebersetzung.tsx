import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Languages, Play, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface Item { id: string; sku: string; name: string; }
interface Lang { code: string; name: string; }

type RunStatus = 'pending' | 'running' | 'done' | 'error';
interface RunRow { item: Item; lang: Lang; status: RunStatus; message?: string; }

export default function KatalogBulkUebersetzung() {
  const { toast } = useToast();
  const client = supabase as any;

  const [items, setItems] = useState<Item[]>([]);
  const [languages, setLanguages] = useState<Lang[]>([]);
  const [search, setSearch] = useState('');
  const [selItems, setSelItems] = useState<Record<string, boolean>>({});
  const [selLangs, setSelLangs] = useState<Record<string, boolean>>({});
  const [sourceLang, setSourceLang] = useState('de');
  const [loading, setLoading] = useState(true);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: its }, { data: lgs }] = await Promise.all([
        client.from('catalog_items').select('id, sku, name').in('status', ['freigegeben', 'aktiv']).order('name').limit(500),
        client.from('catalog_languages').select('code, name').eq('is_active', true).order('code'),
      ]);
      setItems((its ?? []) as Item[]);
      setLanguages((lgs ?? []) as Lang[]);
      setLoading(false);
    })();
  }, [client]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.sku.toLowerCase().includes(q) || i.name.toLowerCase().includes(q));
  }, [items, search]);

  const selectedItems = useMemo(() => items.filter((i) => selItems[i.id]), [items, selItems]);
  const selectedLangs = useMemo(() => languages.filter((l) => selLangs[l.code] && l.code !== sourceLang), [languages, selLangs, sourceLang]);
  const totalJobs = selectedItems.length * selectedLangs.length;
  const done = runs.filter((r) => r.status === 'done').length;
  const errors = runs.filter((r) => r.status === 'error').length;
  const progress = runs.length === 0 ? 0 : Math.round(((done + errors) / runs.length) * 100);

  const start = async () => {
    if (totalJobs === 0) return toast({ title: 'Nichts ausgewählt' });
    setBusy(true);
    const initial: RunRow[] = [];
    for (const it of selectedItems) for (const lg of selectedLangs) initial.push({ item: it, lang: lg, status: 'pending' });
    setRuns(initial);

    for (let idx = 0; idx < initial.length; idx++) {
      const row = initial[idx];
      setRuns((prev) => prev.map((r, i) => i === idx ? { ...r, status: 'running' } : r));
      try {
        // Quelltext aus Beschreibung
        const { data: src } = await client.from('catalog_item_descriptions')
          .select('short_text, long_text, technical_text, scope_text, warranty_text')
          .eq('item_id', row.item.id).eq('language_code', sourceLang).maybeSingle();
        if (!src) throw new Error(`Kein Quelltext (${sourceLang})`);

        const fields: (keyof typeof src)[] = ['short_text', 'long_text', 'technical_text', 'scope_text', 'warranty_text'];
        const translated: any = {};
        for (const f of fields) {
          const text = (src as any)[f];
          if (!text) continue;
          const { data: resp, error: fnErr } = await supabase.functions.invoke('catalog-ai-translate', {
            body: { text, targetLangs: [row.lang.code], sourceLang, context: row.item.name },
          });
          if (fnErr) throw fnErr;
          translated[f] = resp?.translations?.[row.lang.code] ?? null;
        }

        const { error: upErr } = await client.from('catalog_item_descriptions').upsert({
          item_id: row.item.id,
          language_code: row.lang.code,
          ...translated,
          status: 'entwurf',
        }, { onConflict: 'item_id,language_code' });
        if (upErr) throw upErr;

        setRuns((prev) => prev.map((r, i) => i === idx ? { ...r, status: 'done' } : r));
      } catch (e: any) {
        setRuns((prev) => prev.map((r, i) => i === idx ? { ...r, status: 'error', message: e?.message ?? String(e) } : r));
      }
    }

    setBusy(false);
    toast({ title: 'Bulk-Übersetzung abgeschlossen' });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><Languages className="h-4 w-4" /> Artikel</CardTitle>
            <Input placeholder="Suche…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
          </CardHeader>
          <CardContent className="max-h-[420px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={filtered.length > 0 && filtered.every((i) => selItems[i.id])}
                      onCheckedChange={(v) => {
                        const next = { ...selItems };
                        filtered.forEach((i) => { if (v) next[i.id] = true; else delete next[i.id]; });
                        setSelItems(next);
                      }}
                    />
                  </TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Name</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && <TableRow><TableCell colSpan={3} className="py-6 text-center text-muted-foreground">Lade…</TableCell></TableRow>}
                {!loading && filtered.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell><Checkbox checked={!!selItems[i.id]} onCheckedChange={(v) => setSelItems({ ...selItems, [i.id]: !!v })} /></TableCell>
                    <TableCell className="font-mono text-xs">{i.sku}</TableCell>
                    <TableCell>{i.name}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Sprachen & Start</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground">Quellsprache</label>
              <select className="w-full mt-1 h-9 rounded-md border bg-background px-2 text-sm" value={sourceLang} onChange={(e) => setSourceLang(e.target.value)}>
                {languages.map((l) => <option key={l.code} value={l.code}>{l.code.toUpperCase()} · {l.name}</option>)}
              </select>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-2">Zielsprachen</div>
              <div className="grid grid-cols-2 gap-1 max-h-40 overflow-auto">
                {languages.filter((l) => l.code !== sourceLang).map((l) => (
                  <label key={l.code} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={!!selLangs[l.code]} onCheckedChange={(v) => setSelLangs({ ...selLangs, [l.code]: !!v })} />
                    <span className="font-mono text-xs">{l.code.toUpperCase()}</span>
                    <span className="text-muted-foreground truncate">{l.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="pt-2 border-t space-y-2">
              <div className="text-xs text-muted-foreground">Jobs: <b className="text-foreground">{totalJobs}</b> ({selectedItems.length} Artikel × {selectedLangs.length} Sprachen)</div>
              <Button onClick={start} disabled={busy || totalJobs === 0} className="w-full">
                {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
                Übersetzung starten
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {runs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>Fortschritt</span>
              <span className="text-xs text-muted-foreground">{done} fertig · {errors} Fehler · {runs.length} gesamt</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress value={progress} />
            <div className="max-h-[360px] overflow-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Artikel</TableHead><TableHead>Sprache</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {runs.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm">{r.item.name}</TableCell>
                      <TableCell className="font-mono text-xs">{r.lang.code.toUpperCase()}</TableCell>
                      <TableCell className="text-xs">
                        {r.status === 'pending' && <span className="text-muted-foreground">wartet</span>}
                        {r.status === 'running' && <span className="flex items-center gap-1 text-primary"><Loader2 className="h-3 w-3 animate-spin" /> läuft</span>}
                        {r.status === 'done' && <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3 w-3" /> fertig</span>}
                        {r.status === 'error' && <span className="flex items-center gap-1 text-destructive" title={r.message}><XCircle className="h-3 w-3" /> Fehler</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

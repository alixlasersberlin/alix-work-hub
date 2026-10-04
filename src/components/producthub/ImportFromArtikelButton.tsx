import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { phSlug, phNormName } from '@/lib/producthub/config';

const db = supabase as any;

type Row = { id: string; zoho_item_id: string | null; name: string; sku: string | null; description: string | null;
  manufacturer: string | null; image_url: string | null; source_system: string | null; status: string | null; exists: boolean };

export function ImportFromArtikelButton({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [onlyNew, setOnlyNew] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [items, prods] = await Promise.all([
        db.from('zoho_items').select('id,zoho_item_id,name,sku,description,manufacturer,image_url,source_system,status').order('name').limit(5000),
        db.from('ph_products').select('sku,name,source_product_id'),
      ]);
      if (items.error) throw items.error;
      const skus = new Set((prods.data || []).map((p: any) => (p.sku || '').trim().toLowerCase()).filter(Boolean));
      const names = new Set((prods.data || []).map((p: any) => phNormName(p.name)));
      const srcs = new Set((prods.data || []).map((p: any) => p.source_product_id).filter(Boolean));
      setRows((items.data || []).map((i: any) => ({ ...i,
        exists: (i.sku && skus.has(i.sku.trim().toLowerCase())) || names.has(phNormName(i.name)) || (i.zoho_item_id && srcs.has(i.zoho_item_id)) })));
      setSel(new Set());
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  const filtered = useMemo(() => rows.filter(r => (!onlyNew || !r.exists) &&
    (!q || `${r.name} ${r.sku || ''} ${r.manufacturer || ''}`.toLowerCase().includes(q.toLowerCase()))), [rows, q, onlyNew]);

  const toggle = (id: string) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectableIds = filtered.filter(r => !r.exists).map(r => r.id);
  const allOn = selectableIds.length > 0 && selectableIds.every(id => sel.has(id));

  const run = async () => {
    const picked = rows.filter(r => sel.has(r.id) && !r.exists);
    if (!picked.length) return;
    setBusy(true);
    try {
      const uid = (await supabase.auth.getUser()).data.user?.id ?? null;
      const stamp = Date.now().toString(36);
      const payload = picked.map((r, i) => {
        const base = phSlug(r.name) || 'artikel';
        const key = (r.sku || base).toUpperCase().replace(/[^A-Z0-9]+/g, '-');
        return {
          name: r.name, sku: r.sku, status: 'draft',
          slug: `${base}-${stamp}${i}`,
          alix_product_id: `ALX-${key}-${stamp}${i}`.slice(0, 120),
          source_product_id: r.zoho_item_id,
          short_description: r.description, manufacturer: r.manufacturer,
          hero_image_url: r.image_url, created_by: uid, updated_by: uid,
        };
      });
      for (let i = 0; i < payload.length; i += 100) {
        const { error } = await db.from('ph_products').insert(payload.slice(i, i + 100));
        if (error) throw error;
      }
      toast.success(`${payload.length} Artikel als Entwurf angelegt`);
      setOpen(false); onDone();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => { setOpen(true); load(); }}>
        <Download className="w-4 h-4 mr-1" /> Aus Artikeln importieren
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>Artikel aus „Verkauf → Artikel" übernehmen</DialogTitle></DialogHeader>
          <div className="flex flex-wrap gap-3 items-center">
            <Input placeholder="Suche Name, SKU, Hersteller…" value={q} onChange={e => setQ(e.target.value)} className="max-w-sm" />
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={onlyNew} onCheckedChange={v => setOnlyNew(!!v)} /> Nur neue anzeigen</label>
            <span className="text-sm text-muted-foreground ml-auto">{sel.size} ausgewählt · {filtered.length} angezeigt</span>
          </div>
          <ScrollArea className="h-[55vh] border rounded-md">
            {loading ? <div className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin inline" /></div> : (
              <table className="w-full text-sm">
                <thead className="bg-muted/40 sticky top-0"><tr className="text-left">
                  <th className="p-2 w-8"><Checkbox checked={allOn} onCheckedChange={() => setSel(allOn ? new Set() : new Set(selectableIds))} /></th>
                  <th className="p-2">Artikel</th><th className="p-2">SKU</th><th className="p-2">Hersteller</th><th className="p-2">Firma</th><th className="p-2">Stand</th>
                </tr></thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="p-2"><Checkbox disabled={r.exists} checked={sel.has(r.id)} onCheckedChange={() => toggle(r.id)} /></td>
                      <td className="p-2 font-medium">{r.name}</td>
                      <td className="p-2 text-muted-foreground">{r.sku || '—'}</td>
                      <td className="p-2">{r.manufacturer || '—'}</td>
                      <td className="p-2 text-xs">{r.source_system === 'zoho_eu_2' ? 'Austria' : 'Deutschland'}</td>
                      <td className="p-2">{r.exists ? <Badge variant="secondary">schon vorhanden</Badge> : <Badge>NEU</Badge>}</td>
                    </tr>
                  ))}
                  {!filtered.length && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Keine Artikel gefunden.</td></tr>}
                </tbody>
              </table>
            )}
          </ScrollArea>
          <p className="text-xs text-muted-foreground">Neue Einträge werden als Entwurf angelegt. Vorhandene Geräte (gleiche SKU oder gleicher Name) werden nicht verändert.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={run} disabled={busy || !sel.size}>{busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}{sel.size} als Artikel anlegen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

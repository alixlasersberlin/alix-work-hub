import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Boxes, Copy, Loader2, Plus, Search, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useCanDelete } from '@/hooks/useCanDelete';
import { PM_CATEGORIES, PM_STATUS, pmQuality, pmScoreTone, pmStatusLabel, pmComplianceLabel, pmComplianceTone } from '@/lib/produktmaster/config';
import { pmDuplicate } from '@/lib/produktmaster/api';

const db = supabase as any;

const PM_CHILD_TABLES = [
  'ph_prices', 'ph_price_history', 'ph_compliance', 'ph_seo', 'ph_marketing',
  'ph_attribute_values', 'ph_variants', 'ph_scope_items', 'ph_workflow_steps',
  'ph_media', 'ph_documents',
];

export default function ArtikelListe() {
  const nav = useNavigate();
  const { roles } = useAuth();
  const canDelete = useCanDelete();
  const canWrite = (roles || []).some((r: string) => ['Super Admin', 'Admin', 'Marketing', 'Produktion'].includes(r));


  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<any[]>([]);
  const [prices, setPrices] = useState<any[]>([]);
  const [comp, setComp] = useState<any[]>([]);
  const [seo, setSeo] = useState<any[]>([]);
  const [media, setMedia] = useState<Record<string, number>>({});
  const [docs, setDocs] = useState<Record<string, number>>({});
  const [attrs, setAttrs] = useState<Record<string, number>>({});

  const [q, setQ] = useState('');
  const [fStatus, setFStatus] = useState('all');
  const [fCat, setFCat] = useState('all');
  const [fBrand, setFBrand] = useState('all');
  const [fFlag, setFFlag] = useState('all');

  const [dupSource, setDupSource] = useState<any>(null);
  const [dup, setDup] = useState({ sku: '', name: '', master: true, tech: true, media: false, documents: false, scope: true, prices: false });
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);


  const load = async () => {
    setLoading(true);
    const [p, pr, c, s, m, d, a] = await Promise.all([
      db.from('ph_products').select('*').order('name'),
      db.from('ph_prices').select('*'),
      db.from('ph_compliance').select('*'),
      db.from('ph_seo').select('*'),
      db.from('ph_media').select('product_id'),
      db.from('ph_documents').select('product_id'),
      db.from('ph_attribute_values').select('product_id'),
    ]);
    const cnt = (arr: any[]) => {
      const r: Record<string, number> = {};
      (arr || []).forEach((x: any) => { r[x.product_id] = (r[x.product_id] || 0) + 1; });
      return r;
    };
    setProducts(p.data || []); setPrices(pr.data || []); setComp(c.data || []); setSeo(s.data || []);
    setMedia(cnt(m.data)); setDocs(cnt(d.data)); setAttrs(cnt(a.data));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const brands = useMemo(() => Array.from(new Set(products.map(p => p.brand).filter(Boolean))) as string[], [products]);

  const rows = useMemo(() => products.map(p => {
    const bundle = {
      product: p,
      prices: prices.find(x => x.product_id === p.id && !x.variant_id),
      compliance: comp.find(x => x.product_id === p.id),
      seo: seo.find(x => x.product_id === p.id),
      mediaCount: media[p.id] || 0, docCount: docs[p.id] || 0, attrCount: attrs[p.id] || 0,
    };
    return { p, bundle, quality: pmQuality(bundle) };
  }), [products, prices, comp, seo, media, docs, attrs]);

  const filtered = useMemo(() => rows.filter(({ p, bundle, quality }) => {
    if (q) {
      const s = `${p.name} ${p.sku} ${p.model} ${p.ean} ${p.brand} ${p.manufacturer} ${(p.categories || []).join(' ')} ${(p.applications || []).join(' ')} ${p.alix_product_id}`.toLowerCase();
      if (!s.includes(q.toLowerCase())) return false;
    }
    if (fStatus !== 'all' && p.status !== fStatus) return false;
    if (fCat !== 'all' && !(p.categories || []).includes(fCat)) return false;
    if (fBrand !== 'all' && p.brand !== fBrand) return false;
    if (fFlag === 'published' && p.status !== 'published') return false;
    if (fFlag === 'nodata' && quality.total >= 70) return false;
    if (fFlag === 'nomedia' && (bundle.mediaCount > 0 || p.hero_image_url)) return false;
    if (fFlag === 'nodocs' && bundle.docCount > 0) return false;
    if (fFlag === 'compliance' && bundle.compliance?.approval_status === 'approved') return false;
    return true;
  }), [rows, q, fStatus, fCat, fBrand, fFlag]);

  const createNew = () => nav('/artikel/neu');

  const selIds = useMemo(() => Object.entries(selected).filter(([, v]) => v).map(([k]) => k), [selected]);
  const allChecked = filtered.length > 0 && filtered.every(({ p }) => selected[p.id]);
  const toggleAll = (v: boolean) => {
    const next: Record<string, boolean> = {};
    if (v) filtered.forEach(({ p }) => { next[p.id] = true; });
    setSelected(next);
  };

  const runDelete = async () => {
    if (selIds.length === 0) return;
    setBusy(true);
    try {
      for (const t of PM_CHILD_TABLES) {
        await db.from(t).delete().in('product_id', selIds);
      }
      const { error } = await db.from('ph_products').delete().in('id', selIds);
      if (error) throw error;
      toast.success(`${selIds.length} Artikel gelöscht`);
      setSelected({});
      setConfirmDelete(false);
      load();
    } catch (e: any) {
      toast.error(e.message || 'Löschen fehlgeschlagen');
    } finally { setBusy(false); }
  };


  const runDuplicate = async () => {
    if (!dup.sku.trim() || !dup.name.trim()) { toast.error('Neue SKU und Name sind erforderlich'); return; }
    setBusy(true);
    try {
      const id = await pmDuplicate(dupSource.id, dup);
      toast.success('Artikel dupliziert');
      setDupSource(null);
      nav(`/artikel/${id}`);
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader title="Alle Artikel" subtitle="Zentrale Artikelübersicht des ALIX Product Master" icon={Boxes}
        actions={canWrite ? <Button onClick={createNew}><Plus className="h-4 w-4 mr-1" />Neuer Artikel</Button> : undefined} />

      <Card><CardContent className="p-3 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Name, SKU, Modell, EAN, Kategorie, Hersteller…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <Select value={fStatus} onValueChange={setFStatus}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Alle Status</SelectItem>
            {PM_STATUS.map(s => <SelectItem key={s.code} value={s.code}>{s.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={fCat} onValueChange={setFCat}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="Kategorie" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Alle Kategorien</SelectItem>
            {PM_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={fBrand} onValueChange={setFBrand}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Marke" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Alle Marken</SelectItem>
            {brands.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={fFlag} onValueChange={setFFlag}>
          <SelectTrigger className="w-[190px]"><SelectValue placeholder="Filter" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Ohne Zusatzfilter</SelectItem>
            <SelectItem value="published">Website veröffentlicht</SelectItem>
            <SelectItem value="nodata">Fehlende Daten</SelectItem>
            <SelectItem value="nomedia">Fehlende Bilder</SelectItem>
            <SelectItem value="nodocs">Fehlende Dokumente</SelectItem>
            <SelectItem value="compliance">Compliance offen</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="outline">{filtered.length} Artikel</Badge>
      </CardContent></Card>

      <Card><CardContent className="p-0">
        {loading ? <div className="p-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Artikel</TableHead><TableHead>SKU</TableHead><TableHead>Kategorie</TableHead>
              <TableHead>Status</TableHead><TableHead>Compliance</TableHead><TableHead className="text-right">Qualität</TableHead>
              <TableHead className="w-10" />
            </TableRow></TableHeader>
            <TableBody>
              {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Keine Artikel gefunden.</TableCell></TableRow>}
              {filtered.map(({ p, bundle, quality }) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link to={`/artikel/${p.id}`} className="font-medium text-primary hover:underline">{p.name}</Link>
                    <div className="text-[11px] text-muted-foreground">{p.model || '—'} · {p.brand || 'ALIX'}</div>
                  </TableCell>
                  <TableCell className="text-xs">{p.sku || '—'}</TableCell>
                  <TableCell className="text-xs">{(p.categories || []).join(', ') || '—'}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{pmStatusLabel(p.status)}</Badge></TableCell>
                  <TableCell><span className={`text-[10px] px-2 py-0.5 rounded ${pmComplianceTone(bundle.compliance?.approval_status)}`}>{pmComplianceLabel(bundle.compliance?.approval_status)}</span></TableCell>
                  <TableCell className={`text-right tabular-nums font-semibold ${pmScoreTone(quality.total)}`}>{quality.total} %</TableCell>
                  <TableCell>
                    {canWrite && (
                      <Button variant="ghost" size="icon" title="Duplizieren"
                        onClick={() => { setDupSource(p); setDup(d => ({ ...d, sku: '', name: `${p.name} Kopie` })); }}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent></Card>

      <Dialog open={!!dupSource} onOpenChange={o => !o && setDupSource(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Produkt duplizieren</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Neue Artikelnummer / SKU *</Label><Input value={dup.sku} onChange={e => setDup({ ...dup, sku: e.target.value })} /></div>
            <div><Label>Produktname *</Label><Input value={dup.name} onChange={e => setDup({ ...dup, name: e.target.value })} /></div>
            <div className="space-y-2 pt-1">
              {([['master', 'Stammdaten übernehmen'], ['tech', 'Technische Daten übernehmen'], ['media', 'Medien übernehmen'],
                 ['documents', 'Dokumente übernehmen'], ['scope', 'Lieferumfang übernehmen'], ['prices', 'Preise übernehmen']] as const).map(([k, label]) => (
                <label key={k} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={(dup as any)[k]} onCheckedChange={v => setDup({ ...dup, [k]: !!v })} />{label}
                </label>
              ))}
              <div className="text-xs text-muted-foreground">SEO-Daten werden bewusst nicht übernommen.</div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDupSource(null)}>Abbrechen</Button>
            <Button onClick={runDuplicate} disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Duplizieren</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

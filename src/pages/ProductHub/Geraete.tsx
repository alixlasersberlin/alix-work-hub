import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Cpu, Plus, Star, Lock, Loader2, Search, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { phTone, phToneClass, PH_STATUS, PH_APPLICATIONS, phSlug } from '@/lib/producthub/config';
import { phCreateProduct } from '@/lib/producthub/api';
import { useAuth } from '@/hooks/useAuth';

const db = supabase as any;

export default function ProductHubGeraete() {
  const nav = useNavigate();
  const { roles } = useAuth();
  const canWrite = (roles || []).some((r: string) => ['Super Admin', 'Admin'].includes(r));
  const [rows, setRows] = useState<any[]>([]);
  const [media, setMedia] = useState<Record<string, number>>({});
  const [docs, setDocs] = useState<Record<string, number>>({});
  const [conf, setConf] = useState<Record<string, number>>({});
  const [chans, setChans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [fCat, setFCat] = useState('all');
  const [fStatus, setFStatus] = useState('all');
  const [fSite, setFSite] = useState('all');
  const [fFlag, setFFlag] = useState('all');
  const [enrichOpen, setEnrichOpen] = useState(false);
  const [enrichBusy, setEnrichBusy] = useState(false);
  const [enrichRes, setEnrichRes] = useState<any>(null);

  const ENRICH_FIELDS = ['short_description', 'long_description', 'wavelengths', 'power', 'fluence',
    'pulse_duration', 'frequency', 'spot_sizes', 'cooling', 'laser_class', 'intended_use',
    'manufacturer', 'seo_title', 'seo_description'];

  const runEnrich = async (mode: 'preview' | 'apply') => {
    setEnrichBusy(true);
    try {
      const ids = filtered.filter(p => ENRICH_FIELDS.some(f => !String(p[f] ?? '').trim())).map(p => p.id);
      const { data, error } = await supabase.functions.invoke('product-hub-enrich', {
        body: { mode, productIds: ids, limit: 40 },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setEnrichRes(data);
      if (mode === 'apply') { toast.success(`${(data as any).filled} Geräte ergänzt`); await load(); }
    } catch (e: any) { toast.error(e.message || 'Anreicherung fehlgeschlagen'); }
    finally { setEnrichBusy(false); }
  };


  const load = async () => {
    setLoading(true);
    const [p, m, d, c, pc] = await Promise.all([
      db.from('ph_products').select('*').order('sort_order').order('name'),
      db.from('ph_media').select('product_id'),
      db.from('ph_documents').select('product_id'),
      db.from('ph_conflicts').select('product_id').is('resolved_at', null),
      db.from('ph_product_channels').select('*'),
    ]);
    const cnt = (arr: any[]) => { const r: Record<string, number> = {}; (arr || []).forEach(x => { r[x.product_id] = (r[x.product_id] || 0) + 1; }); return r; };
    setRows(p.data || []); setMedia(cnt(m.data)); setDocs(cnt(d.data)); setConf(cnt(c.data));
    setChans(pc.data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const pendingFor = (id: string) => chans.some(c => c.product_id === id && c.has_pending_changes);

  const filtered = useMemo(() => rows.filter(p => {
    const t = phTone(p, { conflicts: conf[p.id], media: media[p.id], documents: docs[p.id], pending: pendingFor(p.id) });
    if (q) {
      const s = `${p.name} ${p.model} ${p.sku} ${p.alix_product_id} ${p.slug}`.toLowerCase();
      if (!s.includes(q.toLowerCase())) return false;
    }
    if (fCat !== 'all' && !(p.categories || []).includes(fCat) && !(p.applications || []).includes(fCat)) return false;
    if (fStatus !== 'all' && p.status !== fStatus) return false;
    if (fSite === 'com' && !p.active_com) return false;
    if (fSite === 'de' && !p.active_de) return false;
    if (fFlag === 'smart' && !(p.smart_ki && Object.keys(p.smart_ki).length)) return false;
    if (fFlag === 'mdr' && p.mdr_status) return false;
    if (fFlag === 'conflict' && !conf[p.id]) return false;
    if (fFlag === 'nomedia' && media[p.id]) return false;
    if (fFlag === 'nodocs' && docs[p.id]) return false;
    if (fFlag === 'sync' && t.tone !== 'blue') return false;
    return true;
  }), [rows, q, fCat, fStatus, fSite, fFlag, conf, media, docs, chans]);

  const createNew = async () => {
    const name = window.prompt('Name des neuen Geräts?');
    if (!name) return;
    try {
      const id = await phCreateProduct({ name, slug: phSlug(name), status: 'draft', alix_product_id: `ALX-${phSlug(name).toUpperCase()}` });
      toast.success('Gerät angelegt');
      nav(`/product-hub/geraete/${id}`);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader title="Product Hub · Geräte" subtitle="Zentraler Gerätestamm (Master)" icon={Cpu}
        actions={canWrite ? (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { setEnrichRes(null); setEnrichOpen(true); }}>
              <Sparkles className="w-4 h-4 mr-1" /> Daten anreichern
            </Button>
            <Button size="sm" onClick={createNew}><Plus className="w-4 h-4 mr-1" /> Neues Gerät</Button>
          </div>
        ) : undefined} />

      <Card>
        <CardContent className="p-3 flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Suche Name, Modell, SKU, Slug…" className="pl-8" />
          </div>
          <Select value={fCat} onValueChange={setFCat}>
            <SelectTrigger className="w-[190px]"><SelectValue placeholder="Kategorie" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Alle Kategorien</SelectItem>
              {PH_APPLICATIONS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={fStatus} onValueChange={setFStatus}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Alle Status</SelectItem>
              {PH_STATUS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={fSite} onValueChange={setFSite}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Webseite" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Alle Webseiten</SelectItem>
              <SelectItem value="com">COM aktiv</SelectItem><SelectItem value="de">DE aktiv</SelectItem></SelectContent>
          </Select>
          <Select value={fFlag} onValueChange={setFFlag}>
            <SelectTrigger className="w-[190px]"><SelectValue placeholder="Filter" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Ohne Zusatzfilter</SelectItem>
              <SelectItem value="smart">Smart KI</SelectItem>
              <SelectItem value="mdr">MDR fehlt</SelectItem>
              <SelectItem value="conflict">Konflikte</SelectItem>
              <SelectItem value="nomedia">Fehlende Bilder</SelectItem>
              <SelectItem value="nodocs">Fehlende Dokumente</SelectItem>
              <SelectItem value="sync">Änderung wartet</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Gerät</TableHead><TableHead>Modell</TableHead><TableHead>Kategorie</TableHead>
                <TableHead className="text-center">COM</TableHead><TableHead className="text-center">DE</TableHead>
                <TableHead>Status</TableHead><TableHead>MDR</TableHead>
                <TableHead className="text-center">Bilder</TableHead><TableHead className="text-center">Dok.</TableHead>
                <TableHead>Letzte Änderung</TableHead><TableHead>Sync</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={11} className="text-center py-8"><Loader2 className="w-4 h-4 animate-spin inline" /></TableCell></TableRow>}
              {!loading && filtered.length === 0 && <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Keine Geräte. Import unter „Einstellungen“ starten.</TableCell></TableRow>}
              {filtered.map(p => {
                const t = phTone(p, { conflicts: conf[p.id], media: media[p.id], documents: docs[p.id], pending: pendingFor(p.id) });
                return (
                  <TableRow key={p.id} className="cursor-pointer" onClick={() => nav(`/product-hub/geraete/${p.id}`)}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${phToneClass(t.tone)}`} title={t.label} />
                        {p.name}
                        {p.featured && <Star className="w-3.5 h-3.5 text-amber-400" />}
                        {p.protected && <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.model || '—'}</TableCell>
                    <TableCell className="text-xs">{(p.categories || []).concat(p.applications || []).slice(0, 2).join(', ') || '—'}</TableCell>
                    <TableCell className="text-center">{p.active_com ? '🟢' : '—'}</TableCell>
                    <TableCell className="text-center">{p.active_de ? '🟢' : '—'}</TableCell>
                    <TableCell><Badge variant="outline">{p.status}</Badge></TableCell>
                    <TableCell className="text-xs">{p.mdr_status || <span className="text-amber-500">offen</span>}</TableCell>
                    <TableCell className="text-center">{media[p.id] || 0}</TableCell>
                    <TableCell className="text-center">{docs[p.id] || 0}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(p.updated_at).toLocaleDateString('de-DE')}</TableCell>
                    <TableCell className="text-xs">{t.label}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <div className="text-xs text-muted-foreground">🟢 vollständig · 🟡 Review · 🔴 Konflikt · 🔵 Änderung wartet · ⭐ Featured · 🔒 geschützt</div>
    </div>
  );
}

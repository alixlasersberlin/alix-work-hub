import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Files, Search, Loader2, Eye, ExternalLink, ShieldAlert, Archive, Link2, Copy, CheckCircle2, Trash2, LinkIcon, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';


type Doc = {
  id: string;
  title: string;
  original_filename: string | null;
  serial_number: string | null;
  document_date: string | null;
  created_at: string;
  status: string;
  confidentiality_level: string;
  current_version: number;
  mime_type: string;
  file_size: number;
  order_id: string | null;
  customer_id: string | null;
  category_id: string | null;
  source: string | null;
  tags: string[] | null;
};
type Cat = { id: string; code: string; name: string };
type Order = { id: string; order_number: string | null; customer_id: string | null };
type Customer = { id: string; company_name: string | null; contact_name: string | null; external_customer_id: string | null; raw_data?: any };

export default function AlixDocsSearch() {
  const { roles } = useAuth();
  const canDelete = roles.includes('Super Admin') || roles.includes('Admin');

  const [docs, setDocs] = useState<Doc[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [orders, setOrders] = useState<Record<string, Order>>({});
  const [customers, setCustomers] = useState<Record<string, Customer>>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [custQ, setCustQ] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareResult, setShareResult] = useState<{ url: string; token: string } | null>(null);
  const [sharePwd, setSharePwd] = useState('');
  const [shareExpiry, setShareExpiry] = useState('');
  const [shareMax, setShareMax] = useState('');
  const [shareNote, setShareNote] = useState('');

  const [snippets, setSnippets] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    setSelected(new Set());
    setSnippets({});

    // Volltext-Snippet-Suche zuerst (nur wenn Query gesetzt)
    let ftsIds: string[] | null = null;
    if (q.trim()) {
      const { data: fts, error: ftsErr } = await supabase.rpc('alixdocs_search_snippets', {
        q: q.trim(), max_rows: 300,
      });
      if (!ftsErr && fts) {
        const map: Record<string, string> = {};
        (fts as any[]).forEach(r => { map[r.id] = r.snippet; });
        setSnippets(map);
        ftsIds = (fts as any[]).map(r => r.id);
      }
    }

    let query = supabase.from('alixdocs_documents')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(500);

    if (catFilter !== 'all') {
      const cat = cats.find(c => c.code === catFilter);
      if (cat) query = query.eq('category_id', cat.id);
    }
    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    if (sourceFilter !== 'all') query = query.eq('source', sourceFilter);
    if (dateFrom) query = query.gte('created_at', dateFrom);
    if (dateTo) query = query.lte('created_at', dateTo + 'T23:59:59');
    if (tagFilter.trim()) {
      const tags = tagFilter.split(',').map(t => t.trim()).filter(Boolean);
      if (tags.length) query = query.overlaps('tags', tags);
    }
    if (custQ.trim()) {
      const { data: cs } = await supabase.from('customers')
        .select('id').or(`company_name.ilike.%${custQ}%,contact_name.ilike.%${custQ}%,external_customer_id.ilike.%${custQ}%`).limit(100);
      const ids = (cs ?? []).map((c: any) => c.id);
      if (ids.length === 0) { setDocs([]); setLoading(false); return; }
      query = query.in('customer_id', ids);
    }
    if (q.trim()) {
      // Volltext-Ergebnisse ∪ Fallback ILIKE (Dateiname/Seriennummer werden nicht indiziert)
      const s = `%${q}%`;
      if (ftsIds && ftsIds.length) {
        const idList = ftsIds.map(id => `"${id}"`).join(',');
        query = query.or(
          `id.in.(${idList}),original_filename.ilike.${s},serial_number.ilike.${s}`
        );
      } else {
        query = query.or(
          `title.ilike.${s},description.ilike.${s},original_filename.ilike.${s},serial_number.ilike.${s},ocr_text.ilike.${s},ai_summary.ilike.${s}`
        );
      }
    }
    const { data, error } = await query;
    if (error) toast.error(error.message);
    let rows = (data ?? []) as Doc[];
    // Sortiere nach FTS-Rang wenn vorhanden
    if (ftsIds && ftsIds.length) {
      const rank = new Map(ftsIds.map((id, i) => [id, i]));
      rows = [...rows].sort((a, b) => (rank.get(a.id) ?? 999) - (rank.get(b.id) ?? 999));
    }
    setDocs(rows);

    const orderIds = [...new Set(rows.map(r => r.order_id).filter(Boolean))] as string[];
    let orderMap: Record<string, Order> = {};
    if (orderIds.length) {
      const { data: o } = await supabase.from('orders')
        .select('id, order_number, customer_id').in('id', orderIds);
      orderMap = Object.fromEntries((o ?? []).map((r: any) => [r.id, r]));
      setOrders(orderMap);
    }

    // Auto-Backfill: Dokumente mit Auftrag aber ohne Kunde → Kunde aus Auftrag übernehmen
    const backfill = rows.filter(r => r.order_id && !r.customer_id && orderMap[r.order_id]?.customer_id);
    if (backfill.length) {
      const updates = backfill.map(r => ({ id: r.id, customer_id: orderMap[r.order_id!].customer_id! }));
      // Sequenziell updaten (RLS-freundlich), Fehler ignorieren
      await Promise.all(updates.map(u =>
        supabase.from('alixdocs_documents').update({ customer_id: u.customer_id }).eq('id', u.id)
      ));
      rows = rows.map(r => {
        const u = updates.find(x => x.id === r.id);
        return u ? { ...r, customer_id: u.customer_id } : r;
      });
      setDocs(rows);
    }

    const custIds = [...new Set(rows.map(r => r.customer_id).filter(Boolean))] as string[];
    if (custIds.length) {
      const { data: c } = await supabase.from('customers')
        .select('id, company_name, contact_name, external_customer_id').in('id', custIds);
      setCustomers(Object.fromEntries((c ?? []).map((r: any) => [r.id, r])));
    }
    setLoading(false);
  };

  const renderSnippet = (raw: string) => {
    // <<...>> als <mark> darstellen
    const parts = raw.split(/(<<|>>)/);
    let hi = false;
    return parts.map((p, i) => {
      if (p === '<<') { hi = true; return null; }
      if (p === '>>') { hi = false; return null; }
      return hi
        ? <mark key={i} className="bg-yellow-400/40 text-foreground rounded px-0.5">{p}</mark>
        : <span key={i}>{p}</span>;
    });
  };

  useEffect(() => {
    supabase.from('alixdocs_categories').select('id, code, name').order('sort_order').then(({ data }) => setCats((data ?? []) as Cat[]));
  }, []);
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [catFilter, statusFilter, sourceFilter, dateFrom, dateTo]);

  const catMap = useMemo(() => Object.fromEntries(cats.map(c => [c.id, c])), [cats]);

  const openDoc = async (d: Doc) => {
    const { data, error } = await supabase.functions.invoke('alixdocs-signed-url', {
      body: { document_id: d.id, version_number: d.current_version },
    });
    if (error || (data as any)?.error) { toast.error((data as any)?.error || error?.message); return; }
    window.open((data as any).url, '_blank');
  };

  const toggle = (id: string) => {
    setSelected(s => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };
  const toggleAll = () => {
    if (selected.size === docs.length) setSelected(new Set());
    else setSelected(new Set(docs.map(d => d.id)));
  };

  const bulkZip = async () => {
    if (selected.size === 0) return;
    setBulkBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const projectUrl = (import.meta as any).env.VITE_SUPABASE_URL;
      const res = await fetch(`${projectUrl}/functions/v1/alixdocs-zip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ document_ids: Array.from(selected) }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `alixdocs_${new Date().toISOString().slice(0, 10)}.zip`;
      a.click(); URL.revokeObjectURL(a.href);
      toast.success(`${selected.size} Dokumente als ZIP heruntergeladen`);
    } catch (e: any) {
      toast.error(e?.message || 'Download fehlgeschlagen');
    } finally { setBulkBusy(false); }
  };

  const bulkArchive = async () => {
    if (selected.size === 0) return;
    if (!confirm(`${selected.size} Dokumente archivieren?`)) return;
    setBulkBusy(true);
    const { error } = await supabase.from('alixdocs_documents')
      .update({ status: 'archiviert' }).in('id', Array.from(selected));
    setBulkBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Archiviert'); load();
  };

  const releaseDoc = async (d: Doc) => {
    const { error } = await supabase.from('alixdocs_documents')
      .update({ status: 'freigegeben' }).eq('id', d.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Freigegeben');
    setDocs(prev => prev.map(x => x.id === d.id ? { ...x, status: 'freigegeben' } : x));
  };

  const deleteDoc = async (d: Doc) => {
    if (!canDelete) return;
    if (!confirm(`Dokument "${d.title}" endgültig in den Papierkorb verschieben?`)) return;
    const { error } = await supabase.from('alixdocs_documents')
      .update({ deleted_at: new Date().toISOString() }).eq('id', d.id);
    if (error) { toast.error(error.message); return; }
    toast.success('In Papierkorb verschoben');
    setDocs(prev => prev.filter(x => x.id !== d.id));
  };

  // Zu Auftrag zuordnen
  const [assignDoc, setAssignDoc] = useState<Doc | null>(null);
  const [assignQ, setAssignQ] = useState('');
  const [assignBusy, setAssignBusy] = useState(false);
  const [assignResults, setAssignResults] = useState<Array<{ id: string; order_number: string | null; customer_id: string | null; customer_name?: string | null; customer_number?: string | null; hit?: string }>>([]);

  // Inline Tag-Editor
  const [tagEditId, setTagEditId] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState('');
  const [tagBusy, setTagBusy] = useState(false);

  const saveTags = async (d: Doc, next: string[]) => {
    setTagBusy(true);
    const { error } = await supabase.from('alixdocs_documents')
      .update({ tags: next }).eq('id', d.id);
    setTagBusy(false);
    if (error) { toast.error(error.message); return false; }
    setDocs(prev => prev.map(x => x.id === d.id ? { ...x, tags: next } : x));
    return true;
  };

  const addTag = async (d: Doc) => {
    const raw = tagDraft.trim();
    if (!raw) { setTagEditId(null); return; }
    const additions = raw.split(',').map(t => t.trim()).filter(Boolean);
    const current = d.tags || [];
    const merged = Array.from(new Set([...current, ...additions]));
    const ok = await saveTags(d, merged);
    if (ok) { toast.success('Tag hinzugefügt'); setTagDraft(''); setTagEditId(null); }
  };

  const removeTag = async (d: Doc, tag: string) => {
    const next = (d.tags || []).filter(t => t !== tag);
    await saveTags(d, next);
  };

  const searchOrdersForAssign = async () => {
    const term = assignQ.trim();
    if (!term) { setAssignResults([]); return; }
    setAssignBusy(true);
    try {
      const like = `%${term}%`;
      const orderIds = new Set<string>();
      const hitMap = new Map<string, string>();

      // 1) Auftragsnummer
      const { data: byNum } = await supabase.from('orders')
        .select('id, order_number, customer_id')
        .ilike('order_number', like).limit(50);
      (byNum ?? []).forEach((o: any) => { orderIds.add(o.id); hitMap.set(o.id, `Auftrag ${o.order_number}`); });

      // 2) Kunde
      const { data: cs } = await supabase.from('customers')
        .select('id, company_name, contact_name, external_customer_id')
        .or(`company_name.ilike.${like},contact_name.ilike.${like},external_customer_id.ilike.${like}`).limit(50);
      const cIds = (cs ?? []).map((c: any) => c.id);
      if (cIds.length) {
        const { data: byCust } = await supabase.from('orders')
          .select('id, order_number, customer_id')
          .in('customer_id', cIds).order('created_at', { ascending: false }).limit(100);
        (byCust ?? []).forEach((o: any) => {
          if (!orderIds.has(o.id)) hitMap.set(o.id, `Kunde`);
          orderIds.add(o.id);
        });
      }

      // 3) Seriennummer via lager_devices
      const { data: devs } = await supabase.from('lager_devices')
        .select('serial_number, order_id').ilike('serial_number', like).not('order_id', 'is', null).limit(50);
      (devs ?? []).forEach((d: any) => {
        if (d.order_id) {
          if (!orderIds.has(d.order_id)) hitMap.set(d.order_id, `SN ${d.serial_number}`);
          orderIds.add(d.order_id);
        }
      });

      if (orderIds.size === 0) { setAssignResults([]); return; }
      const ids = Array.from(orderIds);
      const { data: full } = await supabase.from('orders')
        .select('id, order_number, customer_id').in('id', ids);
      const custIds = [...new Set((full ?? []).map((o: any) => o.customer_id).filter(Boolean))] as string[];
      let cMap: Record<string, any> = {};
      if (custIds.length) {
        const { data: cc } = await supabase.from('customers')
          .select('id, company_name, contact_name, external_customer_id').in('id', custIds);
        cMap = Object.fromEntries((cc ?? []).map((c: any) => [c.id, c]));
      }
      setAssignResults((full ?? []).map((o: any) => ({
        id: o.id,
        order_number: o.order_number,
        customer_id: o.customer_id,
        customer_name: o.customer_id ? (cMap[o.customer_id]?.company_name ?? cMap[o.customer_id]?.contact_name) : null,
        customer_number: o.customer_id ? cMap[o.customer_id]?.external_customer_id : null,
        hit: hitMap.get(o.id),
      })));
    } finally { setAssignBusy(false); }
  };

  const assignOrder = async (orderId: string, customerId: string | null) => {
    if (!assignDoc) return;
    const patch: any = { order_id: orderId, status: 'freigegeben' };
    if (customerId) patch.customer_id = customerId;
    const { error } = await supabase.from('alixdocs_documents')
      .update(patch).eq('id', assignDoc.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Auftrag zugeordnet und freigegeben');
    setDocs(prev => prev.map(x => x.id === assignDoc.id
      ? { ...x, order_id: orderId, customer_id: customerId ?? x.customer_id, status: 'freigegeben' }
      : x));
    // Order/Customer-Maps ergänzen
    if (!orders[orderId]) {
      const { data: o } = await supabase.from('orders')
        .select('id, order_number, customer_id').eq('id', orderId).maybeSingle();
      if (o) setOrders(prev => ({ ...prev, [orderId]: o as any }));
    }
    if (customerId && !customers[customerId]) {
      const { data: c } = await supabase.from('customers')
        .select('id, company_name, contact_name, external_customer_id').eq('id', customerId).maybeSingle();
      if (c) setCustomers(prev => ({ ...prev, [customerId]: c as any }));
    }
    setAssignDoc(null); setAssignQ(''); setAssignResults([]);
  };




  const createShare = async () => {
    if (selected.size === 0) return;
    setBulkBusy(true);
    try {
      const body: any = { document_ids: Array.from(selected), note: shareNote || null };
      if (sharePwd) body.password = sharePwd;
      if (shareExpiry) body.expires_at = new Date(shareExpiry).toISOString();
      if (shareMax) body.max_downloads = Number(shareMax);
      const { data, error } = await supabase.functions.invoke('alixdocs-share-create', { body });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const token = (data as any).token;
      const fullUrl = `${window.location.origin}/dokumente/share/${token}`;
      setShareResult({ url: fullUrl, token });
    } catch (e: any) {
      toast.error(e?.message || 'Share fehlgeschlagen');
    } finally { setBulkBusy(false); }
  };

  const confBadge = (l: string) => l === 'streng_vertraulich'
    ? <Badge className="bg-red-500/15 text-red-400"><ShieldAlert className="w-3 h-3 mr-1" />streng</Badge>
    : l === 'vertraulich' ? <Badge className="bg-amber-500/15 text-amber-400">vertraulich</Badge> : null;

  return (
    <div className="space-y-6 animate-fade-in">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Files className="w-5 h-5" /> AlixDocs — Globale Dokumentensuche</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Titel, Dateiname, OCR, Seriennummer…"
                     value={q} onChange={(e) => setQ(e.target.value)}
                     onKeyDown={(e) => e.key === 'Enter' && load()} />
            </div>
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger><SelectValue placeholder="Kategorie" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Kategorien</SelectItem>
                {cats.map(c => <SelectItem key={c.id} value={c.code}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                <SelectItem value="entwurf">Entwurf</SelectItem>
                <SelectItem value="geprueft">Geprüft</SelectItem>
                <SelectItem value="freigegeben">Freigegeben</SelectItem>
                <SelectItem value="archiviert">Archiviert</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <div className="flex gap-2">
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              <Button onClick={load}>Suchen</Button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <Input className="md:col-span-2" placeholder="Kunde: Name oder Nr." value={custQ} onChange={e => setCustQ(e.target.value)}
                   onKeyDown={e => e.key === 'Enter' && load()} />
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger><SelectValue placeholder="Quelle" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Quellen</SelectItem>
                <SelectItem value="upload">Upload</SelectItem>
                <SelectItem value="auto_pdf">Auto-Ablage</SelectItem>
                <SelectItem value="mail_attachment">MailCenter</SelectItem>
                <SelectItem value="signature">Signatur</SelectItem>
                <SelectItem value="zoho">Zoho</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Tags (Komma)" value={tagFilter} onChange={e => setTagFilter(e.target.value)}
                   onKeyDown={e => e.key === 'Enter' && load()} />
            <div className="md:col-span-2 text-xs text-muted-foreground flex items-center">
              {!loading && `${docs.length} Treffer${selected.size ? ` · ${selected.size} ausgewählt` : ''}`}
            </div>
          </div>

          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-md">
              <span className="text-sm font-medium mr-auto">{selected.size} Dokumente ausgewählt</span>
              <Button size="sm" variant="outline" disabled={bulkBusy} onClick={bulkZip}>
                <Archive className="w-4 h-4 mr-1" /> ZIP herunterladen
              </Button>
              <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => { setShareResult(null); setShareOpen(true); }}>
                <Link2 className="w-4 h-4 mr-1" /> Freigabe-Link erstellen
              </Button>
              <Button size="sm" variant="outline" disabled={bulkBusy} onClick={bulkArchive}>Archivieren</Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Auswahl aufheben</Button>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Suche…
            </div>
          ) : docs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Keine Dokumente gefunden.</div>
          ) : (
            <div className="border border-border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">
                      <Checkbox
                        checked={selected.size === docs.length && docs.length > 0}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead>Titel</TableHead>
                    <TableHead>Kategorie</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead>Auftrag</TableHead>
                    <TableHead>Kunde</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead className="text-right">Aktion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {docs.map(d => {
                    const o = d.order_id ? orders[d.order_id] : null;
                    const c = d.customer_id ? customers[d.customer_id] : null;
                    return (
                      <TableRow key={d.id} className={selected.has(d.id) ? 'bg-primary/5' : ''}>
                        <TableCell><Checkbox checked={selected.has(d.id)} onCheckedChange={() => toggle(d.id)} /></TableCell>
                        <TableCell>
                          <div className="font-medium">{d.title}</div>
                          <div className="flex items-center gap-1 mt-0.5">
                            {d.original_filename && <span className="text-[11px] text-muted-foreground font-mono">{d.original_filename}</span>}
                            {confBadge(d.confidentiality_level)}
                          </div>
                          {snippets[d.id] && (
                            <div className="text-[11px] text-muted-foreground mt-1 leading-snug italic">
                              {renderSnippet(snippets[d.id])}
                            </div>
                          )}
                        </TableCell>
                        <TableCell><Badge variant="outline">{catMap[d.category_id ?? '']?.name ?? '—'}</Badge></TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1 max-w-[200px]">
                            {(d.tags || []).map(t => (
                              <Badge key={t} variant="outline" className="text-[10px] pr-1 gap-1 group">
                                {t}
                                <button
                                  type="button"
                                  onClick={() => removeTag(d, t)}
                                  className="opacity-60 hover:opacity-100 hover:text-red-400"
                                  title="Tag entfernen"
                                  disabled={tagBusy}
                                >
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              </Badge>
                            ))}
                            {tagEditId === d.id ? (
                              <Input
                                autoFocus
                                value={tagDraft}
                                onChange={e => setTagDraft(e.target.value)}
                                onBlur={() => addTag(d)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') { e.preventDefault(); addTag(d); }
                                  if (e.key === 'Escape') { setTagDraft(''); setTagEditId(null); }
                                }}
                                placeholder="Tag…"
                                className="h-6 w-24 text-[11px] px-1.5"
                                disabled={tagBusy}
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => { setTagEditId(d.id); setTagDraft(''); }}
                                className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-primary border border-dashed border-border rounded px-1.5 py-0.5"
                                title="Tag hinzufügen"
                              >
                                <Plus className="w-2.5 h-2.5" />Tag
                              </button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {o ? (
                            <Link to={`/auftraege/${o.id}`} className="text-primary hover:underline inline-flex items-center gap-1">
                              {o.order_number ?? o.id.slice(0, 8)} <ExternalLink className="w-3 h-3" />
                            </Link>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="text-xs">
                          {c ? `${c.external_customer_id ?? ''} ${c.company_name ?? c.contact_name ?? ''}`.trim() || '—' : '—'}
                        </TableCell>
                        <TableCell>v{d.current_version}</TableCell>
                        <TableCell><Badge variant="outline">{d.status}</Badge></TableCell>
                        <TableCell className="text-xs">{new Date(d.created_at).toLocaleDateString('de-DE')}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {d.mime_type?.includes('pdf') && (
                            <Button size="sm" variant="ghost" asChild title="Vorschau mit Treffermarkierung">
                              <Link to={`/dokumente/vorschau?doc=${d.id}&q=${encodeURIComponent(q)}`}>
                                <Search className="w-4 h-4" />
                              </Link>
                            </Button>
                          )}
                          {d.status === 'entwurf' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                              onClick={() => releaseDoc(d)}
                              title="Intern freigeben"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />Freigeben
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 border-blue-500/40 text-blue-400 hover:bg-blue-500/10"
                            onClick={() => { setAssignDoc(d); setAssignQ(''); setAssignResults([]); }}
                            title="Zu Auftrag zuordnen"
                          >
                            <LinkIcon className="w-3.5 h-3.5 mr-1" />Zu Auftrag
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => openDoc(d)} title="Öffnen"><Eye className="w-4 h-4" /></Button>
                          {canDelete && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-400 hover:text-red-500 hover:bg-red-500/10"
                              onClick={() => deleteDoc(d)}
                              title="Löschen (Admin)"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}



                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Share-Link Dialog */}
      <Dialog open={shareOpen} onOpenChange={(o) => { setShareOpen(o); if (!o) { setShareResult(null); setSharePwd(''); setShareExpiry(''); setShareMax(''); setShareNote(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Link2 className="w-5 h-5" /> Externen Freigabe-Link erstellen</DialogTitle>
          </DialogHeader>
          {!shareResult ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{selected.size} Dokumente werden über den Link zugänglich.</p>
              <div>
                <label className="text-xs font-medium">Passwort (optional)</label>
                <Input type="password" value={sharePwd} onChange={e => setSharePwd(e.target.value)} placeholder="mind. 6 Zeichen empfohlen" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium">Ablaufdatum</label>
                  <Input type="datetime-local" value={shareExpiry} onChange={e => setShareExpiry(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium">Max. Downloads</label>
                  <Input type="number" min={1} value={shareMax} onChange={e => setShareMax(e.target.value)} placeholder="unbegrenzt" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium">Notiz (intern)</label>
                <Input value={shareNote} onChange={e => setShareNote(e.target.value)} placeholder="z.B. an Kunde XYZ" />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-emerald-500 font-medium">✓ Link erstellt</p>
              <div className="flex gap-2">
                <Input readOnly value={shareResult.url} className="font-mono text-xs" />
                <Button size="sm" onClick={() => { navigator.clipboard.writeText(shareResult.url); toast.success('Link kopiert'); }}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Empfänger können die Dateien einzeln oder als ZIP herunterladen.</p>
            </div>
          )}
          <DialogFooter>
            {!shareResult ? (
              <>
                <Button variant="outline" onClick={() => setShareOpen(false)}>Abbrechen</Button>
                <Button onClick={createShare} disabled={bulkBusy}>{bulkBusy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Link erstellen</Button>
              </>
            ) : (
              <Button onClick={() => setShareOpen(false)}>Fertig</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Zu Auftrag zuordnen Dialog */}
      <Dialog open={!!assignDoc} onOpenChange={(o) => { if (!o) { setAssignDoc(null); setAssignQ(''); setAssignResults([]); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><LinkIcon className="w-5 h-5" /> Dokument einem Auftrag zuordnen</DialogTitle>
          </DialogHeader>
          {assignDoc && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                Dokument: <span className="font-medium text-foreground">{assignDoc.title}</span>
              </div>
              <div className="flex gap-2">
                <Input
                  autoFocus
                  placeholder="Auftragsnummer, Kundenname, Kundennr. oder Seriennummer…"
                  value={assignQ}
                  onChange={(e) => setAssignQ(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchOrdersForAssign()}
                />
                <Button onClick={searchOrdersForAssign} disabled={assignBusy}>
                  {assignBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>
              <div className="max-h-96 overflow-y-auto border border-border rounded-md">
                {assignResults.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-8">
                    {assignBusy ? 'Suche…' : 'Suchbegriff eingeben und Enter drücken.'}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Auftrag</TableHead>
                        <TableHead>Kunde</TableHead>
                        <TableHead>Treffer</TableHead>
                        <TableHead className="text-right">Aktion</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assignResults.map(r => (
                        <TableRow key={r.id}>
                          <TableCell className="font-mono text-xs">{r.order_number ?? r.id.slice(0, 8)}</TableCell>
                          <TableCell className="text-xs">
                            {r.customer_number ? <span className="text-muted-foreground mr-1">{r.customer_number}</span> : null}
                            {r.customer_name ?? '—'}
                          </TableCell>
                          <TableCell className="text-[11px] text-muted-foreground">{r.hit ?? ''}</TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" onClick={() => assignOrder(r.id, r.customer_id)}>
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Zuordnen &amp; freigeben
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDoc(null)}>Schließen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

  );
}

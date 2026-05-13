import { useEffect, useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { PageSizeSelector, usePagination, PaginationControls } from '@/components/PageSizeSelector';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, RefreshCw, Search, Package, Eye, Pencil, Save, X, Download, FileSpreadsheet, FolderTree } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type ZohoItem = {
  id: string;
  zoho_item_id: string;
  name: string | null;
  sku: string | null;
  description: string | null;
  unit: string | null;
  rate: number | null;
  purchase_rate: number | null;
  currency_code: string | null;
  status: string | null;
  product_type: string | null;
  item_type: string | null;
  tax_name: string | null;
  tax_percentage: number | null;
  stock_on_hand: number | null;
  available_stock: number | null;
  category_name: string | null;
  brand: string | null;
  manufacturer: string | null;
  raw_data: any;
  synced_at: string;
};

const fmtMoney = (n: number | null, cur: string | null) =>
  n == null ? '–' : new Intl.NumberFormat('de-DE', { style: 'currency', currency: cur || 'EUR' }).format(n);

export default function Artikel() {
  const { toast } = useToast();
  const [items, setItems] = useState<ZohoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('__all__');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<ZohoItem | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<ZohoItem>>({});
  const [saving, setSaving] = useState(false);

  // Bulk category assignment
  type Cat = { id: string; name: string; color: string | null };
  const [allCats, setAllCats] = useState<Cat[]>([]);
  const [assignments, setAssignments] = useState<{ item_id: string; category_id: string }[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkAdd, setBulkAdd] = useState<Set<string>>(new Set());
  const [bulkRemove, setBulkRemove] = useState<Set<string>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);

  async function loadCategoryData() {
    const [c, a] = await Promise.all([
      supabase.from('product_categories').select('id,name,color').order('name'),
      supabase.from('item_category_assignments').select('item_id,category_id'),
    ]);
    setAllCats((c.data as Cat[]) ?? []);
    setAssignments((a.data as { item_id: string; category_id: string }[]) ?? []);
  }

  function openBulkDialog() {
    if (selectedIds.size === 0) {
      toast({ title: 'Keine Auswahl', description: 'Bitte mindestens einen Artikel markieren.', variant: 'destructive' });
      return;
    }
    setBulkAdd(new Set());
    setBulkRemove(new Set());
    setBulkOpen(true);
  }

  async function applyBulk() {
    const itemIds = Array.from(selectedIds);
    if (itemIds.length === 0) return;
    if (bulkAdd.size === 0 && bulkRemove.size === 0) { setBulkOpen(false); return; }
    setBulkSaving(true);
    try {
      for (const catId of bulkRemove) {
        const { error } = await supabase
          .from('item_category_assignments')
          .delete()
          .eq('category_id', catId)
          .in('item_id', itemIds);
        if (error) throw error;
      }
      const existing = new Set(assignments.map(a => `${a.item_id}|${a.category_id}`));
      const rows: { item_id: string; category_id: string }[] = [];
      for (const catId of bulkAdd) {
        for (const itemId of itemIds) {
          if (!existing.has(`${itemId}|${catId}`)) rows.push({ item_id: itemId, category_id: catId });
        }
      }
      if (rows.length > 0) {
        const { error } = await supabase.from('item_category_assignments').insert(rows);
        if (error) throw error;
      }
      toast({ title: 'Kategorien aktualisiert', description: `${itemIds.length} Artikel angepasst.` });
      setBulkOpen(false);
      await loadCategoryData();
    } catch (e: any) {
      toast({ title: 'Fehler', description: e?.message ?? String(e), variant: 'destructive' });
    } finally {
      setBulkSaving(false);
    }
  }

  function startEdit() {
    if (!selected) return;
    setDraft({
      name: selected.name,
      sku: selected.sku,
      description: selected.description,
      unit: selected.unit,
      rate: selected.rate,
      purchase_rate: selected.purchase_rate,
      status: selected.status,
      category_name: selected.category_name,
      brand: selected.brand,
      manufacturer: selected.manufacturer,
      tax_name: selected.tax_name,
      tax_percentage: selected.tax_percentage,
      stock_on_hand: selected.stock_on_hand,
      available_stock: selected.available_stock,
      product_type: selected.product_type,
      item_type: selected.item_type,
    });
    setEditing(true);
  }

  async function saveEdit() {
    if (!selected) return;
    setSaving(true);
    const payload = { ...draft, updated_at: new Date().toISOString() };
    const { data, error } = await supabase
      .from('zoho_items')
      .update(payload)
      .eq('id', selected.id)
      .select()
      .single();
    setSaving(false);
    if (error) {
      toast({ title: 'Speichern fehlgeschlagen', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Gespeichert', description: 'Artikel aktualisiert.' });
    const updated = data as ZohoItem;
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    setSelected(updated);
    setEditing(false);
  }

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('zoho_items')
      .select('*')
      .order('name', { ascending: true })
      .limit(2000);
    if (error) toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    setItems((data as ZohoItem[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); loadCategoryData(); }, []);

  async function syncAll() {
    setSyncing(true);
    let totalImported = 0, totalUpdated = 0, totalFailed = 0;
    let page = 1, hasMore = true, guard = 0;
    try {
      while (hasMore && guard < 30) {
        const { data, error } = await supabase.functions.invoke('sync-zoho-items', {
          body: { source_system: 'zoho_eu_1', page, per_page: 200, max_pages: 5 },
        });
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);
        totalImported += (data as any).imported ?? 0;
        totalUpdated += (data as any).updated ?? 0;
        totalFailed += (data as any).failed ?? 0;
        hasMore = !!(data as any).has_more;
        page = ((data as any).last_page ?? page) + 1;
        guard++;
      }
      toast({
        title: 'Sync abgeschlossen',
        description: `Neu: ${totalImported} · Aktualisiert: ${totalUpdated}${totalFailed ? ` · Fehler: ${totalFailed}` : ''}`,
      });
      await load();
    } catch (e: any) {
      toast({ title: 'Sync fehlgeschlagen', description: e?.message ?? String(e), variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  }

  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => { if (i.category_name) set.add(i.category_name); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'de'));
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return items.filter((i) => {
      if (categoryFilter !== '__all__' && (i.category_name ?? '') !== categoryFilter) return false;
      if (!q) return true;
      return `${i.name ?? ''} ${i.sku ?? ''} ${i.description ?? ''} ${i.category_name ?? ''} ${i.brand ?? ''}`
        .toLowerCase().includes(q);
    });
  }, [items, query, categoryFilter]);

  const { pageSize, setPageSize, page, setPage, totalPages, paged, total } = usePagination(filtered, 20);

  const toggleId = (id: string) => setSelectedIds((s) => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const togglePageAll = () => {
    const all = paged.length > 0 && paged.every((i) => selectedIds.has(i.id));
    setSelectedIds((s) => {
      const n = new Set(s);
      paged.forEach((i) => (all ? n.delete(i.id) : n.add(i.id)));
      return n;
    });
  };
  const selectAllFiltered = () => setSelectedIds(new Set(filtered.map((i) => i.id)));
  const clearSelection = () => setSelectedIds(new Set());

  const exportItems = () => items.filter((i) => selectedIds.has(i.id));
  const exportRows = (list: ZohoItem[]) => list.map((it) => [
    it.name ?? '', it.sku ?? '', it.category_name ?? '', it.brand ?? '',
    it.unit ?? '', fmtMoney(it.rate, it.currency_code), fmtMoney(it.purchase_rate, it.currency_code),
    it.stock_on_hand?.toString() ?? '', it.status ?? '',
  ]);
  const exportHeader = ['Name', 'SKU', 'Kategorie', 'Marke', 'Einheit', 'Verkaufspreis', 'Einkaufspreis', 'Bestand', 'Status'];

  function downloadCsv() {
    const list = exportItems();
    if (list.length === 0) {
      toast({ title: 'Keine Auswahl', description: 'Bitte mindestens einen Artikel auswählen.', variant: 'destructive' });
      return;
    }
    const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
    const lines = [exportHeader.map(esc).join(';'), ...exportRows(list).map((r) => r.map(esc).join(';'))];
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `artikel_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadPdf() {
    const list = exportItems();
    if (list.length === 0) {
      toast({ title: 'Keine Auswahl', description: 'Bitte mindestens einen Artikel auswählen.', variant: 'destructive' });
      return;
    }
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    doc.setFontSize(16);
    doc.text('Artikel-Export', 40, 40);
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(`Erstellt: ${new Date().toLocaleString('de-DE')} · ${list.length} Artikel${categoryFilter !== '__all__' ? ` · Kategorie: ${categoryFilter}` : ''}`, 40, 56);
    autoTable(doc, {
      startY: 72,
      head: [exportHeader],
      body: exportRows(list),
      styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
      headStyles: { fillColor: [212, 175, 55], textColor: 20, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 246, 240] },
      margin: { left: 40, right: 40 },
    });
    doc.save(`artikel_export_${new Date().toISOString().slice(0, 10)}.pdf`);
  }


  const lastSync = items.length > 0
    ? new Date(items.reduce((m, i) => (i.synced_at > m ? i.synced_at : m), items[0].synced_at)).toLocaleString('de-DE')
    : null;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold gold-text flex items-center gap-2">
            <Package className="w-6 h-6" /> Artikel
          </h1>
          <p className="text-sm text-muted-foreground">
            Artikel-Stammdaten aus Zoho Books{lastSync ? ` · zuletzt synchronisiert: ${lastSync}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={downloadCsv} disabled={selectedIds.size === 0}>
            <FileSpreadsheet className="w-4 h-4 mr-2" /> CSV ({selectedIds.size})
          </Button>
          <Button variant="outline" onClick={downloadPdf} disabled={selectedIds.size === 0}>
            <Download className="w-4 h-4 mr-2" /> PDF ({selectedIds.size})
          </Button>
          <Button variant="outline" onClick={openBulkDialog} disabled={selectedIds.size === 0}>
            <FolderTree className="w-4 h-4 mr-2" /> Kategorien ({selectedIds.size})
          </Button>
          <Button onClick={syncAll} disabled={syncing} className="gold-gradient text-primary-foreground">
            {syncing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Aus Zoho synchronisieren
          </Button>
        </div>
      </div>

      <Card className="p-3">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Suche nach Name, SKU, Beschreibung, Kategorie, Marke..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue placeholder="Kategorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Alle Kategorien</SelectItem>
              {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex gap-2 flex-wrap items-center">
            <Button variant="outline" size="sm" onClick={selectAllFiltered}>Alle (gefiltert)</Button>
            <Button variant="ghost" size="sm" onClick={clearSelection} disabled={selectedIds.size === 0}>Auswahl leeren</Button>
            <Badge variant="secondary">{selectedIds.size} markiert</Badge>
          </div>
          <PageSizeSelector value={pageSize} onChange={setPageSize} />
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-12 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            {items.length === 0
              ? 'Noch keine Artikel synchronisiert. Klicke oben auf "Aus Zoho synchronisieren".'
              : 'Keine Treffer.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 w-10">
                    <Checkbox
                      checked={paged.length > 0 && paged.every((i) => selectedIds.has(i.id))}
                      onCheckedChange={togglePageAll}
                      aria-label="Seite auswählen"
                    />
                  </th>
                  <th className="text-left px-3 py-2">Name</th>
                  <th className="text-left px-3 py-2">SKU</th>
                  <th className="text-left px-3 py-2">Kategorie</th>
                  <th className="text-right px-3 py-2">Preis</th>
                  <th className="text-right px-3 py-2">Bestand</th>
                  <th className="text-left px-3 py-2">Einheit</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {paged.map((it) => {
                  const checked = selectedIds.has(it.id);
                  return (
                  <tr key={it.id} className={`border-t border-border ${checked ? 'bg-primary/5' : 'hover:bg-muted/20'}`}>
                    <td className="px-3 py-2">
                      <Checkbox checked={checked} onCheckedChange={() => toggleId(it.id)} aria-label="Artikel markieren" />
                    </td>
                    <td className="px-3 py-2 font-medium">{it.name ?? '–'}</td>
                    <td className="px-3 py-2 font-mono text-xs">{it.sku ?? '–'}</td>
                    <td className="px-3 py-2">{it.category_name ?? '–'}</td>
                    <td className="px-3 py-2 text-right">{fmtMoney(it.rate, it.currency_code)}</td>
                    <td className="px-3 py-2 text-right">{it.stock_on_hand ?? '–'}</td>
                    <td className="px-3 py-2">{it.unit ?? '–'}</td>
                    <td className="px-3 py-2">
                      <Badge variant={it.status === 'active' ? 'default' : 'secondary'}>
                        {it.status ?? '–'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelected(it)} title="Details ansehen">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Bearbeiten"
                        onClick={() => {
                          setSelected(it);
                          setDraft({
                            name: it.name, sku: it.sku, description: it.description, unit: it.unit,
                            rate: it.rate, purchase_rate: it.purchase_rate, status: it.status,
                            category_name: it.category_name, brand: it.brand, manufacturer: it.manufacturer,
                            tax_name: it.tax_name, tax_percentage: it.tax_percentage,
                            stock_on_hand: it.stock_on_hand, available_stock: it.available_stock,
                            product_type: it.product_type, item_type: it.item_type,
                          });
                          setEditing(true);
                        }}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="p-3 text-xs text-muted-foreground border-t border-border">
          {filtered.length} von {items.length} Artikel
        </div>
      </Card>
      <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} total={total} />

      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) { setSelected(null); setEditing(false); } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2 pr-8">
              <DialogTitle className="gold-text">
                {editing ? (draft.name ?? '') : selected?.name}
              </DialogTitle>
              {selected && !editing && (
                <Button variant="outline" size="sm" onClick={startEdit}>
                  <Pencil className="w-4 h-4 mr-2" /> Bearbeiten
                </Button>
              )}
              {selected && editing && (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={saving}>
                    <X className="w-4 h-4 mr-2" /> Abbrechen
                  </Button>
                  <Button size="sm" onClick={saveEdit} disabled={saving} className="gold-gradient text-primary-foreground">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Speichern
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>
          {selected && !editing && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <Field label="SKU" value={selected.sku} />
                <Field label="Status" value={selected.status} />
                <Field label="Kategorie" value={selected.category_name} />
                <Field label="Marke" value={selected.brand} />
                <Field label="Hersteller" value={selected.manufacturer} />
                <Field label="Einheit" value={selected.unit} />
                <Field label="Verkaufspreis" value={fmtMoney(selected.rate, selected.currency_code)} />
                <Field label="Einkaufspreis" value={fmtMoney(selected.purchase_rate, selected.currency_code)} />
                <Field label="Steuer" value={selected.tax_name ? `${selected.tax_name} (${selected.tax_percentage}%)` : null} />
                <Field label="Produkttyp" value={selected.product_type} />
                <Field label="Item-Typ" value={selected.item_type} />
                <Field label="Bestand" value={selected.stock_on_hand?.toString()} />
                <Field label="Verfügbar" value={selected.available_stock?.toString()} />
                <Field label="Zoho ID" value={selected.zoho_item_id} />
              </div>
              {selected.description && (
                <div>
                  <div className="text-xs uppercase text-muted-foreground mb-1">Beschreibung</div>
                  <div className="whitespace-pre-wrap">{selected.description}</div>
                </div>
              )}
              <div>
                <div className="text-xs uppercase text-muted-foreground mb-1">Komplette Zoho-Daten</div>
                <pre className="bg-muted/40 rounded p-3 text-xs overflow-x-auto max-h-80">
                  {JSON.stringify(selected.raw_data, null, 2)}
                </pre>
              </div>
            </div>
          )}
          {selected && editing && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <EditField label="Name" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} />
                <EditField label="SKU" value={draft.sku} onChange={(v) => setDraft({ ...draft, sku: v })} />
                <EditField label="Status" value={draft.status} onChange={(v) => setDraft({ ...draft, status: v })} />
                <EditField label="Kategorie" value={draft.category_name} onChange={(v) => setDraft({ ...draft, category_name: v })} />
                <EditField label="Marke" value={draft.brand} onChange={(v) => setDraft({ ...draft, brand: v })} />
                <EditField label="Hersteller" value={draft.manufacturer} onChange={(v) => setDraft({ ...draft, manufacturer: v })} />
                <EditField label="Einheit" value={draft.unit} onChange={(v) => setDraft({ ...draft, unit: v })} />
                <EditField label="Verkaufspreis" type="number" value={draft.rate?.toString() ?? ''} onChange={(v) => setDraft({ ...draft, rate: v === '' ? null : Number(v) })} />
                <EditField label="Einkaufspreis" type="number" value={draft.purchase_rate?.toString() ?? ''} onChange={(v) => setDraft({ ...draft, purchase_rate: v === '' ? null : Number(v) })} />
                <EditField label="Steuer-Name" value={draft.tax_name} onChange={(v) => setDraft({ ...draft, tax_name: v })} />
                <EditField label="Steuer-%" type="number" value={draft.tax_percentage?.toString() ?? ''} onChange={(v) => setDraft({ ...draft, tax_percentage: v === '' ? null : Number(v) })} />
                <EditField label="Produkttyp" value={draft.product_type} onChange={(v) => setDraft({ ...draft, product_type: v })} />
                <EditField label="Item-Typ" value={draft.item_type} onChange={(v) => setDraft({ ...draft, item_type: v })} />
                <EditField label="Bestand" type="number" value={draft.stock_on_hand?.toString() ?? ''} onChange={(v) => setDraft({ ...draft, stock_on_hand: v === '' ? null : Number(v) })} />
                <EditField label="Verfügbar" type="number" value={draft.available_stock?.toString() ?? ''} onChange={(v) => setDraft({ ...draft, available_stock: v === '' ? null : Number(v) })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs uppercase text-muted-foreground">Beschreibung</Label>
                <Textarea
                  value={draft.description ?? ''}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  rows={4}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Hinweis: Änderungen werden lokal gespeichert und beim nächsten Zoho-Sync ggf. überschrieben.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk category assignment */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="gold-text flex items-center gap-2">
              <FolderTree className="w-5 h-5" /> Kategorien zuweisen
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Änderungen werden auf <strong>{selectedIds.size}</strong> markierte Artikel angewendet.
              Hinzufügen = grün, Entfernen = rot. Nicht angetastete Kategorien bleiben unverändert.
            </p>
            {allCats.length === 0 ? (
              <div className="text-center text-muted-foreground py-6">
                Keine Kategorien vorhanden. Bitte zuerst unter „Kategorie" anlegen.
              </div>
            ) : (
              <div className="border border-border rounded-md max-h-[420px] overflow-auto divide-y divide-border">
                {allCats.map(c => {
                  const count = Array.from(selectedIds).filter(id =>
                    assignments.some(a => a.item_id === id && a.category_id === c.id),
                  ).length;
                  const allHave = count === selectedIds.size;
                  const noneHave = count === 0;
                  const adding = bulkAdd.has(c.id);
                  const removing = bulkRemove.has(c.id);
                  return (
                    <div
                      key={c.id}
                      className={`flex items-center gap-3 px-3 py-2 ${
                        adding ? 'bg-green-500/10' : removing ? 'bg-destructive/10' : ''
                      }`}
                    >
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: c.color ?? '#D4AF37' }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{c.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {allHave ? 'Allen zugewiesen' : noneHave ? 'Keinem zugewiesen' : `${count}/${selectedIds.size} zugewiesen`}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={adding ? 'default' : 'outline'}
                        className="h-7 px-2"
                        onClick={() => {
                          setBulkAdd(s => { const n = new Set(s); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n; });
                          setBulkRemove(s => { const n = new Set(s); n.delete(c.id); return n; });
                        }}
                      >
                        + Zuweisen
                      </Button>
                      <Button
                        size="sm"
                        variant={removing ? 'destructive' : 'outline'}
                        className="h-7 px-2"
                        onClick={() => {
                          setBulkRemove(s => { const n = new Set(s); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n; });
                          setBulkAdd(s => { const n = new Set(s); n.delete(c.id); return n; });
                        }}
                      >
                        − Entfernen
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="ghost" onClick={() => setBulkOpen(false)} disabled={bulkSaving}>Abbrechen</Button>
            <Button
              onClick={applyBulk}
              disabled={bulkSaving || (bulkAdd.size === 0 && bulkRemove.size === 0)}
              className="gold-gradient text-primary-foreground"
            >
              {bulkSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Übernehmen
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditField({
  label, value, onChange, type = 'text',
}: { label: string; value: string | null | undefined; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs uppercase text-muted-foreground">{label}</Label>
      <Input type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="font-medium">{value ?? '–'}</div>
    </div>
  );
}

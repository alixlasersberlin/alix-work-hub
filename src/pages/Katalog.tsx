import { useEffect, useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { PageSizeSelector, usePagination, PaginationControls } from '@/components/PageSizeSelector';
import { Loader2, Search, BookOpen, Download, FileSpreadsheet } from 'lucide-react';

type ZohoItem = {
  id: string;
  name: string | null;
  sku: string | null;
  description: string | null;
  unit: string | null;
  rate: number | null;
  purchase_rate: number | null;
  currency_code: string | null;
  status: string | null;
  category_name: string | null;
  brand: string | null;
  manufacturer: string | null;
  tax_name: string | null;
  tax_percentage: number | null;
  stock_on_hand: number | null;
  available_stock: number | null;
};

type FieldKey =
  | 'name' | 'sku' | 'description' | 'unit' | 'rate' | 'purchase_rate'
  | 'category_name' | 'brand' | 'manufacturer' | 'tax_percentage'
  | 'stock_on_hand' | 'available_stock' | 'status';

const FIELDS: { key: FieldKey; label: string; align?: 'right' }[] = [
  { key: 'name', label: 'Name' },
  { key: 'sku', label: 'SKU' },
  { key: 'description', label: 'Beschreibung' },
  { key: 'category_name', label: 'Kategorie' },
  { key: 'brand', label: 'Marke' },
  { key: 'manufacturer', label: 'Hersteller' },
  { key: 'unit', label: 'Einheit' },
  { key: 'rate', label: 'Verkaufspreis', align: 'right' },
  { key: 'purchase_rate', label: 'Einkaufspreis', align: 'right' },
  { key: 'tax_percentage', label: 'Steuer %', align: 'right' },
  { key: 'stock_on_hand', label: 'Bestand', align: 'right' },
  { key: 'available_stock', label: 'Verfügbar', align: 'right' },
  { key: 'status', label: 'Status' },
];

const DEFAULT_FIELDS: FieldKey[] = ['name', 'sku', 'rate'];

const fmtMoney = (n: number | null | undefined, cur: string | null | undefined) =>
  n == null ? '' : new Intl.NumberFormat('de-DE', { style: 'currency', currency: cur || 'EUR' }).format(n);

function cellValue(it: ZohoItem, key: FieldKey): string {
  const v = (it as any)[key];
  if (v == null || v === '') return '';
  if (key === 'rate' || key === 'purchase_rate') return fmtMoney(v as number, it.currency_code);
  if (key === 'tax_percentage') return `${v}%`;
  return String(v);
}

export default function Katalog() {
  const { toast } = useToast();
  const [items, setItems] = useState<ZohoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [fields, setFields] = useState<Set<FieldKey>>(new Set(DEFAULT_FIELDS));
  const [title, setTitle] = useState('Produktkatalog');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('zoho_items')
        .select('id,name,sku,description,unit,rate,purchase_rate,currency_code,status,category_name,brand,manufacturer,tax_name,tax_percentage,stock_on_hand,available_stock')
        .order('name', { ascending: true })
        .limit(2000);
      if (error) toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      setItems((data as ZohoItem[]) ?? []);
      setLoading(false);
    })();
  }, [toast]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return items;
    return items.filter((i) =>
      `${i.name ?? ''} ${i.sku ?? ''} ${i.category_name ?? ''} ${i.brand ?? ''}`.toLowerCase().includes(q),
    );
  }, [items, query]);

  const { pageSize, setPageSize, page, setPage, totalPages, paged, total } = usePagination(filtered, 25);

  const toggleId = (id: string) =>
    setSelectedIds((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const togglePageAll = () => {
    const all = paged.every((i) => selectedIds.has(i.id));
    setSelectedIds((s) => {
      const n = new Set(s);
      paged.forEach((i) => (all ? n.delete(i.id) : n.add(i.id)));
      return n;
    });
  };
  const selectAllFiltered = () => setSelectedIds(new Set(filtered.map((i) => i.id)));
  const clearSelection = () => setSelectedIds(new Set());

  const toggleField = (k: FieldKey) =>
    setFields((s) => {
      const n = new Set(s);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });

  const selectedItems = items.filter((i) => selectedIds.has(i.id));
  const activeFields = FIELDS.filter((f) => fields.has(f.key));

  function downloadPdf() {
    if (selectedItems.length === 0 || activeFields.length === 0) {
      toast({ title: 'Keine Auswahl', description: 'Bitte Artikel und Spalten auswählen.', variant: 'destructive' });
      return;
    }
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    doc.setFontSize(16);
    doc.text(title || 'Produktkatalog', 40, 40);
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(`Erstellt: ${new Date().toLocaleString('de-DE')} · ${selectedItems.length} Artikel`, 40, 56);

    autoTable(doc, {
      startY: 72,
      head: [activeFields.map((f) => f.label)],
      body: selectedItems.map((it) => activeFields.map((f) => cellValue(it, f.key))),
      styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
      headStyles: { fillColor: [212, 175, 55], textColor: 20, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 246, 240] },
      columnStyles: Object.fromEntries(
        activeFields.map((f, i) => [i, { halign: f.align === 'right' ? 'right' : 'left' }]),
      ),
      margin: { left: 40, right: 40 },
    });

    doc.save(`${(title || 'katalog').replace(/[^\w\-]+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  function downloadCsv() {
    if (selectedItems.length === 0 || activeFields.length === 0) {
      toast({ title: 'Keine Auswahl', description: 'Bitte Artikel und Spalten auswählen.', variant: 'destructive' });
      return;
    }
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const lines = [
      activeFields.map((f) => esc(f.label)).join(';'),
      ...selectedItems.map((it) => activeFields.map((f) => esc(cellValue(it, f.key))).join(';')),
    ];
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(title || 'katalog').replace(/[^\w\-]+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold gold-text flex items-center gap-2">
            <BookOpen className="w-6 h-6" /> Katalog
          </h1>
          <p className="text-sm text-muted-foreground">
            Artikel auswählen, Felder festlegen und als Katalog herunterladen.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadCsv} disabled={selectedItems.length === 0}>
            <FileSpreadsheet className="w-4 h-4 mr-2" /> CSV
          </Button>
          <Button onClick={downloadPdf} disabled={selectedItems.length === 0} className="gold-gradient text-primary-foreground">
            <Download className="w-4 h-4 mr-2" /> Katalog (PDF)
          </Button>
        </div>
      </div>

      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1 space-y-1">
            <Label className="text-xs uppercase text-muted-foreground">Katalog-Titel</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Produktkatalog" />
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label className="text-xs uppercase text-muted-foreground">Spalten / Parameter</Label>
            <div className="flex flex-wrap gap-2">
              {FIELDS.map((f) => {
                const active = fields.has(f.key);
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => toggleField(f.key)}
                    className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                      active
                        ? 'bg-primary/15 border-primary text-primary'
                        : 'bg-muted/30 border-border text-muted-foreground hover:bg-muted/60'
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-3">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Suche nach Name, SKU, Kategorie, Marke..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={selectAllFiltered}>Alle (gefiltert) wählen</Button>
            <Button variant="ghost" size="sm" onClick={clearSelection} disabled={selectedIds.size === 0}>Auswahl leeren</Button>
            <Badge variant="secondary" className="self-center">{selectedIds.size} ausgewählt</Badge>
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
          <div className="p-12 text-center text-muted-foreground">Keine Artikel gefunden.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 w-10">
                    <Checkbox
                      checked={paged.length > 0 && paged.every((i) => selectedIds.has(i.id))}
                      onCheckedChange={togglePageAll}
                    />
                  </th>
                  <th className="text-left px-3 py-2">Name</th>
                  <th className="text-left px-3 py-2">SKU</th>
                  <th className="text-left px-3 py-2">Kategorie</th>
                  <th className="text-right px-3 py-2">Preis</th>
                  <th className="text-left px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((it) => {
                  const checked = selectedIds.has(it.id);
                  return (
                    <tr
                      key={it.id}
                      className={`border-t border-border cursor-pointer ${checked ? 'bg-primary/5' : 'hover:bg-muted/20'}`}
                      onClick={() => toggleId(it.id)}
                    >
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={checked} onCheckedChange={() => toggleId(it.id)} />
                      </td>
                      <td className="px-3 py-2 font-medium">{it.name ?? '–'}</td>
                      <td className="px-3 py-2 font-mono text-xs">{it.sku ?? '–'}</td>
                      <td className="px-3 py-2">{it.category_name ?? '–'}</td>
                      <td className="px-3 py-2 text-right">{fmtMoney(it.rate, it.currency_code) || '–'}</td>
                      <td className="px-3 py-2">
                        <Badge variant={it.status === 'active' ? 'default' : 'secondary'}>{it.status ?? '–'}</Badge>
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
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { PageSizeSelector, usePagination, PaginationControls } from '@/components/PageSizeSelector';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, RefreshCw, Search, Package, Eye, Pencil, Save, X } from 'lucide-react';
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
  const [selected, setSelected] = useState<ZohoItem | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<ZohoItem>>({});
  const [saving, setSaving] = useState(false);

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

  useEffect(() => { load(); }, []);

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

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return items;
    return items.filter((i) =>
      `${i.name ?? ''} ${i.sku ?? ''} ${i.description ?? ''} ${i.category_name ?? ''} ${i.brand ?? ''}`
        .toLowerCase().includes(q)
    );
  }, [items, query]);

  const { pageSize, setPageSize, page, setPage, totalPages, paged, total } = usePagination(filtered, 20);

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
        <Button onClick={syncAll} disabled={syncing} className="gold-gradient text-primary-foreground">
          {syncing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Aus Zoho synchronisieren
        </Button>
      </div>

      <Card className="p-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Suche nach Name, SKU, Beschreibung, Kategorie, Marke..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
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
                {filtered.map((it) => (
                  <tr key={it.id} className="border-t border-border hover:bg-muted/20">
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
                    <td className="px-3 py-2 text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelected(it)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="p-3 text-xs text-muted-foreground border-t border-border">
          {filtered.length} von {items.length} Artikel
        </div>
      </Card>

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

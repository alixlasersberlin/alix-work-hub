import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import { TrendingUp, History, Search } from 'lucide-react';

interface Item { id: string; sku: string; name: string; }
interface Country { id: string; iso_code: string; name: string; }
interface HistoryRow {
  id: string;
  performed_at: string;
  action: string;
  old_value: any;
  new_value: any;
}

const FIELDS = ['uvp_net','uvp_gross','standard_net','standard_gross','promo_net','promo_gross','tax_rate'] as const;
type Field = typeof FIELDS[number];

const FIELD_LABEL: Record<Field, string> = {
  uvp_net: 'UVP netto', uvp_gross: 'UVP brutto',
  standard_net: 'Standard netto', standard_gross: 'Standard brutto',
  promo_net: 'Promo netto', promo_gross: 'Promo brutto',
  tax_rate: 'MwSt.-Satz',
};

export default function KatalogPreishistorie() {
  const c = supabase as any;
  const [items, setItems] = useState<Item[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [itemId, setItemId] = useState('');
  const [countryId, setCountryId] = useState<string>('all');
  const [field, setField] = useState<Field>('standard_gross');
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: its }, { data: cs }] = await Promise.all([
        c.from('catalog_items').select('id, sku, name').order('name').limit(2000),
        c.from('catalog_countries').select('id, iso_code, name').order('iso_code'),
      ]);
      setItems(its ?? []);
      setCountries(cs ?? []);
      if ((its ?? []).length && !itemId) setItemId(its[0].id);
    })();
  }, [c]);

  useEffect(() => {
    if (!itemId) return;
    (async () => {
      setLoading(true);
      // fetch all price ids for the item (optionally filtered by country)
      let pq = c.from('catalog_item_prices').select('id, country_id').eq('item_id', itemId);
      if (countryId !== 'all') pq = pq.eq('country_id', countryId);
      const { data: prices } = await pq;
      const ids = (prices ?? []).map((p: any) => p.id);
      if (ids.length === 0) { setRows([]); setLoading(false); return; }
      const { data: logs } = await c
        .from('catalog_change_log')
        .select('id, performed_at, action, old_value, new_value')
        .eq('entity_type', 'price')
        .in('entity_id', ids)
        .order('performed_at', { ascending: true });
      setRows((logs ?? []) as HistoryRow[]);
      setLoading(false);
    })();
  }, [itemId, countryId, c]);

  const filteredItems = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return items.slice(0, 200);
    return items.filter(i => i.name.toLowerCase().includes(n) || i.sku.toLowerCase().includes(n)).slice(0, 200);
  }, [items, q]);

  const chartData = useMemo(() => {
    return rows.map(r => ({
      date: new Date(r.performed_at).toLocaleDateString('de-DE'),
      ts: r.performed_at,
      value: Number(r.new_value?.[field] ?? 0),
    })).filter(d => !Number.isNaN(d.value));
  }, [rows, field]);

  const diffRows = useMemo(() => {
    return rows.slice().reverse().map(r => {
      const diffs: { field: string; old: any; neu: any }[] = [];
      for (const f of FIELDS) {
        const o = r.old_value?.[f];
        const n = r.new_value?.[f];
        if (o !== n && !(o == null && n == null)) diffs.push({ field: FIELD_LABEL[f], old: o, neu: n });
      }
      return { ...r, diffs };
    });
  }, [rows]);

  const currentItem = items.find(i => i.id === itemId);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <History className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-semibold">Preishistorie & Vergleich</h2>
        <Badge variant="outline" className="ml-2 text-xs">{rows.length} Einträge</Badge>
      </div>

      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <Label>Artikel</Label>
            <div className="relative mb-2">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} placeholder="SKU oder Name…" />
            </div>
            <Select value={itemId} onValueChange={setItemId}>
              <SelectTrigger><SelectValue placeholder="Artikel wählen" /></SelectTrigger>
              <SelectContent>
                {filteredItems.map(i => (
                  <SelectItem key={i.id} value={i.id}>
                    <span className="font-mono text-xs mr-2">{i.sku}</span>{i.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Land</Label>
            <Select value={countryId} onValueChange={setCountryId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Länder</SelectItem>
                {countries.map(c => <SelectItem key={c.id} value={c.id}>{c.iso_code} · {c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Preisfeld</Label>
            <Select value={field} onValueChange={(v) => setField(v as Field)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FIELDS.map(f => <SelectItem key={f} value={f}>{FIELD_LABEL[f]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Verlauf: {FIELD_LABEL[field]} {currentItem ? `— ${currentItem.name}` : ''}
          </CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              {loading ? 'Lade…' : 'Keine Historie für diese Auswahl.'}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="value" name={FIELD_LABEL[field]} stroke="hsl(var(--primary))" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Änderungen (neueste zuerst)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">Zeitpunkt</TableHead>
                <TableHead className="w-24">Aktion</TableHead>
                <TableHead>Felder / Diff</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {diffRows.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs whitespace-nowrap">{new Date(r.performed_at).toLocaleString('de-DE')}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px] uppercase">{r.action}</Badge></TableCell>
                  <TableCell>
                    {r.diffs.length === 0 ? (
                      <span className="text-xs text-muted-foreground">Basis-Snapshot</span>
                    ) : (
                      <div className="space-y-1">
                        {r.diffs.map((d, i) => (
                          <div key={i} className="text-xs flex items-center gap-2">
                            <span className="font-medium min-w-32">{d.field}:</span>
                            <span className="line-through text-muted-foreground">{d.old ?? '—'}</span>
                            <span className="text-primary">→ {d.neu ?? '—'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {diffRows.length === 0 && (
                <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">Keine Einträge.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

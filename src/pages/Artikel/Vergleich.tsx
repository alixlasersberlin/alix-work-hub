import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Columns3, Download, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { pmStatusLabel, pmComplianceLabel } from '@/lib/produktmaster/config';

const db = supabase as any;
const SLOTS = ['A', 'B', 'C'] as const;

const fmtMoney = (v: any) =>
  v === null || v === undefined || v === '' ? '' : `${Number(v).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

export default function ArtikelVergleich() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<any[]>([]);
  const [prices, setPrices] = useState<any[]>([]);
  const [comp, setComp] = useState<any[]>([]);
  const [attrs, setAttrs] = useState<any[]>([]);
  const [values, setValues] = useState<any[]>([]);
  const [picked, setPicked] = useState<Record<string, string>>({ A: '', B: '', C: '' });
  const [onlyDiff, setOnlyDiff] = useState(false);

  useEffect(() => {
    (async () => {
      const [p, pr, c, a, v] = await Promise.all([
        db.from('ph_products').select('*').order('name'),
        db.from('ph_prices').select('*').is('variant_id', null),
        db.from('ph_compliance').select('*'),
        db.from('ph_attributes').select('*').eq('active', true).eq('is_comparable', true).order('group_name').order('sort_order'),
        db.from('ph_attribute_values').select('*').is('variant_id', null),
      ]);
      setProducts(p.data || []); setPrices(pr.data || []); setComp(c.data || []);
      setAttrs(a.data || []); setValues(v.data || []);
      setLoading(false);
    })();
  }, []);

  const cols = useMemo(() => SLOTS.map(s => products.find(p => p.id === picked[s]) || null), [picked, products]);
  const active = cols.filter(Boolean) as any[];

  const attrValue = (productId: string, attributeId: string) => {
    const row = values.find(v => v.product_id === productId && v.attribute_id === attributeId);
    if (!row) return '';
    if (Array.isArray(row.value_list) && row.value_list.length) return row.value_list.join(', ');
    const raw = row.value_text ?? row.value_number;
    if (raw === null || raw === undefined || raw === '') return '';
    return String(raw);
  };

  const rows = useMemo(() => {
    if (!active.length) return [] as { group: string; label: string; cells: string[] }[];
    const price = (id: string) => prices.find(x => x.product_id === id);
    const cmp = (id: string) => comp.find(x => x.product_id === id);
    const out: { group: string; label: string; cells: string[] }[] = [];
    const push = (group: string, label: string, fn: (p: any) => any) =>
      out.push({ group, label, cells: cols.map(p => (p ? String(fn(p) ?? '') : '')) });

    push('Stammdaten', 'Artikelnummer', p => p.sku);
    push('Stammdaten', 'Modell', p => p.model);
    push('Stammdaten', 'Marke', p => p.brand);
    push('Stammdaten', 'Hersteller', p => p.manufacturer);
    push('Stammdaten', 'Kategorien', p => (p.categories || []).join(', '));
    push('Stammdaten', 'Anwendungen', p => (p.applications || []).join(', '));
    push('Stammdaten', 'Status', p => pmStatusLabel(p.status));

    push('Technik', 'Wellenlängen', p => p.wavelengths);
    push('Technik', 'Leistung', p => p.power);
    push('Technik', 'Fluence', p => p.fluence);
    push('Technik', 'Pulsdauer', p => p.pulse_duration);
    push('Technik', 'Frequenz', p => p.frequency);
    push('Technik', 'Spotgrößen', p => p.spot_sizes);
    push('Technik', 'Kühlung', p => p.cooling);
    push('Technik', 'Laserklasse', p => p.laser_class);

    attrs.forEach(a => {
      out.push({
        group: `Merkmale · ${a.group_name || 'Sonstiges'}`,
        label: `${a.label || a.code}${a.unit ? ` (${a.unit})` : ''}`,
        cells: cols.map(p => (p ? attrValue(p.id, a.id) : '')),
      });
    });

    push('Preise', 'UVP netto', p => fmtMoney(price(p.id)?.rrp_net));
    push('Preise', 'Verkaufspreis netto', p => fmtMoney(price(p.id)?.sale_price_net));
    push('Preise', 'Lieferzeit', p => price(p.id)?.delivery_time);
    push('Preise', 'Garantie', p => price(p.id)?.warranty);

    push('Compliance', 'Freigabestatus', p => pmComplianceLabel(cmp(p.id)?.approval_status));
    push('Compliance', 'CE', p => p.ce_status);
    push('Compliance', 'MDR', p => p.mdr_status);
    push('Compliance', 'Zweckbestimmung', p => p.intended_use);

    return out.filter(r => r.cells.some(c => c !== ''));
  }, [cols, active.length, prices, comp, attrs, values]);

  const visible = useMemo(() => {
    if (!onlyDiff) return rows;
    return rows.filter(r => {
      const vals = r.cells.filter((_, i) => !!cols[i]);
      return new Set(vals).size > 1;
    });
  }, [rows, onlyDiff, cols]);

  const groups = useMemo(() => {
    const map: Record<string, typeof visible> = {};
    visible.forEach(r => { (map[r.group] ||= []).push(r); });
    return map;
  }, [visible]);

  const exportCsv = () => {
    const head = ['Gruppe', 'Merkmal', ...cols.map((p, i) => (p ? p.name : `Spalte ${SLOTS[i]}`))];
    const lines = [head, ...visible.map(r => [r.group, r.label, ...r.cells])]
      .map(cells => cells.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${lines}`], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'produktvergleich.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Produktvergleich"
        subtitle="Bis zu drei Artikel aus dem Product Master direkt gegenüberstellen."
        icon={Columns3}
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={!active.length}>
            <Download className="h-4 w-4 mr-2" /> CSV Export
          </Button>
        }
      />

      <Card>
        <CardContent className="p-4 grid gap-4 md:grid-cols-3">
          {SLOTS.map(s => (
            <div key={s} className="space-y-2">
              <Label>Produkt {s}</Label>
              <Select value={picked[s] || 'none'} onValueChange={v => setPicked(p => ({ ...p, [s]: v === 'none' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Artikel wählen" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— leer —</SelectItem>
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}{p.sku ? ` · ${p.sku}` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </CardContent>
      </Card>

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
      ) : !active.length ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">Bitte mindestens einen Artikel auswählen.</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Switch id="onlydiff" checked={onlyDiff} onCheckedChange={setOnlyDiff} />
              <Label htmlFor="onlydiff">Nur Unterschiede anzeigen</Label>
            </div>

            <ScrollArea className="max-h-[65vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[260px]">Merkmal</TableHead>
                    {cols.map((p, i) => (
                      <TableHead key={SLOTS[i]}>
                        {p ? (
                          <div className="space-y-1">
                            <Link to={`/artikel/${p.id}`} className="font-medium hover:underline">{p.name}</Link>
                            <div><Badge variant="outline">{p.sku || '—'}</Badge></div>
                          </div>
                        ) : <span className="text-muted-foreground">—</span>}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(groups).map(([group, gr]) => (
                    <Fragment key={group}>
                      <TableRow className="bg-muted/40">
                        <TableCell colSpan={4} className="font-semibold text-xs uppercase tracking-wide">{group}</TableCell>
                      </TableRow>
                      {gr.map(r => (
                        <TableRow key={`${group}-${r.label}`}>
                          <TableCell className="text-muted-foreground">{r.label}</TableCell>
                          {r.cells.map((c, i) => (
                            <TableCell key={i} className={cols[i] ? '' : 'text-muted-foreground'}>{c || '—'}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </Fragment>
                  ))}
                  {!visible.length && (
                    <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">Keine Unterschiede gefunden</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Building2, RefreshCw, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { KpiTile } from '@/components/infinity/KpiTile';
import { toast } from 'sonner';
import { useAccountingRegion } from '@/contexts/AccountingRegionContext';

interface Asset {
  id: string; inventory_number: string | null; name: string; category: string | null;
  acquisition_date: string | null; acquisition_value: number | null;
  useful_life_months: number | null; depreciation_method: string | null;
  book_value: number | null; accumulated_depreciation: number | null;
  location: string | null; datev_account: string | null; status: string | null;
  disposal_date: string | null; disposal_value: number | null; supplier_name: string | null;
}
interface Dep { asset_id: string; period: string; amount: number | null; }

interface Row {
  category: string;
  akbStart: number;   // Anschaffungswert Jahresanfang
  zugang: number;
  abgang: number;
  akbEnd: number;
  kumAfaStart: number;
  afaJahr: number;
  afaAbgang: number;
  kumAfaEnd: number;
  buchwertStart: number;
  buchwertEnd: number;
  count: number;
}

function csv(rows: (string | number)[][]) {
  return rows.map(r => r.map(c => {
    const s = String(c ?? '');
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(';')).join('\n');
}
function download(name: string, content: string) {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export default function Anlagenspiegel() {
  const { region } = useAccountingRegion();
  const cur = region === 'CH' ? 'CHF' : 'EUR';
  const fmt = (n: number) => Number(n || 0).toLocaleString('de-DE', { style: 'currency', currency: cur });

  const [year, setYear] = useState(new Date().getFullYear());
  const [assets, setAssets] = useState<Asset[]>([]);
  const [deps, setDeps] = useState<Dep[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const from = `${year}-01-01`;
  const to = `${year}-12-31`;

  async function load() {
    setLoading(true);
    const aRes = await (supabase as any)
      .from('finance_assets')
      .select('id, inventory_number, name, category, acquisition_date, acquisition_value, useful_life_months, depreciation_method, book_value, accumulated_depreciation, location, datev_account, status, disposal_date, disposal_value, supplier_name')
      .in('accounting_region', region === 'ALL' ? ['EU','CH'] : [region])
      .order('inventory_number', { ascending: true })
      .limit(2000);
    if (aRes.error) toast.error(aRes.error.message);
    const list = (aRes.data || []) as Asset[];
    setAssets(list);

    if (list.length) {
      const dRes = await (supabase as any)
        .from('finance_asset_depreciations')
        .select('asset_id, period, amount')
        .in('asset_id', list.map(a => a.id))
        .limit(20000);
      if (dRes.error) toast.error(dRes.error.message);
      setDeps((dRes.data || []) as Dep[]);
    } else setDeps([]);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-line */ }, [region]);

  const { rows, totals } = useMemo(() => {
    const depByAsset = new Map<string, Dep[]>();
    for (const d of deps) {
      if (!depByAsset.has(d.asset_id)) depByAsset.set(d.asset_id, []);
      depByAsset.get(d.asset_id)!.push(d);
    }
    const map = new Map<string, Row>();
    const touch = (cat: string) => {
      if (!map.has(cat)) map.set(cat, {
        category: cat, akbStart: 0, zugang: 0, abgang: 0, akbEnd: 0,
        kumAfaStart: 0, afaJahr: 0, afaAbgang: 0, kumAfaEnd: 0,
        buchwertStart: 0, buchwertEnd: 0, count: 0,
      });
      return map.get(cat)!;
    };

    for (const a of assets) {
      const cat = a.category || 'Ohne Kategorie';
      const r = touch(cat);
      const akb = Number(a.acquisition_value || 0);
      const acq = a.acquisition_date ? a.acquisition_date.slice(0, 10) : null;
      const dis = a.disposal_date ? a.disposal_date.slice(0, 10) : null;
      const acquiredThisYear = !!acq && acq >= from && acq <= to;
      const acquiredBefore = !!acq && acq < from;
      const disposedThisYear = !!dis && dis >= from && dis <= to;
      const disposedBefore = !!dis && dis < from;
      if (disposedBefore) continue;

      const dl = depByAsset.get(a.id) || [];
      const afaBefore = dl.filter(d => d.period && d.period.slice(0, 10) < from).reduce((s, d) => s + Number(d.amount || 0), 0);
      const afaYear = dl.filter(d => d.period && d.period.slice(0, 10) >= from && d.period.slice(0, 10) <= to).reduce((s, d) => s + Number(d.amount || 0), 0);

      r.count++;
      if (acquiredBefore) { r.akbStart += akb; r.kumAfaStart += afaBefore; r.buchwertStart += akb - afaBefore; }
      if (acquiredThisYear) r.zugang += akb;
      if (disposedThisYear) { r.abgang += akb; r.afaAbgang += afaBefore + afaYear; }
      r.afaJahr += afaYear;
    }
    for (const r of map.values()) {
      r.akbEnd = r.akbStart + r.zugang - r.abgang;
      r.kumAfaEnd = r.kumAfaStart + r.afaJahr - r.afaAbgang;
      r.buchwertEnd = r.akbEnd - r.kumAfaEnd;
    }
    const rows = [...map.values()].sort((a, b) => a.category.localeCompare(b.category));
    const totals = rows.reduce<Row>((t, r) => ({
      category: 'GESAMT',
      akbStart: t.akbStart + r.akbStart, zugang: t.zugang + r.zugang, abgang: t.abgang + r.abgang,
      akbEnd: t.akbEnd + r.akbEnd, kumAfaStart: t.kumAfaStart + r.kumAfaStart, afaJahr: t.afaJahr + r.afaJahr,
      afaAbgang: t.afaAbgang + r.afaAbgang, kumAfaEnd: t.kumAfaEnd + r.kumAfaEnd,
      buchwertStart: t.buchwertStart + r.buchwertStart, buchwertEnd: t.buchwertEnd + r.buchwertEnd,
      count: t.count + r.count,
    }), { category: 'GESAMT', akbStart: 0, zugang: 0, abgang: 0, akbEnd: 0, kumAfaStart: 0, afaJahr: 0, afaAbgang: 0, kumAfaEnd: 0, buchwertStart: 0, buchwertEnd: 0, count: 0 });
    return { rows, totals };
  }, [assets, deps, from, to]);

  const inventory = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assets
      .filter(a => !a.disposal_date || a.disposal_date.slice(0, 10) > to)
      .filter(a => !q || [a.inventory_number, a.name, a.category, a.location, a.supplier_name, a.datev_account]
        .some(v => (v || '').toLowerCase().includes(q)));
  }, [assets, search, to]);

  function exportSpiegel() {
    const head = ['Kategorie', 'Anzahl', 'AHK 01.01.', 'Zugänge', 'Abgänge', 'AHK 31.12.', 'Kum. AfA 01.01.', 'AfA Jahr', 'AfA Abgänge', 'Kum. AfA 31.12.', 'Buchwert 01.01.', 'Buchwert 31.12.'];
    const body = [...rows, totals].map(r => [r.category, r.count, r.akbStart, r.zugang, r.abgang, r.akbEnd, r.kumAfaStart, r.afaJahr, r.afaAbgang, r.kumAfaEnd, r.buchwertStart, r.buchwertEnd]);
    download(`anlagenspiegel_${region}_${year}.csv`, csv([head, ...body]));
    toast.success('Anlagenspiegel exportiert');
  }
  function exportInventar() {
    const head = ['Inventar-Nr', 'Bezeichnung', 'Kategorie', 'Standort', 'Lieferant', 'Konto', 'Anschaffung', 'AHK', 'Nutzungsdauer (Monate)', 'Methode', 'Kum. AfA', 'Buchwert', 'Status'];
    const body = inventory.map(a => [
      a.inventory_number ?? '', a.name, a.category ?? '', a.location ?? '', a.supplier_name ?? '', a.datev_account ?? '',
      a.acquisition_date ?? '', Number(a.acquisition_value || 0), a.useful_life_months ?? '', a.depreciation_method ?? '',
      Number(a.accumulated_depreciation || 0), Number(a.book_value || 0), a.status ?? '',
    ]);
    download(`inventarliste_${region}_${year}.csv`, csv([head, ...body]));
    toast.success('Inventarliste exportiert');
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Anlagenspiegel & Inventar"
        subtitle={`AfA-Spiegel und Inventarliste ${region === 'CH' ? '🇨🇭 Schweiz' : '🇪🇺 EU'} · Geschäftsjahr ${year}`}
        icon={Building2}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Aktualisieren
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="pt-6 flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label>Geschäftsjahr</Label>
            <Input type="number" className="w-32" value={year} onChange={e => setYear(Number(e.target.value) || year)} />
          </div>
          <Badge variant="outline">{assets.length} Anlagen</Badge>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <KpiTile label="AHK 31.12." value={fmt(totals.akbEnd)} icon={Building2} />
        <KpiTile label="Zugänge" value={fmt(totals.zugang)} icon={Building2} />
        <KpiTile label="AfA Jahr" value={fmt(totals.afaJahr)} icon={Building2} />
        <KpiTile label="Buchwert 31.12." value={fmt(totals.buchwertEnd)} icon={Building2} />
      </div>

      <Tabs defaultValue="spiegel">
        <TabsList>
          <TabsTrigger value="spiegel">Anlagenspiegel</TabsTrigger>
          <TabsTrigger value="inventar">Inventarliste</TabsTrigger>
        </TabsList>

        <TabsContent value="spiegel" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Anlagenspiegel {year}</CardTitle>
              <Button variant="outline" size="sm" onClick={exportSpiegel}>
                <Download className="h-4 w-4 mr-2" /> CSV
              </Button>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kategorie</TableHead>
                    <TableHead className="text-right">AHK 01.01.</TableHead>
                    <TableHead className="text-right">Zugänge</TableHead>
                    <TableHead className="text-right">Abgänge</TableHead>
                    <TableHead className="text-right">AHK 31.12.</TableHead>
                    <TableHead className="text-right">Kum. AfA 01.01.</TableHead>
                    <TableHead className="text-right">AfA {year}</TableHead>
                    <TableHead className="text-right">Kum. AfA 31.12.</TableHead>
                    <TableHead className="text-right">Buchwert 31.12.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 && (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      {loading ? 'Lade…' : 'Keine Anlagen im gewählten Bereich'}
                    </TableCell></TableRow>
                  )}
                  {rows.map(r => (
                    <TableRow key={r.category}>
                      <TableCell className="font-medium">{r.category} <span className="text-muted-foreground">({r.count})</span></TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(r.akbStart)}</TableCell>
                      <TableCell className="text-right tabular-nums text-emerald-500">{r.zugang ? fmt(r.zugang) : '–'}</TableCell>
                      <TableCell className="text-right tabular-nums text-destructive">{r.abgang ? fmt(r.abgang) : '–'}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(r.akbEnd)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(r.kumAfaStart)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(r.afaJahr)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(r.kumAfaEnd)}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{fmt(r.buchwertEnd)}</TableCell>
                    </TableRow>
                  ))}
                  {rows.length > 0 && (
                    <TableRow className="bg-muted/40 font-semibold">
                      <TableCell>GESAMT ({totals.count})</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(totals.akbStart)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(totals.zugang)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(totals.abgang)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(totals.akbEnd)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(totals.kumAfaStart)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(totals.afaJahr)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(totals.kumAfaEnd)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(totals.buchwertEnd)}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventar" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle>Inventarliste ({inventory.length})</CardTitle>
              <div className="flex items-center gap-2">
                <Input placeholder="Suchen…" className="w-56" value={search} onChange={e => setSearch(e.target.value)} />
                <Button variant="outline" size="sm" onClick={exportInventar}>
                  <Download className="h-4 w-4 mr-2" /> CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Inventar-Nr</TableHead>
                    <TableHead>Bezeichnung</TableHead>
                    <TableHead>Kategorie</TableHead>
                    <TableHead>Standort</TableHead>
                    <TableHead>Anschaffung</TableHead>
                    <TableHead className="text-right">AHK</TableHead>
                    <TableHead className="text-right">Kum. AfA</TableHead>
                    <TableHead className="text-right">Buchwert</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventory.length === 0 && (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      {loading ? 'Lade…' : 'Keine Anlagen gefunden'}
                    </TableCell></TableRow>
                  )}
                  {inventory.map(a => (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono text-xs">{a.inventory_number || '–'}</TableCell>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell>{a.category || '–'}</TableCell>
                      <TableCell>{a.location || '–'}</TableCell>
                      <TableCell>{a.acquisition_date ? new Date(a.acquisition_date).toLocaleDateString('de-DE') : '–'}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(Number(a.acquisition_value || 0))}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(Number(a.accumulated_depreciation || 0))}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{fmt(Number(a.book_value || 0))}</TableCell>
                      <TableCell><Badge variant="outline">{a.status || 'aktiv'}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

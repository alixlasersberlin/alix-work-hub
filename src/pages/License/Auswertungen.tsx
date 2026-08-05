import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/infinity/PageHeader';
import { BarChart3, Loader2, Download } from 'lucide-react';
import { useLicense, licMoney } from '@/hooks/useLicense';
import { downloadCsv, downloadExcel, downloadPdf } from '@/lib/license/export';

type Dim = 'month' | 'product' | 'brand' | 'tenant' | 'serial';
const DIMS: { key: Dim; label: string }[] = [
  { key: 'month', label: 'Royalty nach Monat' },
  { key: 'product', label: 'Royalty nach Produkt' },
  { key: 'brand', label: 'Royalty nach Marke' },
  { key: 'tenant', label: 'Royalty nach Mandant' },
  { key: 'serial', label: 'Royalty nach Seriennummer' },
];

export default function LicenseAuswertungen() {
  const { tenants } = useLicense();
  const [dim, setDim] = useState<Dim>('month');
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    (async () => {
      setBusy(true);
      const [{ data }, { data: b }] = await Promise.all([
        supabase.from('royalty_transactions' as any).select('*').gte('source_invoice_date', from).lte('source_invoice_date', to).limit(5000),
        supabase.from('brand_registry' as any).select('id,name'),
      ]);
      setRows(((data as any[]) || []));
      setBrands(((b as any[]) || []));
      setBusy(false);
    })();
  }, [from, to]);

  const grouped = useMemo(() => {
    const map = new Map<string, { amount: number; count: number; net: number }>();
    rows.forEach((r) => {
      let key = '–';
      if (dim === 'month') key = String(r.source_invoice_date).slice(0, 7);
      if (dim === 'product') key = r.product_name || '–';
      if (dim === 'brand') key = brands.find((b) => b.id === r.brand_id)?.name || 'ohne Marke';
      if (dim === 'tenant') key = tenants.find((t) => t.id === r.licensee_tenant_id)?.name || '–';
      if (dim === 'serial') key = r.serial_number || 'ohne Seriennummer';
      const cur = map.get(key) || { amount: 0, count: 0, net: 0 };
      cur.amount += Number(r.royalty_amount || 0);
      cur.net += Number(r.net_amount || 0);
      cur.count++;
      map.set(key, cur);
    });
    return [...map.entries()].sort((a, b) => (dim === 'month' ? a[0].localeCompare(b[0]) : b[1].amount - a[1].amount));
  }, [rows, dim, brands, tenants]);

  const headers = [DIMS.find((d) => d.key === dim)!.label.replace('Royalty nach ', ''), 'Buchungen', 'Basis netto', 'Royalty'];
  const exportRows = () => grouped.map(([k, v]) => [k, v.count, v.net.toFixed(2), v.amount.toFixed(2)]);
  const total = grouped.reduce((s, [, v]) => s + v.amount, 0);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader title="Auswertungen" subtitle="Royalty-Berichte mit Export als PDF, Excel und CSV" icon={BarChart3} />

      <Card className="grid gap-3 p-4 md:grid-cols-5">
        <div>
          <Label>Bericht</Label>
          <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={dim} onChange={(e) => setDim(e.target.value as Dim)}>
            {DIMS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
          </select>
        </div>
        <div><Label>Von</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label>Bis</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div className="flex items-end gap-2 md:col-span-2">
          <Button variant="outline" onClick={() => downloadPdf(`royalty_${dim}`, DIMS.find((d) => d.key === dim)!.label, headers, exportRows(), `${from} – ${to}`)}>
            <Download className="mr-2 h-4 w-4" /> PDF
          </Button>
          <Button variant="outline" onClick={() => downloadExcel(`royalty_${dim}`, headers, exportRows())}>Excel</Button>
          <Button variant="outline" onClick={() => downloadCsv(`royalty_${dim}`, headers, exportRows())}>CSV</Button>
        </div>
      </Card>

      <Card className="p-4">
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : (
          <div className="space-y-2 text-sm">
            {grouped.map(([k, v]) => (
              <div key={k} className="grid grid-cols-4 items-center gap-2 border-b border-border/50 pb-2">
                <span className="truncate">{k}</span>
                <span className="text-muted-foreground">{v.count} Buchungen</span>
                <span className="text-muted-foreground">{licMoney(v.net)}</span>
                <span className="text-right font-medium">{licMoney(v.amount)}</span>
              </div>
            ))}
            {grouped.length === 0 && <div className="text-muted-foreground">Keine Daten im Zeitraum.</div>}
            {grouped.length > 0 && (
              <div className="flex justify-between pt-2 font-semibold"><span>Gesamt</span><span>{licMoney(total)}</span></div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

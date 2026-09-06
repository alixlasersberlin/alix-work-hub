import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowDownToLine, ArrowUpFromLine, FileSpreadsheet, FileText, Loader2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PH_PRICE_COUNTRIES, formatMoney, readCountryPrice, effectivePrice } from '@/lib/producthub/countryPricing';
import {
  buildPriceRows, rowsToCsv, parseCsv, csvRowToCountryPrice, downloadFile, PH_PRICE_COLUMNS,
} from '@/lib/producthub/priceExport';

const db = supabase as any;

export default function ProductHubImportExport() {
  const { roles } = useAuth();
  const isSuperAdmin = (roles || []).includes('Super Admin');
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Record<string, string>[] | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await db.from('ph_products')
      .select('id, alix_product_id, name, model, sku, status, price_countries, config_powers')
      .order('name');
    if (error) toast.error(error.message); else setProducts(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const rows = useMemo(() => buildPriceRows(products), [products]);
  const stamp = new Date().toISOString().slice(0, 10);

  const exportCsv = () => {
    downloadFile(rowsToCsv(rows), `product-hub-preise-${stamp}.csv`, 'text/csv;charset=utf-8');
    toast.success(`${rows.length} Preiszeilen exportiert`);
  };

  const exportPdf = async () => {
    setBusy(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      doc.setFontSize(14);
      doc.text('ALIX Product Hub – Preisliste', 40, 40);
      doc.setFontSize(9);
      doc.text(`Stand: ${new Date().toLocaleString('de-DE')} · ${products.length} Geräte`, 40, 56);

      const body: any[] = [];
      for (const prod of products) {
        for (const def of PH_PRICE_COUNTRIES) {
          const p = readCountryPrice(prod.price_countries, def);
          if (!p.uvp && !p.vk_min_value && !p.vk_max_value) continue;
          body.push([
            prod.name, prod.model || '—', `${def.flag} ${def.label}`,
            p.input_mode === 'net' ? 'Netto' : 'Brutto',
            formatMoney(Number(p.uvp || 0), def, p.currency),
            formatMoney(effectivePrice(p, 'min'), def, p.currency),
            formatMoney(effectivePrice(p, 'max'), def, p.currency),
            p.promo_active ? (p.promo_name || 'Aktion') : '—',
            p.rent_active ? 'ja' : 'nein',
            p.public ? 'ja' : 'nein',
          ]);
        }
      }
      autoTable(doc, {
        startY: 70,
        head: [['Gerät', 'Modell', 'Land', 'Basis', 'UVP', 'VK Minimal', 'VK Maximal', 'Sonderaktion', 'Miete', 'Web']],
        body,
        styles: { fontSize: 7.5, cellPadding: 3 },
        headStyles: { fillColor: [20, 20, 20] },
      });
      doc.save(`product-hub-preise-${stamp}.pdf`);
      toast.success('PDF erstellt');
    } catch (e: any) { toast.error(e.message || 'PDF fehlgeschlagen'); }
    finally { setBusy(false); }
  };

  const onFile = async (file: File) => {
    try {
      const parsed = parseCsv(await file.text());
      if (!parsed.length) throw new Error('Keine Zeilen gefunden');
      setPreview(parsed);
      toast.success(`${parsed.length} Zeilen gelesen – bitte prüfen und übernehmen`);
    } catch (e: any) { toast.error(e.message); setPreview(null); }
  };

  const applyImport = async () => {
    if (!preview) return;
    setBusy(true);
    let ok = 0, skipped = 0;
    try {
      const byProduct = new Map<string, Record<string, string>[]>();
      for (const r of preview) {
        const prod = products.find(p =>
          (r.product_id && p.id === r.product_id) ||
          (r.alix_product_id && p.alix_product_id === r.alix_product_id) ||
          (r.name && (p.name || '').trim().toLowerCase() === r.name.trim().toLowerCase()));
        if (!prod) { skipped++; continue; }
        const list = byProduct.get(prod.id) || [];
        list.push(r);
        byProduct.set(prod.id, list);
      }
      const { data: { user } } = await supabase.auth.getUser();
      for (const [pid, list] of byProduct) {
        const prod = products.find(p => p.id === pid)!;
        const next = { ...(prod.price_countries && typeof prod.price_countries === 'object' ? prod.price_countries : {}) };
        for (const r of list) {
          const def = PH_PRICE_COUNTRIES.find(c => c.code === (r.land_code || '').toLowerCase())
            || PH_PRICE_COUNTRIES.find(c => c.label.toLowerCase() === (r.land || '').toLowerCase());
          if (!def) { skipped++; continue; }
          next[def.code] = csvRowToCountryPrice(r, def, prod.price_countries);
        }
        const de: any = next.de || {};
        const { error } = await db.from('ph_products').update({
          price_countries: next,
          price_public: de.public === true,
          price_uvp: de.uvp ?? null,
          vk_min_mode: de.vk_min_mode || 'fixed',
          vk_min_value: de.vk_min_value ?? null,
          vk_max_mode: de.vk_max_mode || 'fixed',
          vk_max_value: de.vk_max_value ?? null,
          updated_by: user?.id ?? null,
        }).eq('id', pid);
        if (error) throw error;
        ok++;
      }
      toast.success(`${ok} Geräte aktualisiert${skipped ? `, ${skipped} Zeilen übersprungen` : ''}`);
      setPreview(null);
      await load();
    } catch (e: any) { toast.error(e.message || 'Import fehlgeschlagen'); }
    finally { setBusy(false); }
  };

  const template = () => downloadFile(
    '\uFEFF' + PH_PRICE_COLUMNS.join(';'), `product-hub-preise-vorlage.csv`, 'text/csv;charset=utf-8');

  return (
    <div className="space-y-6">
      <PageHeader title="Import / Export" description="Alle Gerätepreise als CSV oder PDF exportieren und per CSV zurückspielen" icon={FileSpreadsheet} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><ArrowDownToLine className="h-4 w-4" />Export</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {loading ? 'Lade Geräte …' : `${products.length} Geräte · ${rows.length} Preiszeilen (je Gerät und Land)`}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={exportCsv} disabled={loading || !products.length}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />CSV exportieren
              </Button>
              <Button variant="outline" onClick={exportPdf} disabled={loading || busy || !products.length}>
                {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}PDF exportieren
              </Button>
              <Button variant="ghost" onClick={template}>Leere Vorlage</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Enthalten: Gerätename, Modell, SKU, Land, Währung, Steuersatz, UVP, VK Minimal/Maximal (inkl. errechneter Werte),
              Sonderaktion, Miete je Laufzeit, Kaution und die Staffelung nach Leistung Lasermodul.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><ArrowUpFromLine className="h-4 w-4" />Import (CSV)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {!isSuperAdmin ? (
              <p className="flex items-center gap-2 rounded-md border border-border bg-secondary/50 p-3 text-xs text-muted-foreground">
                <Lock className="h-4 w-4" />Preise dürfen ausschließlich vom Super Admin geändert werden.
              </p>
            ) : (
              <>
                <Input type="file" accept=".csv,text/csv" onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
                <p className="text-xs text-muted-foreground">
                  Zuordnung über <b>product_id</b>, sonst ALIX Product ID oder Gerätename. Es werden ausschließlich Preise
                  aktualisiert – Geräte werden nie angelegt oder gelöscht.
                </p>
                {preview && (
                  <div className="space-y-2">
                    <Badge variant="secondary">{preview.length} Zeilen zur Übernahme</Badge>
                    <div className="max-h-64 overflow-auto rounded-md border border-border">
                      <Table>
                        <TableHeader><TableRow>
                          <TableHead>Gerät</TableHead><TableHead>Land</TableHead><TableHead>UVP</TableHead>
                          <TableHead>VK Min</TableHead><TableHead>VK Max</TableHead>
                        </TableRow></TableHeader>
                        <TableBody>
                          {preview.slice(0, 100).map((r, i) => (
                            <TableRow key={i}>
                              <TableCell className="text-xs">{r.name}</TableCell>
                              <TableCell className="text-xs">{r.land || r.land_code}</TableCell>
                              <TableCell className="text-xs">{r.uvp}</TableCell>
                              <TableCell className="text-xs">{r.vk_min_wert}</TableCell>
                              <TableCell className="text-xs">{r.vk_max_wert}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={applyImport} disabled={busy}>
                        {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Preise übernehmen
                      </Button>
                      <Button variant="ghost" onClick={() => setPreview(null)}>Abbrechen</Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

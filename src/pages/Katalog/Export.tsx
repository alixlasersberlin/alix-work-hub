import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { FileSpreadsheet, FileText, Info, Loader2 } from 'lucide-react';

interface Country { id: string; iso_code: string; name: string; }
interface Language { id: string; code: string; name: string; }

export default function KatalogExport() {
  const { toast } = useToast();
  const [countries, setCountries] = useState<Country[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [country, setCountry] = useState<string>('__all__');
  const [language, setLanguage] = useState<string>('de');
  const [statusOnly, setStatusOnly] = useState(true);
  const [withImages, setWithImages] = useState(true);
  const [busy, setBusy] = useState<'xlsx' | 'pdf' | null>(null);

  useEffect(() => {
    (async () => {
      const c = supabase as any;
      const [{ data: cc }, { data: ll }] = await Promise.all([
        c.from('catalog_countries').select('id, iso_code, name').order('iso_code'),
        c.from('catalog_languages').select('id, code, name').order('code'),
      ]);
      setCountries(cc ?? []);
      setLanguages(ll ?? []);
    })();
  }, []);

  const loadData = async () => {
    const c = supabase as any;
    let q = c.from('catalog_items').select('id, sku, name, brand, model, status').order('sku').limit(2000);
    if (statusOnly) q = q.in('status', ['freigegeben', 'aktiv']);
    const { data: items, error } = await q;
    if (error) throw error;
    const ids = (items ?? []).map((i: any) => i.id);
    if (!ids.length) return { items: [], prices: [], descs: [], images: [] };

    const priceQ = c.from('catalog_item_prices')
      .select('item_id, country_id, currency_id, uvp_net, uvp_gross, sale_net, sale_gross, tax_rate, price_status')
      .in('item_id', ids);
    if (country !== '__all__') priceQ.eq('country_id', country);

    const [{ data: prices }, { data: descs }, { data: images }] = await Promise.all([
      priceQ,
      c.from('catalog_item_descriptions').select('item_id, language_code, short_text, long_text').in('item_id', ids).eq('language_code', language),
      withImages ? c.from('catalog_item_images').select('item_id, storage_path, is_primary').in('item_id', ids).eq('is_primary', true) : Promise.resolve({ data: [] }),
    ]);
    return { items: items ?? [], prices: prices ?? [], descs: descs ?? [], images: images ?? [] };
  };

  const exportXlsx = async () => {
    setBusy('xlsx');
    try {
      const { items, prices, descs } = await loadData();
      const priceByItem: Record<string, any[]> = {};
      prices.forEach((p: any) => { (priceByItem[p.item_id] = priceByItem[p.item_id] ?? []).push(p); });
      const descByItem: Record<string, any> = {};
      descs.forEach((d: any) => { descByItem[d.item_id] = d; });

      const rows = items.map((i: any) => {
        const p = (priceByItem[i.id] ?? [])[0] ?? {};
        const d = descByItem[i.id] ?? {};
        return {
          SKU: i.sku, Name: i.name, Marke: i.brand ?? '', Modell: i.model ?? '', Status: i.status,
          Kurztext: d.short_text ?? '', Langtext: d.long_text ?? '',
          'UVP netto': p.uvp_net ?? '', 'UVP brutto': p.uvp_gross ?? '',
          'VK netto': p.sale_net ?? '', 'VK brutto': p.sale_gross ?? '',
          Steuersatz: p.tax_rate ?? '', Preisstatus: p.price_status ?? '',
        };
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Katalog');
      XLSX.writeFile(wb, `katalog_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast({ title: `${rows.length} Artikel exportiert` });
    } catch (e: any) {
      toast({ title: 'Export fehlgeschlagen', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const exportPdf = async () => {
    setBusy('pdf');
    try {
      const { items, prices, descs, images } = await loadData();
      const priceByItem: Record<string, any[]> = {};
      prices.forEach((p: any) => { (priceByItem[p.item_id] = priceByItem[p.item_id] ?? []).push(p); });
      const descByItem: Record<string, any> = {};
      descs.forEach((d: any) => { descByItem[d.item_id] = d; });
      const imgByItem: Record<string, string> = {};

      // Signierte URLs für Hauptbilder
      if (withImages && images.length) {
        const paths = images.map((im: any) => im.storage_path).filter(Boolean);
        const { data: signed } = await (supabase as any).storage.from('catalog-media').createSignedUrls(paths, 300);
        (signed ?? []).forEach((s: any, idx: number) => {
          const im: any = images[idx];
          if (s.signedUrl && im) imgByItem[im.item_id] = s.signedUrl;
        });
      }

      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      doc.setFontSize(16);
      doc.text('AlixWork · Katalog-Export', 40, 40);
      doc.setFontSize(10);
      doc.setTextColor(120);
      doc.text(`Erstellt: ${new Date().toLocaleString('de-DE')} · ${items.length} Artikel`, 40, 58);

      const body = items.map((i: any) => {
        const p = (priceByItem[i.id] ?? [])[0] ?? {};
        const d = descByItem[i.id] ?? {};
        return [
          i.sku,
          `${i.name}${i.brand ? '\n' + i.brand : ''}`,
          d.short_text ?? '',
          p.uvp_net != null ? Number(p.uvp_net).toFixed(2) : '',
          p.uvp_gross != null ? Number(p.uvp_gross).toFixed(2) : '',
          i.status,
        ];
      });

      autoTable(doc, {
        startY: 78,
        head: [['SKU', 'Name / Marke', 'Kurztext', 'UVP netto', 'UVP brutto', 'Status']],
        body,
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [30, 30, 30], textColor: 255 },
        columnStyles: { 0: { cellWidth: 70 }, 1: { cellWidth: 110 }, 2: { cellWidth: 180 } },
      });

      // Bildseiten
      if (withImages) {
        for (const i of items as any[]) {
          const url = imgByItem[i.id];
          if (!url) continue;
          try {
            const res = await fetch(url);
            const blob = await res.blob();
            const dataUrl: string = await new Promise((r) => {
              const fr = new FileReader(); fr.onload = () => r(fr.result as string); fr.readAsDataURL(blob);
            });
            doc.addPage();
            doc.setFontSize(14);
            doc.text(`${i.sku} · ${i.name}`, 40, 40);
            doc.addImage(dataUrl, 'JPEG', 40, 60, 400, 300, undefined, 'FAST');
          } catch { /* skip */ }
        }
      }

      doc.save(`katalog_export_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast({ title: 'PDF erstellt' });
    } catch (e: any) {
      toast({ title: 'PDF-Export fehlgeschlagen', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 flex gap-3 items-start">
        <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="text-sm text-muted-foreground">
          Export von Katalog-Artikeln als Excel oder PDF. Bilder werden nur eingebettet, wenn ein Hauptbild hinterlegt ist. Preise erscheinen im gewählten Land, Beschreibungen in der gewählten Sprache.
        </div>
      </Card>

      <Card className="p-4 grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Land (Preise)</Label>
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Alle Länder</SelectItem>
              {countries.map((c) => <SelectItem key={c.id} value={c.id}>{c.iso_code} · {c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Sprache (Beschreibungen)</Label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {languages.map((l) => <SelectItem key={l.id} value={l.code}>{l.code.toUpperCase()} · {l.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={statusOnly} onCheckedChange={(v) => setStatusOnly(!!v)} />
          Nur freigegebene / aktive Artikel
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={withImages} onCheckedChange={(v) => setWithImages(!!v)} />
          Bilder einbetten (nur PDF)
        </label>
      </Card>

      <Card className="p-4 flex flex-wrap gap-3">
        <Button onClick={exportXlsx} disabled={busy !== null}>
          {busy === 'xlsx' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
          Excel exportieren
        </Button>
        <Button onClick={exportPdf} disabled={busy !== null} variant="secondary">
          {busy === 'pdf' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
          PDF exportieren
        </Button>
      </Card>
    </div>
  );
}

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
interface Branch {
  id: string; name: string; company_name: string | null; logo_url: string | null;
  pricelist_label: string | null; pdf_footer: string | null; legal_notice: string | null;
  address: string | null; email: string | null; phone: string | null; website: string | null;
  default_language: string | null; country_id: string | null;
}
interface Category { id: string; slug: string; names: any; parent_id: string | null; sort_order: number; }

export default function KatalogExport() {
  const { toast } = useToast();
  const [countries, setCountries] = useState<Country[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [country, setCountry] = useState<string>('__all__');
  const [language, setLanguage] = useState<string>('de');
  const [branchId, setBranchId] = useState<string>('__none__');
  const [statusOnly, setStatusOnly] = useState(true);
  const [withImages, setWithImages] = useState(true);
  const [groupByCategory, setGroupByCategory] = useState(true);
  const [busy, setBusy] = useState<'xlsx' | 'pdf' | 'csv' | null>(null);
  const [csvSep, setCsvSep] = useState<';' | ','>(';');

  useEffect(() => {
    (async () => {
      const c = supabase as any;
      const [{ data: cc }, { data: ll }, { data: bb }, { data: kk }] = await Promise.all([
        c.from('catalog_countries').select('id, iso_code, name').order('iso_code'),
        c.from('catalog_languages').select('id, code, name').order('code'),
        c.from('catalog_branches').select('id, name, company_name, logo_url, pricelist_label, pdf_footer, legal_notice, address, email, phone, website, default_language, country_id').eq('is_active', true).order('sort_order'),
        c.from('catalog_categories').select('id, slug, names, parent_id, sort_order').order('sort_order'),
      ]);
      setCountries(cc ?? []);
      setLanguages(ll ?? []);
      setBranches(bb ?? []);
      setCategories(kk ?? []);
    })();
  }, []);

  const applyBranch = (id: string) => {
    setBranchId(id);
    const b = branches.find((x) => x.id === id);
    if (!b) return;
    if (b.country_id) setCountry(b.country_id);
    if (b.default_language) setLanguage(b.default_language);
  };

  const loadData = async () => {
    const c = supabase as any;
    let q = c.from('catalog_items').select('id, sku, name, brand, model, status').order('sku').limit(2000);
    if (statusOnly) q = q.in('status', ['freigegeben', 'aktiv']);
    const { data: items, error } = await q;
    if (error) throw error;
    const ids = (items ?? []).map((i: any) => i.id);
    if (!ids.length) return { items: [], prices: [], descs: [], images: [], assignments: [] };

    const priceQ = c.from('catalog_item_prices')
      .select('item_id, country_id, currency_code, uvp_net, uvp_gross, sale_net, sale_gross, standard_gross, tax_rate, price_status')
      .in('item_id', ids);
    if (country !== '__all__') priceQ.eq('country_id', country);

    const [{ data: prices }, { data: descs }, { data: images }, { data: assignments }] = await Promise.all([
      priceQ,
      c.from('catalog_item_descriptions').select('item_id, language_code, short_description, long_description').in('item_id', ids).eq('language_code', language),
      withImages ? c.from('catalog_item_images').select('item_id, storage_path, is_primary').in('item_id', ids).eq('is_primary', true) : Promise.resolve({ data: [] }),
      groupByCategory ? c.from('item_category_assignments').select('item_id, category_id').in('item_id', ids) : Promise.resolve({ data: [] }),
    ]);
    return { items: items ?? [], prices: prices ?? [], descs: descs ?? [], images: images ?? [], assignments: assignments ?? [] };
  };

  const catName = (cat: Category | undefined) => {
    if (!cat) return 'Ohne Kategorie';
    const n = cat.names as any;
    return n?.[language] ?? n?.de ?? n?.en ?? cat.slug;
  };

  const loadLogoDataUrl = async (url: string | null): Promise<string | null> => {
    if (!url) return null;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      return await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result as string); fr.readAsDataURL(blob); });
    } catch { return null; }
  };

  const exportXlsx = async () => {
    setBusy('xlsx');
    try {
      const { items, prices, descs } = await loadData();
      const priceByItem: Record<string, any> = {};
      prices.forEach((p: any) => { priceByItem[p.item_id] = p; });
      const descByItem: Record<string, any> = {};
      descs.forEach((d: any) => { descByItem[d.item_id] = d; });

      const rows = items.map((i: any) => {
        const p = priceByItem[i.id] ?? {};
        const d = descByItem[i.id] ?? {};
        return {
          SKU: i.sku, Name: i.name, Marke: i.brand ?? '', Modell: i.model ?? '', Status: i.status,
          Kurztext: d.short_description ?? '', Langtext: d.long_description ?? '',
          'UVP netto': p.uvp_net ?? '', 'UVP brutto': p.uvp_gross ?? p.standard_gross ?? '',
          'VK netto': p.sale_net ?? '', 'VK brutto': p.sale_gross ?? '',
          Währung: p.currency_code ?? '',
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
  };

  const exportCsv = async () => {
    setBusy('csv');
    try {
      const { items, prices, descs } = await loadData();
      const priceByItem: Record<string, any> = {};
      prices.forEach((p: any) => { priceByItem[p.item_id] = p; });
      const descByItem: Record<string, any> = {};
      descs.forEach((d: any) => { descByItem[d.item_id] = d; });

      const headers = ['SKU','Name','Marke','Modell','Status','Kurztext','Langtext','UVP netto','UVP brutto','VK netto','VK brutto','Waehrung','Steuersatz','Preisstatus'];
      const escape = (v: any) => {
        const s = v == null ? '' : String(v);
        if (s.includes(csvSep) || s.includes('"') || s.includes('\n') || s.includes('\r')) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      };
      const lines = [headers.join(csvSep)];
      for (const i of items as any[]) {
        const p = priceByItem[i.id] ?? {};
        const d = descByItem[i.id] ?? {};
        lines.push([
          i.sku, i.name, i.brand ?? '', i.model ?? '', i.status,
          d.short_description ?? '', d.long_description ?? '',
          p.uvp_net ?? '', p.uvp_gross ?? p.standard_gross ?? '',
          p.sale_net ?? '', p.sale_gross ?? '',
          p.currency_code ?? '', p.tax_rate ?? '', p.price_status ?? '',
        ].map(escape).join(csvSep));
      }
      // BOM für Excel-Kompatibilität mit Umlauten
      const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `katalog_export_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: `${items.length} Artikel als CSV exportiert` });
    } catch (e: any) {
      toast({ title: 'CSV-Export fehlgeschlagen', description: e.message, variant: 'destructive' });
    } finally { setBusy(null); }
  };

  const exportPdf = async () => {
    setBusy('pdf');
    try {
      const { items, prices, descs, images, assignments } = await loadData();
      const branch = branches.find((b) => b.id === branchId) ?? null;
      const priceByItem: Record<string, any> = {};
      prices.forEach((p: any) => { priceByItem[p.item_id] = p; });
      const descByItem: Record<string, any> = {};
      descs.forEach((d: any) => { descByItem[d.item_id] = d; });
      const imgByItem: Record<string, string> = {};

      if (withImages && images.length) {
        const paths = images.map((im: any) => im.storage_path).filter(Boolean);
        const { data: signed } = await (supabase as any).storage.from('catalog-media').createSignedUrls(paths, 300);
        (signed ?? []).forEach((s: any, idx: number) => {
          const im: any = images[idx];
          if (s.signedUrl && im) imgByItem[im.item_id] = s.signedUrl;
        });
      }

      // Kategorie-Zuordnung: item -> category_id[]
      const catByItem: Record<string, string[]> = {};
      (assignments as any[]).forEach((a) => {
        (catByItem[a.item_id] = catByItem[a.item_id] ?? []).push(a.category_id);
      });
      const catById: Record<string, Category> = {};
      categories.forEach((c) => { catById[c.id] = c; });

      // Items nach Kategorie gruppieren
      const groups: Record<string, { cat: Category | undefined; items: any[] }> = {};
      if (groupByCategory) {
        for (const it of items as any[]) {
          const cids = catByItem[it.id] ?? [];
          if (cids.length === 0) {
            (groups['__none__'] = groups['__none__'] ?? { cat: undefined, items: [] }).items.push(it);
          } else {
            for (const cid of cids) {
              const key = cid;
              (groups[key] = groups[key] ?? { cat: catById[cid], items: [] }).items.push(it);
            }
          }
        }
      } else {
        groups['__all__'] = { cat: undefined, items: items as any[] };
      }

      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const logoData = await loadLogoDataUrl(branch?.logo_url ?? null);
      const title = branch?.pricelist_label ?? 'Katalog · Preisliste';
      const company = branch?.company_name ?? branch?.name ?? 'AlixWork';
      const countryName = country === '__all__' ? 'Alle Länder' : (countries.find((c) => c.id === country)?.name ?? '');
      const langName = languages.find((l) => l.code === language)?.name ?? language.toUpperCase();

      // Deckblatt
      if (logoData) {
        try { doc.addImage(logoData, 'PNG', 40, 40, 120, 60, undefined, 'FAST'); } catch { /* ignore */ }
      }
      doc.setFontSize(22); doc.setTextColor(20);
      doc.text(title, 40, 160);
      doc.setFontSize(12); doc.setTextColor(90);
      doc.text(company, 40, 184);
      if (branch?.address) doc.text(branch.address, 40, 200);
      doc.setFontSize(10); doc.setTextColor(120);
      doc.text(`Land: ${countryName} · Sprache: ${langName}`, 40, 230);
      doc.text(`Stand: ${new Date().toLocaleDateString('de-DE')} · ${items.length} Artikel`, 40, 246);
      if (branch?.legal_notice) {
        doc.setFontSize(8); doc.setTextColor(140);
        const wrapped = doc.splitTextToSize(branch.legal_notice, 500);
        doc.text(wrapped, 40, 780);
      }

      // Inhalt pro Gruppe
      const orderedKeys = Object.keys(groups).sort((a, b) => {
        const ca = groups[a].cat; const cb = groups[b].cat;
        return (ca?.sort_order ?? 999) - (cb?.sort_order ?? 999);
      });

      for (const key of orderedKeys) {
        const g = groups[key];
        if (g.items.length === 0) continue;
        doc.addPage();
        doc.setFontSize(14); doc.setTextColor(20);
        doc.text(groupByCategory ? catName(g.cat) : 'Alle Artikel', 40, 40);

        const body = g.items.map((i: any) => {
          const p = priceByItem[i.id] ?? {};
          const d = descByItem[i.id] ?? {};
          const gross = p.uvp_gross ?? p.standard_gross;
          return [
            i.sku,
            `${i.name}${i.brand ? '\n' + i.brand : ''}`,
            d.short_description ?? '',
            p.uvp_net != null ? Number(p.uvp_net).toFixed(2) : '',
            gross != null ? Number(gross).toFixed(2) : '',
            p.currency_code ?? '',
          ];
        });

        autoTable(doc, {
          startY: 60,
          head: [['SKU', 'Name / Marke', 'Kurztext', 'UVP netto', 'UVP brutto', 'Währ.']],
          body,
          styles: { fontSize: 8, cellPadding: 4 },
          headStyles: { fillColor: [30, 30, 30], textColor: 255 },
          columnStyles: { 0: { cellWidth: 70 }, 1: { cellWidth: 110 }, 2: { cellWidth: 180 }, 5: { cellWidth: 40 } },
          didDrawPage: () => {
            // Fußzeile
            const pageHeight = doc.internal.pageSize.getHeight();
            doc.setFontSize(8); doc.setTextColor(140);
            const footer = branch?.pdf_footer ?? `${company} · ${branch?.website ?? ''} · ${branch?.email ?? ''}`.trim();
            doc.text(footer, 40, pageHeight - 20);
          },
        });
      }

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

      const fname = `preisliste_${branch?.name?.replace(/\s+/g, '_') ?? 'alix'}_${language}_${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(fname);
      toast({ title: 'PDF erstellt', description: `${items.length} Artikel · ${orderedKeys.length} Gruppen` });
    } catch (e: any) {
      toast({ title: 'PDF-Export fehlgeschlagen', description: e.message, variant: 'destructive' });
    } finally { setBusy(null); }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 flex gap-3 items-start">
        <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="text-sm text-muted-foreground">
          Export von Katalog-Artikeln als Excel oder gebrandete Preisliste-PDF. Wähle eine Niederlassung, um Logo, Kopf, Land, Sprache und Fußzeile automatisch zu übernehmen.
        </div>
      </Card>

      <Card className="p-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label>Niederlassung (Branding)</Label>
          <Select value={branchId} onValueChange={applyBranch}>
            <SelectTrigger><SelectValue placeholder="Ohne Branding" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Ohne Branding (generisch)</SelectItem>
              {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}{b.company_name ? ` · ${b.company_name}` : ''}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
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
          <Checkbox checked={groupByCategory} onCheckedChange={(v) => setGroupByCategory(!!v)} />
          Nach Kategorie gruppieren (PDF)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={withImages} onCheckedChange={(v) => setWithImages(!!v)} />
          Bilder einbetten (nur PDF)
        </label>
      </Card>

      <Card className="p-4 flex flex-wrap gap-3 items-center">
        <Button onClick={exportXlsx} disabled={busy !== null}>
          {busy === 'xlsx' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
          Excel exportieren
        </Button>
        <Button onClick={exportCsv} disabled={busy !== null} variant="outline">
          {busy === 'csv' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
          CSV exportieren
        </Button>
        <Select value={csvSep} onValueChange={(v) => setCsvSep(v as ';' | ',')}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value=";">Trenner: Semikolon (;)</SelectItem>
            <SelectItem value=",">Trenner: Komma (,)</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={exportPdf} disabled={busy !== null} variant="secondary">
          {busy === 'pdf' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
          Preisliste-PDF exportieren
        </Button>
      </Card>
    </div>
  );
}

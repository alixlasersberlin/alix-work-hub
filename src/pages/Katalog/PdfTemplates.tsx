import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { FileText, Save, Trash2, Eye, Download } from 'lucide-react';
import jsPDF from 'jspdf';

const DEFAULT_BODY = `<h1>{{name}}</h1>
<p><strong>SKU:</strong> {{sku}}<br/><strong>Marke:</strong> {{brand}}<br/><strong>Modell:</strong> {{model}}</p>
<p>{{description}}</p>
<p><strong>Preis:</strong> {{price}} EUR</p>`;

export default function KatalogPdfTemplates() {
  const c = supabase as any;
  const { toast } = useToast();
  const [templates, setTemplates] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [sel, setSel] = useState<any | null>(null);
  const [previewItemId, setPreviewItemId] = useState<string>('');

  const load = async () => {
    const [{ data: t }, { data: it }] = await Promise.all([
      c.from('catalog_pdf_templates').select('*').order('created_at', { ascending: false }),
      c.from('catalog_items').select('id, sku, name, brand, model').in('status', ['aktiv', 'freigegeben']).limit(200),
    ]);
    setTemplates(t ?? []); setItems(it ?? []);
  };
  useEffect(() => { load(); }, []);

  const newTpl = () => setSel({
    name: 'Neues Template', scope: 'item', language: 'de',
    header_html: '<div style="border-bottom:2px solid #c9a24a;padding-bottom:8px;font-weight:bold;">Alix Katalogblatt</div>',
    body_html: DEFAULT_BODY,
    footer_html: '<div style="border-top:1px solid #ccc;padding-top:6px;font-size:10px;color:#666;">Alix Lasers · www.alix-lasers.com</div>',
    accent_color: '#c9a24a', logo_url: '', is_default: false,
  });
  const save = async () => {
    if (!sel) return;
    const payload = { ...sel };
    delete payload.id;
    if (sel.id) {
      const { error } = await c.from('catalog_pdf_templates').update(payload).eq('id', sel.id);
      if (error) return toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    } else {
      const { data, error } = await c.from('catalog_pdf_templates').insert(payload).select().single();
      if (error) return toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      setSel(data);
    }
    toast({ title: 'Gespeichert' }); load();
  };
  const remove = async (id: string) => {
    await c.from('catalog_pdf_templates').delete().eq('id', id);
    setSel(null); load();
  };

  const renderPdf = async () => {
    if (!sel || !previewItemId) return;
    const item = items.find(i => i.id === previewItemId);
    if (!item) return;
    const { data: prices } = await c.from('catalog_item_prices').select('price_gross, currency_code').eq('item_id', item.id).limit(1);
    const { data: descs } = await c.from('catalog_item_descriptions').select('description').eq('item_id', item.id).eq('language_code', sel.language).limit(1);
    const price = prices?.[0] ? `${prices[0].price_gross} ${prices[0].currency_code}` : '—';
    const desc = descs?.[0]?.description ?? '';
    const html = [sel.header_html, sel.body_html, sel.footer_html].join('<hr style="border:0;margin:20px 0;"/>')
      .replace(/{{name}}/g, item.name ?? '')
      .replace(/{{sku}}/g, item.sku ?? '')
      .replace(/{{brand}}/g, item.brand ?? '')
      .replace(/{{model}}/g, item.model ?? '')
      .replace(/{{description}}/g, desc)
      .replace(/{{price}}/g, price);

    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    const container = document.createElement('div');
    container.style.width = '540px'; container.style.padding = '20px'; container.style.fontFamily = 'sans-serif';
    container.innerHTML = html;
    document.body.appendChild(container);
    await pdf.html(container, {
      x: 20, y: 20, width: 555, windowWidth: 580,
      callback: () => { pdf.save(`${item.sku}.pdf`); container.remove(); },
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-1">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" />Templates</CardTitle>
          <Button size="sm" onClick={newTpl}>Neu</Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Scope</TableHead><TableHead>Sprache</TableHead></TableRow></TableHeader>
            <TableBody>
              {templates.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">Keine Templates</TableCell></TableRow>}
              {templates.map(t => (
                <TableRow key={t.id} className={`cursor-pointer ${sel?.id === t.id ? 'bg-muted' : ''}`} onClick={() => setSel(t)}>
                  <TableCell>{t.name}</TableCell>
                  <TableCell>{t.scope}</TableCell>
                  <TableCell>{t.language}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader><CardTitle className="text-base">{sel ? 'Template bearbeiten' : 'Wähle oder erstelle ein Template'}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {!sel && <div className="text-sm text-muted-foreground">Links auswählen …</div>}
          {sel && <>
            <div className="grid md:grid-cols-3 gap-3">
              <div><Label>Name</Label><Input value={sel.name ?? ''} onChange={e => setSel({ ...sel, name: e.target.value })} /></div>
              <div><Label>Scope</Label>
                <Select value={sel.scope} onValueChange={v => setSel({ ...sel, scope: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="item">Artikel</SelectItem>
                    <SelectItem value="bundle">Bundle</SelectItem>
                    <SelectItem value="category">Kategorie</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Sprache</Label><Input value={sel.language ?? 'de'} onChange={e => setSel({ ...sel, language: e.target.value })} /></div>
            </div>
            <div><Label>Header (HTML)</Label><Textarea rows={3} value={sel.header_html ?? ''} onChange={e => setSel({ ...sel, header_html: e.target.value })} /></div>
            <div><Label>Body (HTML, Platzhalter: {'{{name}} {{sku}} {{brand}} {{model}} {{description}} {{price}}'})</Label><Textarea rows={10} value={sel.body_html ?? ''} onChange={e => setSel({ ...sel, body_html: e.target.value })} /></div>
            <div><Label>Footer (HTML)</Label><Textarea rows={2} value={sel.footer_html ?? ''} onChange={e => setSel({ ...sel, footer_html: e.target.value })} /></div>
            <div className="grid md:grid-cols-2 gap-3">
              <div><Label>Akzentfarbe</Label><Input type="color" value={sel.accent_color ?? '#c9a24a'} onChange={e => setSel({ ...sel, accent_color: e.target.value })} /></div>
              <div><Label>Logo-URL</Label><Input value={sel.logo_url ?? ''} onChange={e => setSel({ ...sel, logo_url: e.target.value })} /></div>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t">
              <Button onClick={save}><Save className="h-4 w-4 mr-2" />Speichern</Button>
              {sel.id && <Button variant="destructive" onClick={() => remove(sel.id)}><Trash2 className="h-4 w-4 mr-2" />Löschen</Button>}
              <div className="ml-auto flex items-center gap-2">
                <Select value={previewItemId} onValueChange={setPreviewItemId}>
                  <SelectTrigger className="w-[280px]"><SelectValue placeholder="Preview-Artikel wählen…" /></SelectTrigger>
                  <SelectContent>{items.map(i => <SelectItem key={i.id} value={i.id}>{i.sku} · {i.name}</SelectItem>)}</SelectContent>
                </Select>
                <Button variant="outline" onClick={renderPdf} disabled={!previewItemId}><Download className="h-4 w-4 mr-2" />PDF</Button>
              </div>
            </div>
            <Card className="mt-3">
              <CardHeader><CardTitle className="text-xs flex items-center gap-2"><Eye className="h-3 w-3" />Vorschau</CardTitle></CardHeader>
              <CardContent>
                <div className="bg-white text-black p-4 rounded border" dangerouslySetInnerHTML={{ __html: [sel.header_html, sel.body_html, sel.footer_html].join('<hr/>') }} />
              </CardContent>
            </Card>
          </>}
        </CardContent>
      </Card>
    </div>
  );
}

import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { sbRepair } from '@/lib/repair/api';
import { useRepairPermissions } from '@/lib/repair/permissions';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Trash2, Printer, Send, Save, FileText } from 'lucide-react';
import { printRepairQuote, repairQuoteHtmlBlob } from '@/lib/repair/quote-pdf';

const KIND_LABEL: Record<string, string> = { part: 'Ersatzteil', labor: 'Arbeitszeit', shipping: 'Versand', other: 'Sonstiges' };

function recalc(quote: any, items: any[]) {
  const parts = items.filter((i) => i.kind === 'part').reduce((s, i) => s + Number(i.line_total || 0), 0);
  const labor = items.filter((i) => i.kind === 'labor').reduce((s, i) => s + Number(i.line_total || 0), 0);
  const shipping = items.filter((i) => i.kind === 'shipping').reduce((s, i) => s + Number(i.line_total || 0), 0);
  const other = items.filter((i) => i.kind === 'other').reduce((s, i) => s + Number(i.line_total || 0), 0);
  const net = parts + labor + shipping + other;
  const vat = Number(quote.vat_rate || 19);
  const gross = net * (1 + vat / 100);
  return { parts_total: parts, labor_total: labor, shipping_total: shipping, total_net: net, total_gross: gross };
}

export default function QuoteDetail() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { toast } = useToast();
  const perms = useRepairPermissions();
  const canEdit = perms.canEditQuotes;

  const [quote, setQuote] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [repair, setRepair] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data: q } = await sbRepair.from('repair_quotes').select('*').eq('id', id).maybeSingle();
    setQuote(q);
    if (q?.repair_order_id) {
      const { data: r } = await sbRepair.from('repair_orders').select('*').eq('id', q.repair_order_id).maybeSingle();
      setRepair(r);
    }
    const { data: i } = await sbRepair.from('repair_quote_items').select('*').eq('quote_id', id).order('sort_order').order('created_at');
    setItems(i || []);
    const { data: h } = await sbRepair.from('repair_quote_history').select('*').eq('quote_id', id).order('created_at', { ascending: false }).limit(50);
    setHistory(h || []);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const updateField = (k: string, v: any) => setQuote({ ...quote, [k]: v });

  const addItem = (kind: string) => {
    setItems([...items, { id: `tmp-${Date.now()}`, quote_id: id, kind, description: '', quantity: 1, unit_price: 0, line_total: 0, sort_order: items.length, _new: true }]);
  };

  const updateItem = (idx: number, patch: any) => {
    const next = [...items];
    next[idx] = { ...next[idx], ...patch };
    next[idx].line_total = Number(next[idx].quantity || 0) * Number(next[idx].unit_price || 0);
    setItems(next);
  };

  const removeItem = async (idx: number) => {
    const it = items[idx];
    if (!it._new) await sbRepair.from('repair_quote_items').delete().eq('id', it.id);
    setItems(items.filter((_, i) => i !== idx));
  };

  const save = async () => {
    if (!quote) return;
    setSaving(true);
    const totals = recalc(quote, items);
    const { error: qe } = await sbRepair.from('repair_quotes').update({
      labor_hours: quote.labor_hours,
      labor_rate: quote.labor_rate,
      vat_rate: quote.vat_rate,
      customer_note: quote.customer_note,
      internal_note: quote.internal_note,
      ...totals,
    }).eq('id', id);
    if (qe) { toast({ title: 'Fehler', description: qe.message, variant: 'destructive' }); setSaving(false); return; }

    for (const it of items) {
      const payload = { quote_id: id, kind: it.kind, description: it.description, quantity: Number(it.quantity || 0), unit_price: Number(it.unit_price || 0), line_total: Number(it.line_total || 0), sort_order: it.sort_order || 0 };
      if (it._new) await sbRepair.from('repair_quote_items').insert(payload);
      else await sbRepair.from('repair_quote_items').update(payload).eq('id', it.id);
    }
    setSaving(false);
    toast({ title: 'Kostenvoranschlag gespeichert' });
    load();
  };

  const doPrint = () => {
    if (!quote || !repair) return;
    const totals = recalc(quote, items);
    printRepairQuote({ repair, quote: { ...quote, ...totals }, items });
  };

  const sendToCustomer = async () => {
    if (!quote || !repair) return;
    if (!repair.customer_email) { toast({ title: 'Keine Kundenmail hinterlegt', variant: 'destructive' }); return; }
    await save();
    // PDF/HTML in Storage ablegen
    const totals = recalc(quote, items);
    const blob = repairQuoteHtmlBlob({ repair, quote: { ...quote, ...totals }, items });
    const path = `quotes/${id}.html`;
    const { error: upErr } = await supabase.storage.from('repair-files').upload(path, blob, { upsert: true, contentType: 'text/html' });
    if (upErr) { toast({ title: 'Upload-Fehler', description: upErr.message, variant: 'destructive' }); return; }
    await sbRepair.from('repair_quotes').update({ pdf_path: path }).eq('id', id);

    const { data, error } = await supabase.functions.invoke('send-repair-quote', { body: { quote_id: id } });
    if (error) { toast({ title: 'Versand fehlgeschlagen', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Kostenvoranschlag versendet', description: `An ${repair.customer_email}` });
    load();
  };

  if (loading) return <Card className="p-8 text-center text-muted-foreground">Lädt…</Card>;
  if (!quote) return <Card className="p-8 text-center text-muted-foreground">Kostenvoranschlag nicht gefunden.</Card>;

  const totals = recalc(quote, items);
  const readOnly = !canEdit || quote.status === 'Freigegeben' || quote.status === 'Abgelehnt';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/reparatur/kostenvoranschlaege"><Button variant="outline" size="sm"><ArrowLeft className="w-4 h-4 mr-1" />Zurück</Button></Link>
        <h2 className="text-xl font-bold font-mono">{quote.quote_number}</h2>
        <Badge variant="outline">{quote.status}</Badge>
        {repair && (
          <Link to={`/reparatur/${repair.id}`} className="text-sm text-primary hover:underline">
            Reparatur {repair.repair_number} · {repair.customer_name}
          </Link>
        )}
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={doPrint}><Printer className="w-4 h-4 mr-1" />PDF / Drucken</Button>
          {!readOnly && <Button variant="outline" onClick={save} disabled={saving}><Save className="w-4 h-4 mr-1" />Speichern</Button>}
          {!readOnly && quote.status !== 'Versendet' && (
            <Button onClick={sendToCustomer}><Send className="w-4 h-4 mr-1" />An Kunde senden</Button>
          )}
        </div>
      </div>

      <Card className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div><Label className="text-xs">Arbeitsstunden</Label><Input type="number" step="0.25" value={quote.labor_hours || ''} disabled={readOnly} onChange={(e) => updateField('labor_hours', e.target.value)} /></div>
        <div><Label className="text-xs">Stundensatz (€)</Label><Input type="number" step="0.01" value={quote.labor_rate || ''} disabled={readOnly} onChange={(e) => updateField('labor_rate', e.target.value)} /></div>
        <div><Label className="text-xs">MwSt. (%)</Label><Input type="number" step="0.01" value={quote.vat_rate || 19} disabled={readOnly} onChange={(e) => updateField('vat_rate', e.target.value)} /></div>
        <div className="flex items-end"><div className="text-right w-full"><div className="text-xs text-muted-foreground">Brutto gesamt</div><div className="text-xl font-bold">{totals.total_gross.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</div></div></div>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Positionen</h3>
          {!readOnly && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => addItem('part')}><Plus className="w-4 h-4 mr-1" />Ersatzteil</Button>
              <Button size="sm" variant="outline" onClick={() => addItem('labor')}><Plus className="w-4 h-4 mr-1" />Arbeitszeit</Button>
              <Button size="sm" variant="outline" onClick={() => addItem('shipping')}><Plus className="w-4 h-4 mr-1" />Versand</Button>
              <Button size="sm" variant="outline" onClick={() => addItem('other')}><Plus className="w-4 h-4 mr-1" />Sonstiges</Button>
            </div>
          )}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Art</TableHead>
              <TableHead>Beschreibung</TableHead>
              <TableHead className="w-[100px]">Menge</TableHead>
              <TableHead className="w-[120px]">Einzelpreis</TableHead>
              <TableHead className="w-[120px] text-right">Summe</TableHead>
              {!readOnly && <TableHead className="w-[40px]"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((it, idx) => (
              <TableRow key={it.id}>
                <TableCell>
                  {readOnly ? KIND_LABEL[it.kind] : (
                    <Select value={it.kind} onValueChange={(v) => updateItem(idx, { kind: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(KIND_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </TableCell>
                <TableCell><Input value={it.description || ''} disabled={readOnly} onChange={(e) => updateItem(idx, { description: e.target.value })} /></TableCell>
                <TableCell><Input type="number" step="0.01" value={it.quantity ?? ''} disabled={readOnly} onChange={(e) => updateItem(idx, { quantity: e.target.value })} /></TableCell>
                <TableCell><Input type="number" step="0.01" value={it.unit_price ?? ''} disabled={readOnly} onChange={(e) => updateItem(idx, { unit_price: e.target.value })} /></TableCell>
                <TableCell className="text-right tabular-nums">{Number(it.line_total || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</TableCell>
                {!readOnly && <TableCell><Button size="icon" variant="ghost" onClick={() => removeItem(idx)}><Trash2 className="w-4 h-4 text-destructive" /></Button></TableCell>}
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow><TableCell colSpan={readOnly ? 5 : 6} className="text-center text-muted-foreground py-6">Keine Positionen — fügen Sie oben Ersatzteile, Arbeitszeit oder Versand hinzu.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Card className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs">Hinweis für Kunden (erscheint im PDF)</Label>
          <Textarea rows={4} value={quote.customer_note || ''} disabled={readOnly} onChange={(e) => updateField('customer_note', e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Interne Notiz</Label>
          <Textarea rows={4} value={quote.internal_note || ''} disabled={readOnly} onChange={(e) => updateField('internal_note', e.target.value)} />
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><FileText className="w-4 h-4" />Historie</h3>
        <div className="space-y-1 text-xs">
          {history.map((h) => (
            <div key={h.id} className="flex items-center gap-2 text-muted-foreground">
              <span className="font-mono">{new Date(h.created_at).toLocaleString('de-DE')}</span>
              <span className="font-semibold text-foreground">{h.action}</span>
              {h.actor_email && <span>· {h.actor_email}</span>}
              {h.meta && <span>· {JSON.stringify(h.meta)}</span>}
            </div>
          ))}
          {history.length === 0 && <p className="text-muted-foreground">Keine Einträge</p>}
        </div>
      </Card>
    </div>
  );
}

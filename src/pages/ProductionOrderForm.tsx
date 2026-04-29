import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Loader2, Search, Save, Send, Download } from 'lucide-react';
import { toast } from 'sonner';
import { generateProductionOrderPdf } from '@/lib/production-order-pdf';
import { ALIX_MODEL_GROUPS } from '@/lib/alix-models';
import { useAuth } from '@/hooks/useAuth';

export default function ProductionOrderForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { profile, user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [productionOrderNumber, setProductionOrderNumber] = useState<string>('');

  // Auftrag suchen
  const [orderSearch, setOrderSearch] = useState('');
  const [orderResults, setOrderResults] = useState<any[]>([]);
  const [searchingOrder, setSearchingOrder] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  const [form, setForm] = useState({
    supplier_id: '',
    modellname: '',
    farbe: '',
    power_handstueck: '',
    bearbeiter: '',
    liefertermin: '',
    sonderwuensche: '',
    seriennummer: '',
    anmerkungen: '',
    payment_status: 'Nein',
  });

  // Load suppliers
  useEffect(() => {
    supabase.from('suppliers').select('*').eq('is_active', true).order('name')
      .then(({ data }) => setSuppliers(data || []));
  }, []);

  // Prefill bearbeiter with logged-in user's name (only for new orders)
  useEffect(() => {
    if (isEdit) return;
    const name = profile?.full_name || user?.email || '';
    if (name) setForm(f => (f.bearbeiter ? f : { ...f, bearbeiter: name }));
  }, [isEdit, profile?.full_name, user?.email]);

  // Load existing order if editing
  useEffect(() => {
    if (!isEdit || !id) return;
    (async () => {
      setLoading(true);
      const { data: po, error } = await supabase
        .from('production_orders').select('*').eq('id', id).single();
      if (error || !po) { toast.error('Bestellung nicht gefunden'); setLoading(false); return; }
      setProductionOrderNumber((po as any).production_order_number || '');
      setForm({
        supplier_id: po.supplier_id,
        modellname: po.modellname || '',
        farbe: po.farbe,
        power_handstueck: po.power_handstueck,
        bearbeiter: po.bearbeiter,
        liefertermin: po.liefertermin,
        sonderwuensche: po.sonderwuensche || '',
        seriennummer: po.seriennummer || '',
        anmerkungen: po.anmerkungen || '',
        payment_status: (po as any).payment_status || 'Nein',
      });
      // Load source order
      const { data: order } = await supabase.from('orders').select('*').eq('id', po.order_id).single();
      setSelectedOrder(order);
      // Load items from this PO
      const { data: poItems } = await supabase.from('production_order_items').select('*').eq('production_order_id', id);
      // Load all source order items
      const { data: srcItems } = await supabase.from('order_items').select('*').eq('order_id', po.order_id).order('item_order');
      setOrderItems(srcItems || []);
      const ids = new Set<string>((poItems || []).map(i => i.source_order_item_id).filter(Boolean));
      setSelectedItemIds(ids);
      setLoading(false);
    })();
  }, [id, isEdit]);

  const searchOrders = async () => {
    const q = orderSearch.trim();
    if (!q) return;
    setSearchingOrder(true);
    const like = `%${q}%`;

    // 1) Direkt nach Auftragsnummer suchen
    const { data: byNumber, error: e1 } = await supabase
      .from('orders')
      .select('id, order_number, customer_id, customer:customers(company_name, contact_name)')
      .ilike('order_number', like)
      .limit(20);
    if (e1) { setSearchingOrder(false); return toast.error(e1.message); }

    // 2) Kunden über Name finden, dann deren Aufträge
    const { data: matchedCustomers } = await supabase
      .from('customers')
      .select('id')
      .or(`company_name.ilike.${like},contact_name.ilike.${like}`)
      .limit(50);

    let byCustomer: any[] = [];
    const custIds = (matchedCustomers || []).map((c: any) => c.id);
    if (custIds.length) {
      const { data } = await supabase
        .from('orders')
        .select('id, order_number, customer_id, customer:customers(company_name, contact_name)')
        .in('customer_id', custIds)
        .limit(50);
      byCustomer = data || [];
    }

    // Merge + dedupe
    const map = new Map<string, any>();
    [...(byNumber || []), ...byCustomer].forEach(o => map.set(o.id, o));
    const merged = Array.from(map.values());

    setSearchingOrder(false);
    setOrderResults(merged);
    if (!merged.length) toast.info('Keine Aufträge gefunden');
  };

  const pickOrder = async (o: any) => {
    setSelectedOrder(o);
    setOrderResults([]);
    setOrderSearch('');
    const { data } = await supabase.from('order_items').select('*').eq('order_id', o.id).order('item_order');
    setOrderItems(data || []);
    setSelectedItemIds(new Set());
  };

  const toggleItem = (id: string) => {
    const next = new Set(selectedItemIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedItemIds(next);
  };

  const selectedItems = useMemo(
    () => orderItems.filter(i => selectedItemIds.has(i.id)),
    [orderItems, selectedItemIds]
  );

  const validate = () => {
    if (!selectedOrder) { toast.error('Bitte einen Auftrag auswählen'); return false; }
    if (!form.supplier_id) { toast.error('Bitte einen Zulieferer wählen'); return false; }
    if (!form.farbe.trim()) { toast.error('Farbe ist Pflichtfeld'); return false; }
    if (!form.power_handstueck.trim()) { toast.error('Power Handstück ist Pflichtfeld'); return false; }
    if (!form.bearbeiter.trim()) { toast.error('Bearbeiter ist Pflichtfeld'); return false; }
    if (!form.liefertermin) { toast.error('Liefertermin ist Pflichtfeld'); return false; }
    if (selectedItems.length === 0) { toast.error('Mindestens eine Position auswählen'); return false; }
    return true;
  };

  const persist = async (): Promise<string | null> => {
    if (!validate() || !selectedOrder) return null;
    setSaving(true);
    const payload = {
      order_id: selectedOrder.id,
      order_number: selectedOrder.order_number,
      supplier_id: form.supplier_id,
      modellname: form.modellname.trim() || null,
      farbe: form.farbe.trim(),
      power_handstueck: form.power_handstueck.trim(),
      bearbeiter: form.bearbeiter.trim(),
      liefertermin: form.liefertermin,
      sonderwuensche: form.sonderwuensche.trim() || null,
      seriennummer: form.seriennummer.trim() || null,
      anmerkungen: form.anmerkungen.trim() || null,
      payment_status: form.payment_status,
    };
    let poId = id;
    if (isEdit && id) {
      const { error } = await supabase.from('production_orders').update(payload).eq('id', id);
      if (error) { toast.error(error.message); setSaving(false); return null; }
      await supabase.from('production_order_items').delete().eq('production_order_id', id);
    } else {
      const { data, error } = await supabase.from('production_orders').insert(payload).select('id').single();
      if (error || !data) { toast.error(error?.message || 'Fehler'); setSaving(false); return null; }
      poId = data.id;
    }
    if (poId) {
      const itemRows = selectedItems.map((it, idx) => ({
        production_order_id: poId,
        source_order_item_id: it.id,
        item_name: it.item_name,
        description: it.description,
        sku: it.sku,
        quantity: it.quantity,
        unit: it.unit,
        item_order: idx,
      }));
      if (itemRows.length) await supabase.from('production_order_items').insert(itemRows);
    }
    setSaving(false);
    return poId || null;
  };

  const buildPdf = async (lang: 'bilingual' | 'en' = 'bilingual', poId?: string | null) => {
    const supplier = suppliers.find(s => s.id === form.supplier_id);
    if (!supplier || !selectedOrder) return null;
    let displayNumber = selectedOrder.order_number;
    const targetId = poId || id;
    if (targetId) {
      const { data: poRow } = await supabase
        .from('production_orders')
        .select('production_order_number')
        .eq('id', targetId)
        .maybeSingle();
      if (poRow?.production_order_number) displayNumber = poRow.production_order_number;
    }
    return generateProductionOrderPdf({
      order_number: displayNumber,
      ...form,
      supplier,
      items: selectedItems,
    }, lang);
  };


  const onSave = async () => {
    const poId = await persist();
    if (poId) { toast.success('Gespeichert'); navigate('/order'); }
  };

  const downloadPdfWith = async (lang: 'bilingual' | 'en') => {
    const poId = await persist();
    if (!poId) return;
    const pdf = await buildPdf(lang, poId);
    if (pdf) {
      const url = URL.createObjectURL(pdf.blob);
      const a = document.createElement('a');
      a.href = url; a.download = pdf.filename; a.click();
      URL.revokeObjectURL(url);
      toast.success('PDF heruntergeladen');
    }
  };
  const onSaveAndDownload = () => downloadPdfWith('bilingual');
  const onSaveAndDownloadEn = () => downloadPdfWith('en');

  const onSaveAndSend = async () => {
    const poId = await persist();
    if (!poId) return;
    const pdf = await buildPdf('bilingual', poId);
    const supplier = suppliers.find(s => s.id === form.supplier_id);
    if (!pdf || !supplier || !selectedOrder) return;

    // Download PDF
    const url = URL.createObjectURL(pdf.blob);
    const a = document.createElement('a');
    a.href = url; a.download = pdf.filename; a.click();
    URL.revokeObjectURL(url);

    // Upload to storage
    const path = `${poId}/${pdf.filename}`;
    await supabase.storage.from('production-orders').upload(path, pdf.blob, { upsert: true, contentType: 'application/pdf' });
    await supabase.from('production_orders').update({ pdf_path: path, sent_at: new Date().toISOString(), status: 'gesendet' }).eq('id', poId);

    // Open mailto
    const subject = encodeURIComponent(`Bestellung ${selectedOrder.order_number}`);
    const body = encodeURIComponent(
      `Sehr geehrte Damen und Herren,\n\nanbei unsere Bestellung ${selectedOrder.order_number}.\n\n` +
      `Modell: ${form.modellname || '—'}\nFarbe: ${form.farbe}\nPower Handstück: ${form.power_handstueck}\n` +
      `Liefertermin: ${form.liefertermin}\nBearbeiter: ${form.bearbeiter}\n\n` +
      (form.anmerkungen ? `Anmerkungen:\n${form.anmerkungen}\n\n` : '') +
      `Das Bestell-PDF wurde Ihnen heruntergeladen — bitte fügen Sie es als Anhang hinzu.\n\nMit freundlichen Grüßen`
    );
    window.location.href = `mailto:${supplier.email}?subject=${subject}&body=${body}`;
    toast.success('PDF heruntergeladen – E-Mail wird geöffnet');
    setTimeout(() => navigate('/order'), 1500);
  };

  if (loading) return <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/order')} className="mb-2">
          <ArrowLeft className="w-4 h-4 mr-1" /> Zurück
        </Button>
        <h1 className="text-2xl font-display font-bold gold-text">
          {isEdit ? 'Bestellung bearbeiten' : 'Neue Produktionsbestellung'}
        </h1>
      </div>

      {/* Auftrag */}
      <Card className="p-4 space-y-3">
        <h2 className="font-semibold">1. Haupt Auftrag auswählen</h2>
        {selectedOrder ? (
          <div className="flex items-center justify-between bg-muted/40 p-3 rounded">
            <div>
              {isEdit && productionOrderNumber && (
                <div className="text-xs text-muted-foreground mb-1">
                  Bestellnummer: <span className="font-mono font-semibold text-foreground">{productionOrderNumber}</span>
                </div>
              )}
              <div className="text-xs text-muted-foreground">Original Auftragsnummer (Zoho):</div>
              <div className="font-mono font-semibold">{selectedOrder.order_number}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {selectedOrder.customer?.company_name || selectedOrder.customer?.contact_name || ''}
              </div>
            </div>
            {!isEdit && <Button variant="outline" size="sm" onClick={() => { setSelectedOrder(null); setOrderItems([]); setSelectedItemIds(new Set()); }}>Anderen wählen</Button>}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input placeholder="Auftragsnummer oder Kundenname" value={orderSearch}
                onChange={e => setOrderSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchOrders()} />
              <Button onClick={searchOrders} disabled={searchingOrder}>
                {searchingOrder ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>
            {orderResults.map(o => (
              <button key={o.id} type="button" onClick={() => pickOrder(o)}
                className="w-full text-left p-2 rounded border border-border hover:bg-muted/40">
                <div className="font-mono">{o.order_number}</div>
                <div className="text-xs text-muted-foreground">{o.customer?.company_name || o.customer?.contact_name || ''}</div>
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Positionen */}
      {selectedOrder && (
        <Card className="p-4 space-y-3">
          <h2 className="font-semibold">2. Positionen aus Auftrag auswählen</h2>
          {orderItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Positionen im Auftrag.</p>
          ) : (
            <div className="space-y-2">
              {orderItems.map(it => (
                <label key={it.id} className="flex items-start gap-3 p-2 rounded border border-border hover:bg-muted/30 cursor-pointer">
                  <Checkbox checked={selectedItemIds.has(it.id)} onCheckedChange={() => toggleItem(it.id)} className="mt-1" />
                  <div className="flex-1">
                    <div className="font-medium">{it.item_name || '—'}</div>
                    {it.description && <div className="text-xs text-muted-foreground">{it.description}</div>}
                    <div className="text-xs text-muted-foreground mt-1">
                      Menge: {it.quantity} {it.unit || ''} {it.sku && `· SKU: ${it.sku}`}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Bestelldaten */}
      <Card className="p-4 space-y-4">
        <h2 className="font-semibold">3. Bestelldaten</h2>
        <div>
          <Label>Zulieferer *</Label>
          <Select value={form.supplier_id} onValueChange={v => setForm({ ...form, supplier_id: v })}>
            <SelectTrigger><SelectValue placeholder="Zulieferer wählen…" /></SelectTrigger>
            <SelectContent>
              {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.email})</SelectItem>)}
            </SelectContent>
          </Select>
          {suppliers.length === 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              Noch keine Zulieferer. <button type="button" onClick={() => navigate('/order/zulieferer')} className="text-primary underline">Jetzt anlegen</button>
            </p>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Modellname</Label>
            <Select value={form.modellname} onValueChange={v => setForm({ ...form, modellname: v })}>
              <SelectTrigger><SelectValue placeholder="Modell wählen…" /></SelectTrigger>
              <SelectContent className="max-h-80">
                {ALIX_MODEL_GROUPS.map(group => (
                  <div key={group.label}>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {group.label}
                    </div>
                    {group.models.map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Farbe *</Label>
            {(() => {
              const FARBEN = ['Blau - Gold','Weiss - Gold','Schwarz - Gold','Pink - Gold','Rot - Gold','Weiss','Schwarz','Blau'];
              const isPreset = FARBEN.includes(form.farbe);
              const selectValue = form.farbe === '' ? '' : (isPreset ? form.farbe : '__free__');
              return (
                <div className="space-y-2">
                  <Select
                    value={selectValue}
                    onValueChange={v => setForm({ ...form, farbe: v === '__free__' ? '' : v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Farbe wählen…" /></SelectTrigger>
                    <SelectContent>
                      {FARBEN.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                      <SelectItem value="__free__">Freie Farbe</SelectItem>
                    </SelectContent>
                  </Select>
                  {selectValue === '__free__' && (
                    <Input
                      value={form.farbe}
                      onChange={e => setForm({ ...form, farbe: e.target.value })}
                      placeholder="Farbe eingeben…"
                    />
                  )}
                </div>
              );
            })()}
          </div>
          <div>
            <Label>Power Handstück *</Label>
            <Select value={form.power_handstueck} onValueChange={v => setForm({ ...form, power_handstueck: v })}>
              <SelectTrigger><SelectValue placeholder="Power wählen…" /></SelectTrigger>
              <SelectContent>
                {['800W','1200W','1600W','2000W','2400W','3000W','5000W'].map(p => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Bearbeiter *</Label><Input value={form.bearbeiter} onChange={e => setForm({ ...form, bearbeiter: e.target.value })} /></div>
          <div><Label>Liefertermin *</Label><Input type="date" value={form.liefertermin} onChange={e => setForm({ ...form, liefertermin: e.target.value })} /></div>
          <div><Label>Seriennummer</Label><Input value={form.seriennummer} onChange={e => setForm({ ...form, seriennummer: e.target.value })} /></div>
          <div>
            <Label>Payment Status *</Label>
            <Select value={form.payment_status} onValueChange={v => setForm({ ...form, payment_status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Ja">Ja</SelectItem>
                <SelectItem value="Nein">Nein</SelectItem>
                <SelectItem value="Teilweise">Teilweise</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>Interne Nummer</Label>
          <Input
            value={form.sonderwuensche}
            onChange={e => setForm({ ...form, sonderwuensche: e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 10) })}
            maxLength={10}
            placeholder="Max. 10 Zeichen (A-Z, 0-9)"
            className="font-mono uppercase"
          />
        </div>
        <div><Label>Anmerkungen</Label><Textarea value={form.anmerkungen} onChange={e => setForm({ ...form, anmerkungen: e.target.value })} rows={3} /></div>
      </Card>

      <div className="flex flex-wrap justify-end gap-2 sticky bottom-0 bg-background py-3 border-t border-border">
        <Button variant="outline" onClick={() => navigate('/order')} disabled={saving}>Abbrechen</Button>
        <Button variant="outline" onClick={onSave} disabled={saving}><Save className="w-4 h-4 mr-2" /> Speichern</Button>
        <Button variant="outline" onClick={onSaveAndDownload} disabled={saving}><Download className="w-4 h-4 mr-2" /> Speichern + PDF</Button>
        <Button variant="outline" onClick={onSaveAndDownloadEn} disabled={saving}><Download className="w-4 h-4 mr-2" /> PDF (EN)</Button>
        <Button onClick={onSaveAndSend} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
          Speichern + an Zulieferer senden
        </Button>
      </div>
    </div>
  );
}

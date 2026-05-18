import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Loader2, Search, Save, Send, Download, Plus, Trash2, Upload, FileText, X } from 'lucide-react';
import { toast } from 'sonner';
import { generateProductionOrderPdf } from '@/lib/production-order-pdf';
import { ALIX_MODEL_GROUPS } from '@/lib/alix-models';
import { useAuth } from '@/hooks/useAuth';

type Mode = 'order' | 'reclamation';

export default function ProductionOrderForm({ mode = 'order' }: { mode?: Mode } = {}) {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const isReclamation = mode === 'reclamation';
  const basePath = isReclamation ? '/order/reklamation' : '/order';

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [productionOrderNumber, setProductionOrderNumber] = useState<string>('');
  const [attachmentPath, setAttachmentPath] = useState<string | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [invoicePath, setInvoicePath] = useState<string | null>(null);
  const [uploadingInvoice, setUploadingInvoice] = useState(false);

  // Auftrag suchen
  const [orderSearch, setOrderSearch] = useState('');
  const [orderResults, setOrderResults] = useState<any[]>([]);
  const [searchingOrder, setSearchingOrder] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [manualItems, setManualItems] = useState<Array<{ item_name: string; description: string; sku: string; quantity: string; unit: string }>>([]);

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
    reclamation_reason: '',
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
      setAttachmentPath((po as any).attachment_pdf_path || null);
      setInvoicePath((po as any).invoice_pdf_path || null);
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
        reclamation_reason: (po as any).reclamation_reason || '',
      });
      // Load source order
      const { data: order } = await supabase.from('orders').select('*').eq('id', po.order_id).single();
      setSelectedOrder(order);
      // Load items from this PO
      const { data: poItems } = await supabase.from('production_order_items').select('*').eq('production_order_id', id).order('item_order');
      // Load all source order items
      const { data: srcItems } = await supabase.from('order_items').select('*').eq('order_id', po.order_id).order('item_order');
      setOrderItems(srcItems || []);
      const ids = new Set<string>((poItems || []).map(i => i.source_order_item_id).filter(Boolean));
      setSelectedItemIds(ids);
      const manual = (poItems || []).filter(i => !i.source_order_item_id).map(i => ({
        item_name: i.item_name || '',
        description: i.description || '',
        sku: i.sku || '',
        quantity: i.quantity != null ? String(i.quantity) : '1',
        unit: i.unit || '',
      }));
      setManualItems(manual);
      setLoading(false);
    })();
  }, [id, isEdit]);

  const [searchParams] = useSearchParams();

  // Prefill from ?order_id (e.g. coming from "FREI für Bestellung" list)
  useEffect(() => {
    if (isEdit) return;
    const qid = searchParams.get('order_id');
    if (!qid || selectedOrder) return;
    (async () => {
      const { data: o } = await supabase
        .from('orders')
        .select('id, order_number, customer_id, deposit_ok, deposit_ok_by, customer:customers(company_name, contact_name)')
        .eq('id', qid)
        .maybeSingle();
      if (!o) return;
      if (!isReclamation && (!o.deposit_ok || !o.deposit_ok_by)) {
        toast.error('Auftrag ist nicht für Bestellung freigegeben (Anzahlung fehlt).');
        return;
      }
      await pickOrder(o);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, isEdit]);

  const searchOrders = async () => {
    const q = orderSearch.trim();
    if (!q) return;
    setSearchingOrder(true);
    const like = `%${q}%`;

    // 1) Direkt nach Auftragsnummer suchen
    let qNumber = supabase
      .from('orders')
      .select('id, order_number, customer_id, deposit_ok, deposit_ok_by, customer:customers(company_name, contact_name)')
      .ilike('order_number', like)
      .limit(20);
    if (!isReclamation) {
      qNumber = qNumber.eq('deposit_ok', true).not('deposit_ok_by', 'is', null).neq('deposit_ok_by', '');
    }
    const { data: byNumber, error: e1 } = await qNumber;
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
      let qCust = supabase
        .from('orders')
        .select('id, order_number, customer_id, deposit_ok, deposit_ok_by, customer:customers(company_name, contact_name)')
        .in('customer_id', custIds)
        .limit(50);
      if (!isReclamation) {
        qCust = qCust.eq('deposit_ok', true).not('deposit_ok_by', 'is', null).neq('deposit_ok_by', '');
      }
      const { data } = await qCust;
      byCustomer = data || [];
    }

    // Merge + dedupe
    const map = new Map<string, any>();
    [...(byNumber || []), ...byCustomer].forEach(o => map.set(o.id, o));
    const merged = Array.from(map.values());

    setSearchingOrder(false);
    setOrderResults(merged);
    if (!merged.length) toast.info(isReclamation ? 'Keine Aufträge gefunden' : 'Keine freigegebenen Aufträge gefunden (Anzahlung erforderlich)');
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

  const cleanManualItems = useMemo(
    () => manualItems.filter(m => m.item_name.trim() || m.description.trim() || m.sku.trim()),
    [manualItems]
  );

  const allItemsForPdf = useMemo(
    () => [
      ...selectedItems,
      ...cleanManualItems.map(m => ({
        item_name: m.item_name.trim() || null,
        description: m.description.trim() || null,
        sku: m.sku.trim() || null,
        quantity: m.quantity ? Number(m.quantity) : null,
        unit: m.unit.trim() || null,
      })),
    ],
    [selectedItems, cleanManualItems]
  );

  const addManualItem = () =>
    setManualItems(arr => [...arr, { item_name: '', description: '', sku: '', quantity: '1', unit: '' }]);
  const updateManualItem = (idx: number, patch: Partial<typeof manualItems[number]>) =>
    setManualItems(arr => arr.map((m, i) => (i === idx ? { ...m, ...patch } : m)));
  const removeManualItem = (idx: number) =>
    setManualItems(arr => arr.filter((_, i) => i !== idx));

  const handleAttachmentUpload = async (file: File) => {
    if (!file) return;
    if (file.type !== 'application/pdf') { toast.error('Nur PDF-Dateien erlaubt'); return; }
    if (file.size > 20 * 1024 * 1024) { toast.error('Max. 20 MB'); return; }
    setUploadingAttachment(true);
    const folder = id || `tmp-${user?.id || 'new'}-${Date.now()}`;
    const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, '_');
    const path = `${folder}/attachment-${Date.now()}-${safeName}`;
    const { error } = await supabase.storage
      .from('production-orders')
      .upload(path, file, { upsert: true, contentType: 'application/pdf' });
    setUploadingAttachment(false);
    if (error) { toast.error(error.message); return; }
    if (attachmentPath && attachmentPath !== path) {
      await supabase.storage.from('production-orders').remove([attachmentPath]);
    }
    setAttachmentPath(path);
    if (isEdit && id) {
      await supabase.from('production_orders').update({ attachment_pdf_path: path }).eq('id', id);
    }
    toast.success('PDF hochgeladen');
  };

  const downloadAttachment = async () => {
    if (!attachmentPath) return;
    const { data, error } = await supabase.storage.from('production-orders').createSignedUrl(attachmentPath, 60);
    if (error || !data) { toast.error(error?.message || 'Fehler'); return; }
    window.open(data.signedUrl, '_blank');
  };

  const removeAttachment = async () => {
    if (!attachmentPath) return;
    await supabase.storage.from('production-orders').remove([attachmentPath]);
    if (isEdit && id) {
      await supabase.from('production_orders').update({ attachment_pdf_path: null }).eq('id', id);
    }
    setAttachmentPath(null);
    toast.success('PDF entfernt');
  };

  const handleInvoiceUpload = async (file: File) => {
    if (!file) return;
    if (file.type !== 'application/pdf') { toast.error('Nur PDF-Dateien erlaubt'); return; }
    if (file.size > 20 * 1024 * 1024) { toast.error('Max. 20 MB'); return; }
    setUploadingInvoice(true);
    const folder = id || `tmp-${user?.id || 'new'}-${Date.now()}`;
    const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, '_');
    const path = `${folder}/invoice-${Date.now()}-${safeName}`;
    const { error } = await supabase.storage
      .from('production-orders')
      .upload(path, file, { upsert: true, contentType: 'application/pdf' });
    setUploadingInvoice(false);
    if (error) { toast.error(error.message); return; }
    if (invoicePath && invoicePath !== path) {
      await supabase.storage.from('production-orders').remove([invoicePath]);
    }
    setInvoicePath(path);
    if (isEdit && id) {
      await supabase.from('production_orders').update({ invoice_pdf_path: path }).eq('id', id);
    }
    toast.success('Rechnung hochgeladen');
  };

  const downloadInvoice = async () => {
    if (!invoicePath) return;
    const { data, error } = await supabase.storage.from('production-orders').createSignedUrl(invoicePath, 60);
    if (error || !data) { toast.error(error?.message || 'Fehler'); return; }
    window.open(data.signedUrl, '_blank');
  };

  const removeInvoice = async () => {
    if (!invoicePath) return;
    await supabase.storage.from('production-orders').remove([invoicePath]);
    if (isEdit && id) {
      await supabase.from('production_orders').update({ invoice_pdf_path: null }).eq('id', id);
    }
    setInvoicePath(null);
    toast.success('Rechnung entfernt');
  };

  const validate = () => {
    if (!selectedOrder) { toast.error('Bitte einen Auftrag auswählen'); return false; }
    if (!form.supplier_id) { toast.error('Bitte einen Zulieferer wählen'); return false; }
    if (!form.farbe.trim()) { toast.error('Farbe ist Pflichtfeld'); return false; }
    if (!form.power_handstueck.trim()) { toast.error('Power Handstück ist Pflichtfeld'); return false; }
    if (!form.bearbeiter.trim()) { toast.error('Bearbeiter ist Pflichtfeld'); return false; }
    if (!form.liefertermin) { toast.error('Liefertermin ist Pflichtfeld'); return false; }
    if (isReclamation && !form.reclamation_reason.trim()) { toast.error('Reklamationsgrund ist Pflichtfeld'); return false; }
    if (selectedItems.length === 0 && cleanManualItems.length === 0) {
      toast.error('Mindestens eine Position auswählen oder manuell hinzufügen'); return false;
    }
    for (const m of cleanManualItems) {
      if (!m.item_name.trim()) { toast.error('Manuelle Position: Bezeichnung ist Pflichtfeld'); return false; }
    }
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
      is_reclamation: isReclamation,
      reclamation_reason: isReclamation ? (form.reclamation_reason.trim() || null) : null,
      attachment_pdf_path: attachmentPath,
      invoice_pdf_path: invoicePath,
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
      const fromOrder = selectedItems.map((it, idx) => ({
        production_order_id: poId,
        source_order_item_id: it.id,
        item_name: it.item_name,
        description: it.description,
        sku: it.sku,
        quantity: it.quantity,
        unit: it.unit,
        item_order: idx,
      }));
      const fromManual = cleanManualItems.map((m, idx) => ({
        production_order_id: poId,
        source_order_item_id: null,
        item_name: m.item_name.trim(),
        description: m.description.trim() || null,
        sku: m.sku.trim() || null,
        quantity: m.quantity ? Number(m.quantity) : null,
        unit: m.unit.trim() || null,
        item_order: fromOrder.length + idx,
      }));
      const itemRows = [...fromOrder, ...fromManual];
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
      items: allItemsForPdf,
    }, lang);
  };


  const onSave = async () => {
    const poId = await persist();
    if (poId) { toast.success('Gespeichert'); navigate(basePath); }
  };

  const ensureApproved = async (poId: string): Promise<boolean> => {
    const { data } = await supabase.from('production_orders').select('*').eq('id', poId).maybeSingle();
    if ((data as any)?.approval_status !== 'approved') {
      toast.error('Bestellung muss erst von einem Super Admin genehmigt werden.');
      return false;
    }
    return true;
  };

  const downloadPdfWith = async (lang: 'bilingual' | 'en') => {
    const poId = await persist();
    if (!poId) return;
    if (!(await ensureApproved(poId))) return;
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
    if (!(await ensureApproved(poId))) return;
    const pdf = await buildPdf('bilingual', poId);
    const supplier = suppliers.find(s => s.id === form.supplier_id);
    if (!pdf || !supplier || !selectedOrder) return;

    const recipients = [supplier.email, supplier.email_secondary]
      .map((e: string | null | undefined) => (e || '').trim())
      .filter(Boolean);
    if (recipients.length === 0) {
      toast.error('Zulieferer hat keine E-Mail-Adresse hinterlegt');
      return;
    }

    // Upload PDF to storage
    const path = `${poId}/${pdf.filename}`;
    const up = await supabase.storage
      .from('production-orders')
      .upload(path, pdf.blob, { upsert: true, contentType: 'application/pdf' });
    if (up.error) { toast.error(up.error.message); return; }

    // Create long-lived signed URL (~10 Jahre, effektiv permanent – Versand erfolgt erst nach Freigabe)
    const TEN_YEARS_SECONDS = 60 * 60 * 24 * 365 * 10;
    const { data: signed, error: sigErr } = await supabase.storage
      .from('production-orders')
      .createSignedUrl(path, TEN_YEARS_SECONDS);
    if (sigErr || !signed) { toast.error(sigErr?.message || 'Link-Erstellung fehlgeschlagen'); return; }

    await supabase.from('production_orders').update({
      pdf_path: path,
      sent_at: new Date().toISOString(),
      status: 'gesendet',
    }).eq('id', poId);

    // Send transactional email to all recipients
    const templateData = {
      order_number: productionOrderNumber || selectedOrder.order_number,
      supplier_name: supplier.name,
      modellname: form.modellname,
      farbe: form.farbe,
      power_handstueck: form.power_handstueck,
      liefertermin: form.liefertermin,
      bearbeiter: form.bearbeiter,
      anmerkungen: form.anmerkungen,
      pdf_url: signed.signedUrl,
      is_reclamation: isReclamation,
    };

    const results = await Promise.allSettled(
      recipients.map(email =>
        supabase.functions.invoke('send-transactional-email', {
          body: {
            templateName: 'production-order-supplier',
            recipientEmail: email,
            idempotencyKey: `po-send-${poId}-${email}`,
            templateData,
          },
        })
      )
    );
    const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && (r.value as any)?.error));
    if (failed.length === recipients.length) {
      toast.error('E-Mail-Versand fehlgeschlagen');
      return;
    }
    if (failed.length > 0) {
      toast.warning(`E-Mail teilweise versendet (${recipients.length - failed.length}/${recipients.length})`);
    } else {
      toast.success(`E-Mail an ${recipients.length === 1 ? 'Zulieferer' : 'beide Adressen'} versendet`);
    }
    setTimeout(() => navigate(basePath), 1500);
  };

  if (loading) return <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate(basePath)} className="mb-2">
          <ArrowLeft className="w-4 h-4 mr-1" /> Zurück
        </Button>
        <h1 className="text-2xl font-display font-bold gold-text">
          {isReclamation
            ? (isEdit ? 'Reklamation bearbeiten' : 'Neue Reklamation')
            : (isEdit ? 'Bestellung bearbeiten' : 'Neue Produktionsbestellung')}
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

          {/* Manuelle Positionen */}
          <div className="pt-4 border-t border-border space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-sm">Manuelle Positionen</h3>
                <p className="text-xs text-muted-foreground">Positionen, die nicht im Auftrag enthalten sind</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addManualItem}>
                <Plus className="w-4 h-4 mr-1" /> Hinzufügen
              </Button>
            </div>
            {manualItems.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Noch keine manuellen Positionen.</p>
            ) : (
              <div className="space-y-3">
                {manualItems.map((m, idx) => (
                  <div key={idx} className="p-3 rounded border border-border bg-muted/20 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-medium text-muted-foreground">Position {idx + 1}</span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeManualItem(idx)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div className="md:col-span-2">
                        <Label className="text-xs">Bezeichnung *</Label>
                        <Input value={m.item_name} onChange={e => updateManualItem(idx, { item_name: e.target.value })} placeholder="z. B. Ersatz-Handstück" />
                      </div>
                      <div className="md:col-span-2">
                        <Label className="text-xs">Beschreibung</Label>
                        <Textarea rows={2} value={m.description} onChange={e => updateManualItem(idx, { description: e.target.value })} />
                      </div>
                      <div>
                        <Label className="text-xs">SKU</Label>
                        <Input value={m.sku} onChange={e => updateManualItem(idx, { sku: e.target.value })} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Menge</Label>
                          <Input type="number" min="0" step="any" value={m.quantity} onChange={e => updateManualItem(idx, { quantity: e.target.value })} />
                        </div>
                        <div>
                          <Label className="text-xs">Einheit</Label>
                          <Input value={m.unit} onChange={e => updateManualItem(idx, { unit: e.target.value })} placeholder="Stk" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
                    {[...group.models].sort((a, b) => a.localeCompare(b, 'de')).map(m => (
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
            <Label>Hersteller Payment erhalten</Label>
            <div className="flex items-center h-10 px-3 rounded-md border border-input bg-muted/30 text-sm text-muted-foreground">
              {form.payment_status || 'Nein'}
            </div>
          </div>
          <div>
            <Label>PDF-Anhang</Label>
            {attachmentPath ? (
              <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-input bg-background">
                <FileText className="w-4 h-4 text-primary shrink-0" />
                <button
                  type="button"
                  onClick={downloadAttachment}
                  className="flex-1 text-sm truncate text-left text-foreground hover:text-primary"
                  title={attachmentPath.split('/').pop() || 'PDF anzeigen'}
                >
                  {attachmentPath.split('/').pop()?.replace(/^attachment-\d+-/, '') || 'PDF anzeigen'}
                </button>
                <Button type="button" variant="ghost" size="sm" onClick={removeAttachment} className="h-7 w-7 p-0">
                  <X className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 h-10 px-3 rounded-md border border-dashed border-input bg-background hover:bg-muted/30 cursor-pointer text-sm text-muted-foreground">
                {uploadingAttachment ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Lädt hoch…</>
                ) : (
                  <><Upload className="w-4 h-4" /> PDF hochladen</>
                )}
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  disabled={uploadingAttachment}
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) handleAttachmentUpload(f);
                    e.target.value = '';
                  }}
                />
              </label>
            )}
          </div>
          <div>
            <Label>Rechnung</Label>
            {invoicePath ? (
              <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-input bg-background">
                <FileText className="w-4 h-4 text-primary shrink-0" />
                <button
                  type="button"
                  onClick={downloadInvoice}
                  className="flex-1 text-sm truncate text-left text-foreground hover:text-primary"
                  title={invoicePath.split('/').pop() || 'Rechnung anzeigen'}
                >
                  {invoicePath.split('/').pop()?.replace(/^invoice-\d+-/, '') || 'Rechnung anzeigen'}
                </button>
                <Button type="button" variant="ghost" size="sm" onClick={removeInvoice} className="h-7 w-7 p-0">
                  <X className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 h-10 px-3 rounded-md border border-dashed border-input bg-background hover:bg-muted/30 cursor-pointer text-sm text-muted-foreground">
                {uploadingInvoice ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Lädt hoch…</>
                ) : (
                  <><Upload className="w-4 h-4" /> Rechnung hochladen</>
                )}
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  disabled={uploadingInvoice}
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) handleInvoiceUpload(f);
                    e.target.value = '';
                  }}
                />
              </label>
            )}
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
        {isReclamation && (
          <div>
            <Label>Reklamationsgrund *</Label>
            <Textarea
              value={form.reclamation_reason}
              onChange={e => setForm({ ...form, reclamation_reason: e.target.value })}
              rows={3}
              placeholder="Bitte den Grund der Reklamation beschreiben…"
            />
          </div>
        )}
      </Card>

      <div className="flex flex-wrap justify-end gap-2 sticky bottom-0 bg-background py-3 border-t border-border">
        <Button variant="outline" onClick={() => navigate(basePath)} disabled={saving}>Abbrechen</Button>
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

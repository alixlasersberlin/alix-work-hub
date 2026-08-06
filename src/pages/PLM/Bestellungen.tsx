import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { ShoppingCart, Plus, Search, Loader2, Trash2, Send, PackageCheck, FileDown, Mail } from 'lucide-react';
import { buildPurchaseOrderPdf, purchaseOrderFileName } from '@/lib/plm/purchase-order-pdf';
import { useAuth } from '@/hooks/useAuth';

const WRITE_ROLES = ['Super Admin', 'Admin', 'Geschäftsführung', 'Medical', 'Produktion', 'QM'];
const PO_STATUS = ['entwurf', 'freigegeben', 'bestellt', 'teilgeliefert', 'geliefert', 'storniert'];
const fmt = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n || 0);
const num = (v: any) => Number(v ?? 0) || 0;
const dt = (v?: string | null) => (v ? new Date(v).toLocaleDateString('de-DE') : '—');

export default function PlmBestellungen() {
  const { roles } = useAuth();
  const canWrite = (roles || []).some((r: string) => WRITE_ROLES.includes(r));
  const canDelete = (roles || []).includes('Super Admin');

  const [pos, setPos] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [parts, setParts] = useState<any[]>([]);
  const [partSuppliers, setPartSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [poOpen, setPoOpen] = useState(false);
  const [detail, setDetail] = useState<any | null>(null);
  const [form, setForm] = useState<any>({});
  const [itemForm, setItemForm] = useState<any>({ quantity: 1, unit: 'Stk', price: 0 });
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [p, i, s, pa, ps] = await Promise.all([
      supabase.from('plm_purchase_orders' as any).select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('plm_purchase_order_items' as any).select('*').limit(5000),
      supabase.from('plm_suppliers' as any).select('id,name,supplier_number,email').limit(1000),
      supabase.from('plm_parts' as any).select('id,name,part_number,price,moq,lead_time_days,primary_supplier_id').limit(5000),
      supabase.from('plm_part_suppliers' as any).select('*').limit(5000),
    ]);
    const err = p.error || i.error || s.error || pa.error || ps.error;
    if (err) toast.error(err.message);
    setPos((p.data as any[]) || []);
    setItems((i.data as any[]) || []);
    setSuppliers((s.data as any[]) || []);
    setParts((pa.data as any[]) || []);
    setPartSuppliers((ps.data as any[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const supplierMap = useMemo(() => Object.fromEntries(suppliers.map(s => [s.id, s])), [suppliers]);
  const partMap = useMemo(() => Object.fromEntries(parts.map(p => [p.id, p])), [parts]);

  const itemsByPo = useMemo(() => {
    const m: Record<string, any[]> = {};
    items.forEach(it => { (m[it.po_id] ||= []).push(it); });
    return m;
  }, [items]);

  const totalOf = useCallback((poId: string) =>
    (itemsByPo[poId] || []).reduce((s, it) => s + num(it.quantity) * num(it.price), 0), [itemsByPo]);

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return pos.filter(p => {
      if (!s) return true;
      const sup = supplierMap[p.supplier_id]?.name || '';
      return (JSON.stringify(p) + sup).toLowerCase().includes(s);
    });
  }, [pos, search, supplierMap]);

  const kpi = useMemo(() => ({
    open: pos.filter(p => ['entwurf', 'freigegeben', 'bestellt', 'teilgeliefert'].includes(p.status)).length,
    value: pos.filter(p => p.status !== 'storniert').reduce((s, p) => s + totalOf(p.id), 0),
    delivered: pos.filter(p => p.status === 'geliefert').length,
  }), [pos, totalOf]);

  function openPo(row?: any) {
    setForm(row ? { ...row } : { status: 'entwurf', currency: 'EUR', order_date: new Date().toISOString().slice(0, 10) });
    setPoOpen(true);
  }

  async function savePo() {
    if (!form.supplier_id) { toast.error('Lieferant wählen'); return; }
    setSaving(true);
    const payload: any = {
      po_number: form.po_number || `PO-${new Date().getFullYear()}-${String(pos.length + 1).padStart(4, '0')}`,
      supplier_id: form.supplier_id,
      status: form.status || 'entwurf',
      order_date: form.order_date || null,
      expected_date: form.expected_date || null,
      currency: form.currency || 'EUR',
      contact_email: form.contact_email || supplierMap[form.supplier_id]?.email || null,
      notes: form.notes || null,
    };
    const { error } = form.id
      ? await (supabase.from('plm_purchase_orders' as any) as any).update(payload).eq('id', form.id)
      : await (supabase.from('plm_purchase_orders' as any) as any).insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Bestellung gespeichert');
    setPoOpen(false);
    load();
  }

  async function setStatus(po: any, status: string) {
    const { error } = await (supabase.from('plm_purchase_orders' as any) as any)
      .update({ status, sent_at: status === 'bestellt' ? new Date().toISOString() : po.sent_at })
      .eq('id', po.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Status: ${status}`);
    load();
  }

  function pdfDataFor(po: any) {
    const sup = suppliers.find(s => s.id === po.supplier_id) || {};
    return {
      po_number: po.po_number,
      order_date: po.order_date,
      expected_date: po.expected_date,
      currency: po.currency || 'EUR',
      notes: po.notes,
      supplier: sup as any,
      items: (itemsByPo[po.id] || []).map((it: any, i: number) => ({
        position_no: it.position_no ?? i + 1,
        part_number: partMap[it.part_id]?.part_number ?? null,
        description: it.description || partMap[it.part_id]?.name || null,
        quantity: num(it.quantity),
        unit: it.unit,
        price: num(it.price),
      })),
    };
  }

  function downloadPdf(po: any) {
    const data = pdfDataFor(po);
    buildPurchaseOrderPdf(data).save(purchaseOrderFileName(data));
  }

  async function sendPo(po: any) {
    if (!(itemsByPo[po.id] || []).length) { toast.error('Bestellung hat keine Positionen.'); return; }
    setSending(po.id);
    try {
      const data = pdfDataFor(po);
      const base64 = buildPurchaseOrderPdf(data).output('datauristring').split(',')[1];
      const { data: res, error } = await supabase.functions.invoke('plm-purchase-order-send', {
        body: { po_id: po.id, pdf_base64: base64 },
      });
      if (error) throw error;
      if ((res as any)?.error) throw new Error((res as any).error);
      toast.success(`Bestellung an ${(res as any)?.recipient} gesendet`);
      load();
    } catch (e: any) {
      toast.error(e.message || 'Versand fehlgeschlagen');
    } finally {
      setSending(null);
    }
  }

  async function addItem() {
    if (!detail) return;
    const part = partMap[itemForm.part_id];
    const { error } = await (supabase.from('plm_purchase_order_items' as any) as any).insert({
      po_id: detail.id,
      part_id: itemForm.part_id || null,
      description: itemForm.description || part?.name || null,
      quantity: num(itemForm.quantity) || 1,
      unit: itemForm.unit || 'Stk',
      price: num(itemForm.price),
      position_no: (itemsByPo[detail.id]?.length || 0) + 1,
    });
    if (error) { toast.error(error.message); return; }
    setItemForm({ quantity: 1, unit: 'Stk', price: 0 });
    toast.success('Position ergänzt');
    load();
  }

  async function removeItem(id: string) {
    const { error } = await (supabase.from('plm_purchase_order_items' as any) as any).delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    load();
  }

  async function receiveItem(it: any) {
    const { error } = await (supabase.from('plm_purchase_order_items' as any) as any)
      .update({ received_quantity: num(it.quantity) }).eq('id', it.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Als geliefert markiert');
    load();
  }

  function onPickPart(partId: string) {
    const part = partMap[partId];
    const ps = partSuppliers.find(x => x.part_id === partId && x.supplier_id === detail?.supplier_id);
    setItemForm((f: any) => ({
      ...f,
      part_id: partId,
      description: part?.name || '',
      price: num(ps?.price ?? part?.price),
      quantity: num(ps?.moq) || f.quantity || 1,
    }));
  }

  const statusBadge = (s: string) => {
    const cls = s === 'geliefert' ? 'border-emerald-500/40 text-emerald-500'
      : s === 'storniert' ? 'border-destructive/50 text-destructive'
      : s === 'entwurf' ? 'border-border text-muted-foreground'
      : 'border-amber-500/40 text-amber-500';
    return <Badge variant="outline" className={cls}>{s}</Badge>;
  };

  const detailItems = detail ? (itemsByPo[detail.id] || []) : [];

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Bestellungen"
        subtitle="Lieferantenbestellungen aus dem Materialbedarf — Positionen, Status und Wareneingang."
        icon={ShoppingCart}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Offene Bestellungen', value: String(kpi.open) },
          { label: 'Bestellwert gesamt', value: fmt(kpi.value) },
          { label: 'Vollständig geliefert', value: String(kpi.delivered) },
        ].map(k => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className="text-2xl font-semibold">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Suche Bestellnummer, Lieferant, Status…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {canWrite && <Button onClick={() => openPo()}><Plus className="mr-2 h-4 w-4" />Bestellung</Button>}
          </div>

          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bestell-Nr.</TableHead>
                    <TableHead>Lieferant</TableHead>
                    <TableHead>Bestelldatum</TableHead>
                    <TableHead>Liefertermin</TableHead>
                    <TableHead>Positionen</TableHead>
                    <TableHead className="text-right">Wert</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aktion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(p => (
                    <TableRow key={p.id} className="cursor-pointer" onClick={() => setDetail(p)}>
                      <TableCell className="font-mono text-xs">{p.po_number || '—'}</TableCell>
                      <TableCell>{supplierMap[p.supplier_id]?.name || '—'}</TableCell>
                      <TableCell>{dt(p.order_date)}</TableCell>
                      <TableCell>{dt(p.expected_date)}</TableCell>
                      <TableCell>{(itemsByPo[p.id] || []).length}</TableCell>
                      <TableCell className="text-right">{fmt(totalOf(p.id))}</TableCell>
                      <TableCell>{statusBadge(p.status)}</TableCell>
                      <TableCell className="space-x-1 text-right" onClick={e => e.stopPropagation()}>
                        {canWrite && <Button size="sm" variant="outline" onClick={() => openPo(p)}>Bearbeiten</Button>}
                        <Button size="sm" variant="outline" onClick={() => downloadPdf(p)}><FileDown className="mr-1 h-3 w-3" />PDF</Button>
                        {canWrite && p.status !== 'entwurf' && p.status !== 'storniert' && (
                          <Button size="sm" variant="outline" disabled={sending === p.id} onClick={() => sendPo(p)}>
                            {sending === p.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Mail className="mr-1 h-3 w-3" />}E-Mail
                          </Button>
                        )}
                        {canWrite && p.status === 'freigegeben' && (
                          <Button size="sm" onClick={() => setStatus(p, 'bestellt')}><Send className="mr-1 h-3 w-3" />Bestellen</Button>
                        )}
                        {canWrite && p.status === 'entwurf' && (
                          <Button size="sm" onClick={() => setStatus(p, 'freigegeben')}>Freigeben</Button>
                        )}
                        {canWrite && ['bestellt', 'teilgeliefert'].includes(p.status) && (
                          <Button size="sm" onClick={() => setStatus(p, 'geliefert')}><PackageCheck className="mr-1 h-3 w-3" />Geliefert</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!rows.length && (
                    <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">Keine Bestellungen vorhanden.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bestellkopf */}
      <Dialog open={poOpen} onOpenChange={setPoOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{form.id ? 'Bestellung bearbeiten' : 'Neue Bestellung'}</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label>Lieferant</Label>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.supplier_id || ''} onChange={e => setForm({ ...form, supplier_id: e.target.value })}>
                <option value="">— wählen —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{[s.supplier_number, s.name].filter(Boolean).join(' · ')}</option>)}
              </select>
            </div>
            <div className="space-y-1"><Label>Bestellnummer</Label><Input value={form.po_number || ''} onChange={e => setForm({ ...form, po_number: e.target.value })} placeholder="automatisch" /></div>
            <div className="space-y-1">
              <Label>Status</Label>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.status || 'entwurf'} onChange={e => setForm({ ...form, status: e.target.value })}>
                {PO_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-1"><Label>Bestelldatum</Label><Input type="date" value={form.order_date || ''} onChange={e => setForm({ ...form, order_date: e.target.value })} /></div>
            <div className="space-y-1"><Label>Liefertermin</Label><Input type="date" value={form.expected_date || ''} onChange={e => setForm({ ...form, expected_date: e.target.value })} /></div>
            <div className="space-y-1 sm:col-span-2"><Label>Kontakt-E-Mail</Label><Input value={form.contact_email || ''} onChange={e => setForm({ ...form, contact_email: e.target.value })} /></div>
            <div className="space-y-1 sm:col-span-2"><Label>Notizen</Label><Textarea value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPoOpen(false)}>Abbrechen</Button>
            <Button onClick={savePo} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Positionen */}
      <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Positionen — {detail?.po_number} · {supplierMap[detail?.supplier_id]?.name}</DialogTitle>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pos.</TableHead><TableHead>Teil</TableHead><TableHead>Beschreibung</TableHead>
                <TableHead className="text-right">Menge</TableHead><TableHead className="text-right">Preis</TableHead>
                <TableHead className="text-right">Summe</TableHead><TableHead className="text-right">Geliefert</TableHead><TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {detailItems.map((it, idx) => (
                <TableRow key={it.id}>
                  <TableCell>{it.position_no ?? idx + 1}</TableCell>
                  <TableCell className="font-mono text-xs">{partMap[it.part_id]?.part_number || '—'}</TableCell>
                  <TableCell>{it.description || partMap[it.part_id]?.name || '—'}</TableCell>
                  <TableCell className="text-right">{num(it.quantity)} {it.unit}</TableCell>
                  <TableCell className="text-right">{fmt(num(it.price))}</TableCell>
                  <TableCell className="text-right">{fmt(num(it.quantity) * num(it.price))}</TableCell>
                  <TableCell className="text-right">{num(it.received_quantity)}</TableCell>
                  <TableCell className="space-x-1 text-right">
                    {canWrite && num(it.received_quantity) < num(it.quantity) && (
                      <Button size="sm" variant="outline" onClick={() => receiveItem(it)}>WE</Button>
                    )}
                    {canDelete && <Button size="sm" variant="ghost" onClick={() => removeItem(it.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </TableCell>
                </TableRow>
              ))}
              {!detailItems.length && (
                <TableRow><TableCell colSpan={8} className="py-6 text-center text-muted-foreground">Noch keine Positionen.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>

          {canWrite && (
            <div className="grid items-end gap-2 sm:grid-cols-5">
              <div className="space-y-1 sm:col-span-2">
                <Label>Teil</Label>
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={itemForm.part_id || ''} onChange={e => onPickPart(e.target.value)}>
                  <option value="">— wählen —</option>
                  {parts.map(p => <option key={p.id} value={p.id}>{[p.part_number, p.name].filter(Boolean).join(' · ')}</option>)}
                </select>
              </div>
              <div className="space-y-1"><Label>Menge</Label><Input type="number" value={itemForm.quantity} onChange={e => setItemForm({ ...itemForm, quantity: e.target.value })} /></div>
              <div className="space-y-1"><Label>Preis</Label><Input type="number" step="0.01" value={itemForm.price} onChange={e => setItemForm({ ...itemForm, price: e.target.value })} /></div>
              <Button onClick={addItem}><Plus className="mr-2 h-4 w-4" />Position</Button>
            </div>
          )}

          <div className="text-right text-sm text-muted-foreground">
            Gesamt: <span className="font-semibold text-foreground">{fmt(detail ? totalOf(detail.id) : 0)}</span>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

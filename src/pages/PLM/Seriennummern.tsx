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
import { Barcode, Plus, Search, Loader2, Wand2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const WRITE_ROLES = ['Super Admin', 'Admin', 'Geschäftsführung', 'Medical', 'Produktion', 'QM'];
const SER_STATUS = ['produziert', 'geprueft', 'freigegeben', 'ausgeliefert', 'gesperrt', 'verschrottet'];
const dt = (v?: string | null) => (v ? new Date(v).toLocaleDateString('de-DE') : '—');

export default function PlmSeriennummern() {
  const { roles } = useAuth();
  const canWrite = (roles || []).some((r: string) => WRITE_ROLES.includes(r));

  const [records, setRecords] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [genOpen, setGenOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({});
  const [gen, setGen] = useState<any>({ prefix: '', start: 1, count: 1, digits: 4 });

  const load = useCallback(async () => {
    setLoading(true);
    const [r, o, d] = await Promise.all([
      supabase.from('plm_serial_records' as any).select('*').order('created_at', { ascending: false }).limit(2000),
      supabase.from('plm_production_orders' as any).select('id,order_number,device_id,quantity,status,batch_number').limit(1000),
      supabase.from('plm_devices' as any).select('id,name,article_number,udi_di').limit(500),
    ]);
    const err = r.error || o.error || d.error;
    if (err) toast.error(err.message);
    setRecords((r.data as any[]) || []);
    setOrders((o.data as any[]) || []);
    setDevices((d.data as any[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const deviceMap = useMemo(() => Object.fromEntries(devices.map(d => [d.id, d])), [devices]);
  const orderMap = useMemo(() => Object.fromEntries(orders.map(o => [o.id, o])), [orders]);

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return records;
    return records.filter(r => {
      const extra = (deviceMap[r.device_id]?.name || '') + (orderMap[r.production_order_id]?.order_number || '');
      return (JSON.stringify(r) + extra).toLowerCase().includes(s);
    });
  }, [records, search, deviceMap, orderMap]);

  function openNew() {
    setForm({ produced_at: new Date().toISOString().slice(0, 10), status: 'produziert' });
    setOpen(true);
  }

  async function save() {
    if (!form.serial_number) { toast.error('Seriennummer fehlt'); return; }
    setSaving(true);
    const payload: any = {
      serial_number: form.serial_number,
      device_id: form.device_id || null,
      production_order_id: form.production_order_id || null,
      batch_number: form.batch_number || null,
      lot_number: form.lot_number || null,
      udi_pi: form.udi_pi || null,
      produced_at: form.produced_at || null,
      status: form.status || 'produziert',
      notes: form.notes || null,
    };
    const { error } = form.id
      ? await (supabase.from('plm_serial_records' as any) as any).update(payload).eq('id', form.id)
      : await (supabase.from('plm_serial_records' as any) as any).insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Gespeichert');
    setOpen(false);
    load();
  }

  function openGen() {
    setGen({ prefix: '', start: 1, count: 1, digits: 4, produced_at: new Date().toISOString().slice(0, 10) });
    setGenOpen(true);
  }

  function onPickOrder(id: string) {
    const o = orderMap[id];
    setGen((g: any) => ({
      ...g,
      production_order_id: id,
      device_id: o?.device_id || '',
      batch_number: o?.batch_number || '',
      count: Number(o?.quantity) || g.count,
      prefix: g.prefix || `${(deviceMap[o?.device_id]?.article_number || 'SN')}-`,
    }));
  }

  async function generate() {
    const count = Number(gen.count) || 0;
    if (!count) { toast.error('Anzahl fehlt'); return; }
    setSaving(true);
    const start = Number(gen.start) || 1;
    const digits = Number(gen.digits) || 4;
    const payload = Array.from({ length: count }, (_, i) => ({
      serial_number: `${gen.prefix || ''}${String(start + i).padStart(digits, '0')}`,
      device_id: gen.device_id || null,
      production_order_id: gen.production_order_id || null,
      batch_number: gen.batch_number || null,
      lot_number: gen.lot_number || null,
      udi_pi: gen.batch_number ? `10${gen.batch_number}` : null,
      produced_at: gen.produced_at || null,
      status: 'produziert',
    }));
    const { error } = await (supabase.from('plm_serial_records' as any) as any).insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${count} Seriennummern erzeugt`);
    setGenOpen(false);
    load();
  }

  async function setStatus(row: any, status: string) {
    const { error } = await (supabase.from('plm_serial_records' as any) as any).update({ status }).eq('id', row.id);
    if (error) { toast.error(error.message); return; }
    load();
  }

  const badge = (s: string) => {
    const cls = ['freigegeben', 'ausgeliefert'].includes(s) ? 'border-emerald-500/40 text-emerald-500'
      : ['gesperrt', 'verschrottet'].includes(s) ? 'border-destructive/50 text-destructive'
      : 'border-amber-500/40 text-amber-500';
    return <Badge variant="outline" className={cls}>{s}</Badge>;
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Serien- & Chargenvergabe"
        subtitle="Vergabe und Verwaltung von Seriennummern, Chargen und UDI-PI je Produktionsauftrag."
        icon={Barcode}
      />

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Suche Seriennummer, Charge, Gerät, Auftrag…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {canWrite && <Button variant="outline" onClick={openGen}><Wand2 className="mr-2 h-4 w-4" />Serie erzeugen</Button>}
            {canWrite && <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Einzeln</Button>}
          </div>

          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Seriennummer</TableHead>
                    <TableHead>Gerät</TableHead>
                    <TableHead>Produktionsauftrag</TableHead>
                    <TableHead>Charge</TableHead>
                    <TableHead>Los</TableHead>
                    <TableHead>UDI-PI</TableHead>
                    <TableHead>Produziert</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aktion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 500).map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.serial_number}</TableCell>
                      <TableCell>{deviceMap[r.device_id]?.name || '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{orderMap[r.production_order_id]?.order_number || '—'}</TableCell>
                      <TableCell>{r.batch_number || '—'}</TableCell>
                      <TableCell>{r.lot_number || '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{r.udi_pi || '—'}</TableCell>
                      <TableCell>{dt(r.produced_at)}</TableCell>
                      <TableCell>{badge(r.status)}</TableCell>
                      <TableCell className="text-right">
                        {canWrite && (
                          <select
                            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                            value={r.status}
                            onChange={e => setStatus(r, e.target.value)}
                          >
                            {SER_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!rows.length && (
                    <TableRow><TableCell colSpan={9} className="py-8 text-center text-muted-foreground">Keine Seriennummern vergeben.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Einzelne Seriennummer */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Seriennummer</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2"><Label>Seriennummer</Label><Input value={form.serial_number || ''} onChange={e => setForm({ ...form, serial_number: e.target.value })} /></div>
            <div className="space-y-1">
              <Label>Gerät</Label>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.device_id || ''} onChange={e => setForm({ ...form, device_id: e.target.value })}>
                <option value="">— wählen —</option>
                {devices.map(d => <option key={d.id} value={d.id}>{[d.article_number, d.name].filter(Boolean).join(' · ')}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Produktionsauftrag</Label>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.production_order_id || ''} onChange={e => setForm({ ...form, production_order_id: e.target.value })}>
                <option value="">— wählen —</option>
                {orders.map(o => <option key={o.id} value={o.id}>{o.order_number}</option>)}
              </select>
            </div>
            <div className="space-y-1"><Label>Charge</Label><Input value={form.batch_number || ''} onChange={e => setForm({ ...form, batch_number: e.target.value })} /></div>
            <div className="space-y-1"><Label>Los</Label><Input value={form.lot_number || ''} onChange={e => setForm({ ...form, lot_number: e.target.value })} /></div>
            <div className="space-y-1"><Label>UDI-PI</Label><Input value={form.udi_pi || ''} onChange={e => setForm({ ...form, udi_pi: e.target.value })} /></div>
            <div className="space-y-1"><Label>Produziert am</Label><Input type="date" value={form.produced_at || ''} onChange={e => setForm({ ...form, produced_at: e.target.value })} /></div>
            <div className="space-y-1">
              <Label>Status</Label>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.status || 'produziert'} onChange={e => setForm({ ...form, status: e.target.value })}>
                {SER_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2"><Label>Notizen</Label><Textarea value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Seriengenerator */}
      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Seriennummern erzeugen</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label>Produktionsauftrag</Label>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={gen.production_order_id || ''} onChange={e => onPickOrder(e.target.value)}>
                <option value="">— wählen —</option>
                {orders.map(o => <option key={o.id} value={o.id}>{o.order_number} · {deviceMap[o.device_id]?.name || ''} ({o.quantity} Stk)</option>)}
              </select>
            </div>
            <div className="space-y-1"><Label>Präfix</Label><Input value={gen.prefix || ''} onChange={e => setGen({ ...gen, prefix: e.target.value })} /></div>
            <div className="space-y-1"><Label>Startnummer</Label><Input type="number" value={gen.start} onChange={e => setGen({ ...gen, start: e.target.value })} /></div>
            <div className="space-y-1"><Label>Anzahl</Label><Input type="number" value={gen.count} onChange={e => setGen({ ...gen, count: e.target.value })} /></div>
            <div className="space-y-1"><Label>Stellen</Label><Input type="number" value={gen.digits} onChange={e => setGen({ ...gen, digits: e.target.value })} /></div>
            <div className="space-y-1"><Label>Charge</Label><Input value={gen.batch_number || ''} onChange={e => setGen({ ...gen, batch_number: e.target.value })} /></div>
            <div className="space-y-1"><Label>Los</Label><Input value={gen.lot_number || ''} onChange={e => setGen({ ...gen, lot_number: e.target.value })} /></div>
            <div className="space-y-1 sm:col-span-2"><Label>Produziert am</Label><Input type="date" value={gen.produced_at || ''} onChange={e => setGen({ ...gen, produced_at: e.target.value })} /></div>
            <p className="text-xs text-muted-foreground sm:col-span-2">
              Beispiel: {`${gen.prefix || ''}${String(Number(gen.start) || 1).padStart(Number(gen.digits) || 4, '0')}`}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenOpen(false)}>Abbrechen</Button>
            <Button onClick={generate} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Erzeugen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

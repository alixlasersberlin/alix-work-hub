import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { sbRepair } from '@/lib/repair/api';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, RefreshCw, Package, ExternalLink, ShoppingCart, Pencil } from 'lucide-react';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';

const STATUSES = ['Bestellvorschlag', 'offen', 'bestellt', 'erhalten', 'storniert'];

const PRIORITY_BADGE: Record<string, string> = {
  dringend: 'bg-destructive/15 text-destructive border-destructive/30',
  hoch: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  normal: 'bg-muted text-foreground border-border',
  niedrig: 'bg-muted text-muted-foreground border-border',
};

const STATUS_BADGE: Record<string, string> = {
  Bestellvorschlag: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  offen: 'bg-muted text-foreground border-border',
  bestellt: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
  erhalten: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
  storniert: 'bg-destructive/15 text-destructive border-destructive/30',
};

export default function BestellwesenErsatzteile() {
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('Bestellvorschlag');
  const [q, setQ] = useState('');
  const { hasAnyRole, profile } = useAuth();
  const isNatalia = (profile?.full_name || '').toLowerCase().includes('natalia')
    || (profile?.email || '').toLowerCase().includes('natalia');
  const canEditProposal = hasAnyRole(['Super Admin', 'Admin']) || isNatalia;
  const [editRow, setEditRow] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [savingEdit, setSavingEdit] = useState(false);

  const openEdit = (r: any) => {
    setEditRow(r);
    setEditForm({
      part_name: r.part_name || '',
      part_number: r.part_number || '',
      quantity: r.quantity ?? 1,
      supplier: r.supplier || '',
      priority: r.priority || 'normal',
      notes: r.notes || '',
    });
  };

  const saveEdit = async () => {
    if (!editRow) return;
    setSavingEdit(true);
    const { error } = await sbRepair.from('repair_spare_parts').update({
      part_name: editForm.part_name,
      part_number: editForm.part_number || null,
      quantity: Number(editForm.quantity) || 1,
      supplier: editForm.supplier || null,
      priority: editForm.priority,
      notes: editForm.notes || null,
    }).eq('id', editRow.id);
    setSavingEdit(false);
    if (error) return toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    toast({ title: 'Bestellvorschlag aktualisiert' });
    setEditRow(null);
    load();
  };

  const load = useCallback(async () => {
    setLoading(true);
    let query = sbRepair
      .from('repair_spare_parts')
      .select('*, repair_orders!inner(id, repair_number, repair_status, customer_name, device_brand, device_model, device_category, device_serial_number)')
      .order('created_at', { ascending: false })
      .limit(500);
    if (statusFilter !== 'alle') query = query.eq('status', statusFilter);
    const { data, error } = await query;
    if (error) toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    setRows(data || []);
    setLoading(false);
  }, [statusFilter, toast]);

  useEffect(() => { load(); }, [load]);

  const [triggering, setTriggering] = useState<string | null>(null);

  const setStatus = async (id: string, status: string) => {
    const patch: any = { status };
    if (status === 'bestellt') patch.ordered_at = new Date().toISOString();
    if (status === 'erhalten') patch.received_at = new Date().toISOString();
    const { error } = await sbRepair.from('repair_spare_parts').update(patch).eq('id', id);
    if (error) return toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    toast({ title: 'Status aktualisiert', description: `→ ${status}` });
    load();
  };

  const triggerOrder = async (r: any) => {
    setTriggering(r.id);
    try {
      // Reparatur-Bestellung: keine Freigabe nötig → direkt Status 'offen' ("Bestellung möglich")
      const repairNo = r.repair_orders?.repair_number || r.repair_order_id?.slice(0, 8) || '';
      const { data: order, error } = await (supabase.from('spare_part_orders' as any) as any).insert({
        supplier_name: r.supplier || null,
        status: 'offen',
        notes: `Reparatur-Bestellung aus ${repairNo}${r.part_number ? ` · ${r.part_number}` : ''}${r.notes ? `\n${r.notes}` : ''}`,
      }).select().single();
      if (error || !order) throw new Error(error?.message || 'Bestellung konnte nicht angelegt werden');

      const { error: e2 } = await (supabase.from('spare_part_order_items' as any) as any).insert({
        order_id: (order as any).id,
        item_name: r.part_name || 'Ersatzteil',
        sku: r.part_number || null,
        quantity: r.quantity ?? 1,
      });
      if (e2) throw new Error(e2.message);

      // Bestellvorschlag als „bestellt" markieren und mit Bestellnummer verknüpfen
      await sbRepair.from('repair_spare_parts').update({
        status: 'bestellt',
        ordered_at: new Date().toISOString(),
        notes: [r.notes, `Bestellung ${(order as any).order_number ?? ''}`.trim()].filter(Boolean).join('\n'),
      }).eq('id', r.id);

      toast({
        title: 'Bestellung ausgelöst',
        description: `${(order as any).order_number ?? 'Bestellung'} angelegt – zu finden unter Ersatzteilmanagement → Tab „Bestellungen" (Status: offen).`,
        action: (
          <Link to="/ersatzteilmanagement" className="text-primary underline text-xs whitespace-nowrap">
            Öffnen
          </Link>
        ) as any,
      });
      load();
    } catch (e: any) {
      toast({ title: 'Fehler', description: e?.message || String(e), variant: 'destructive' });
    } finally {
      setTriggering(null);
    }
  };

  const filtered = rows.filter(r => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return (
      (r.part_name || '').toLowerCase().includes(s) ||
      (r.part_number || '').toLowerCase().includes(s) ||
      (r.supplier || '').toLowerCase().includes(s) ||
      (r.device_label || '').toLowerCase().includes(s) ||
      (r.serial_number || '').toLowerCase().includes(s) ||
      (r.ticket_number || '').toLowerCase().includes(s) ||
      (r.repair_orders?.repair_number || '').toLowerCase().includes(s)
    );
  });

  return (
    <div className="p-6 lg:p-8 space-y-6 animate-fade-in">
      <PageHeader
        icon={Package}
        title="Ersatzteil-Bestellvorschläge"
        subtitle="Bestellanforderungen aus Reparaturaufträgen"
        noBreadcrumbs
        actions={
          <>
            <Input placeholder="Suche…" value={q} onChange={e => setQ(e.target.value)} className="w-56" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle Status</SelectItem>
                {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
          </>
        }
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-3">Erstellt</th>
                <th className="text-left p-3">Reparatur</th>
                <th className="text-left p-3">Ticket</th>
                <th className="text-left p-3">Gerät / Seriennr.</th>
                <th className="text-left p-3">Teil</th>
                <th className="text-left p-3">Menge</th>
                <th className="text-left p-3">Lieferant</th>
                <th className="text-left p-3">Prio</th>
                <th className="text-left p-3">Status</th>
                <th className="text-right p-3"></th>
              </tr>
            </thead>
            <tbody>
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">Keine Bestellvorschläge.</td></tr>
              )}
              {filtered.map(r => {
                const device = r.device_label || [r.repair_orders?.device_brand, r.repair_orders?.device_model].filter(Boolean).join(' ') || r.repair_orders?.device_category || '—';
                const serial = r.serial_number || r.repair_orders?.device_serial_number || '—';
                return (
                  <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                    <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleString('de-DE')}</td>
                    <td className="p-3 font-mono text-xs">
                      <Link to={`/reparatur/${r.repair_order_id}`} className="text-primary hover:underline inline-flex items-center gap-1">
                        {r.repair_orders?.repair_number || r.repair_order_id?.slice(0, 8)}
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </td>
                    <td className="p-3 text-xs">
                      {r.ticket_id ? (
                        <Link to={`/tickets/${r.ticket_id}`} className="text-primary hover:underline inline-flex items-center gap-1">
                          {r.ticket_number || 'Ticket'}
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      ) : '—'}
                    </td>
                    <td className="p-3 text-xs">
                      <div>{device}</div>
                      <div className="text-muted-foreground font-mono">{serial}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-medium">{r.part_name}</div>
                      {r.part_number && <div className="text-xs text-muted-foreground font-mono">{r.part_number}</div>}
                      {r.notes && <div className="text-xs text-muted-foreground mt-1">{r.notes}</div>}
                    </td>
                    <td className="p-3 text-center font-mono">{r.quantity}</td>
                    <td className="p-3 text-xs">{r.supplier || '—'}</td>
                    <td className="p-3">
                      <Badge variant="outline" className={PRIORITY_BADGE[r.priority || 'normal']}>{r.priority || 'normal'}</Badge>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className={STATUS_BADGE[r.status] || ''}>{r.status}</Badge>
                    </td>
                    <td className="p-3 text-right">
                      <div className="inline-flex items-center gap-2 justify-end">
                        {r.status === 'Bestellvorschlag' && (
                          <Button
                            size="sm"
                            className="gold-gradient text-primary-foreground"
                            disabled={triggering === r.id}
                            onClick={() => triggerOrder(r)}
                            title='Bestellung anlegen und in Ersatzteilmanagement → Bestellungen übernehmen (Reparaturbestellung ohne Freigabe)'
                          >
                            {triggering === r.id
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <><ShoppingCart className="w-4 h-4 mr-1" /> Bestellung auslösen</>}
                          </Button>
                        )}
                        {r.status === 'Bestellvorschlag' && canEditProposal && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEdit(r)}
                            title="Bestellvorschlag ändern"
                          >
                            <Pencil className="w-4 h-4 mr-1" /> Ändern
                          </Button>
                        )}
                        <Select value={r.status} onValueChange={(v) => setStatus(r.id, v)}>
                          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                          <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bestellvorschlag ändern</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Teil</Label>
              <Input value={editForm.part_name || ''} onChange={e => setEditForm({ ...editForm, part_name: e.target.value })} />
            </div>
            <div>
              <Label>Teilenummer</Label>
              <Input value={editForm.part_number || ''} onChange={e => setEditForm({ ...editForm, part_number: e.target.value })} />
            </div>
            <div>
              <Label>Menge</Label>
              <Input type="number" min={1} value={editForm.quantity ?? 1} onChange={e => setEditForm({ ...editForm, quantity: e.target.value })} />
            </div>
            <div>
              <Label>Lieferant</Label>
              <Input value={editForm.supplier || ''} onChange={e => setEditForm({ ...editForm, supplier: e.target.value })} />
            </div>
            <div>
              <Label>Priorität</Label>
              <Select value={editForm.priority || 'normal'} onValueChange={(v) => setEditForm({ ...editForm, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['dringend', 'hoch', 'normal', 'niedrig'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Notiz</Label>
              <Textarea rows={3} value={editForm.notes || ''} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)}>Abbrechen</Button>
            <Button onClick={saveEdit} disabled={savingEdit} className="gold-gradient text-primary-foreground">
              {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Speichern'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

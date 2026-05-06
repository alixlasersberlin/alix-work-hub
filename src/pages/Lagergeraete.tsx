import { useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Plus, Warehouse, Link2, X, Sparkles, Package } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { z } from 'zod';
import { PageHeader } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ALIX_MODEL_GROUPS } from '@/lib/alix-models';
import OrderPickerDialog from '@/components/OrderPickerDialog';
import { useAuth } from '@/hooks/useAuth';

type LagerDevice = {
  id: string;
  serial_number: string;
  model_name: string;
  airtable_record_id: string | null;
  entry_date: string;
  notes: string | null;
  created_at: string;
  reserved_order_id: string | null;
  reservation_week: string | null;
  orders?: { id: string; order_number: string } | null;
};

function formatWeek(w: string | null | undefined): string {
  if (!w) return '—';
  const m = /^(\d{4})-W(\d{2})$/.exec(w);
  return m ? `KW ${m[2]} / ${m[1]}` : w;
}

const formSchema = z.object({
  serial_number: z.string().trim().min(1, 'Seriennummer erforderlich').max(100),
  model_name: z.string().trim().min(1, 'Modell erforderlich').max(200),
  entry_date: z.string().min(1, 'Eingangsdatum erforderlich'),
  notes: z.string().max(1000).optional().nullable(),
});

export default function Lagergeraete() {
  const { isAdmin } = useAuth();
  const [devices, setDevices] = useState<LagerDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const today = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [serial, setSerial] = useState('');
  const [modelName, setModelName] = useState<string>('');
  const [entryDate, setEntryDate] = useState(today);
  const [notes, setNotes] = useState('');
  const [reservedOrderId, setReservedOrderId] = useState<string | null>(null);
  const [reservedOrderNumber, setReservedOrderNumber] = useState<string | null>(null);
  const [originalReservedOrderId, setOriginalReservedOrderId] = useState<string | null>(null);
  const [reservationWeek, setReservationWeek] = useState<string>('');

  type Suggestion = {
    id: string;
    order_number: string;
    expected_shipment_date: string | null;
    order_status: string | null;
    customer: string;
    matched_item: string;
  };
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const reservedOrderIdsSet = useMemo(
    () => new Set(devices.map((d) => d.reserved_order_id).filter(Boolean) as string[]),
    [devices],
  );

  useEffect(() => {
    if (!open || !modelName || reservedOrderId) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingSuggestions(true);
      const norm = modelName.toLowerCase().trim();
      // Search for orders with items matching the selected model
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, order_status, expected_shipment_date, customers(company_name, contact_name), order_items(item_name, description, sku)')
        .in('order_status', ['overdue', 'Overdue', 'invoiced', 'Invoiced', 'open', 'Open', 'offen', 'Offen', 'approved', 'Approved'])
        .limit(500);
      if (cancelled) return;
      if (error) {
        setLoadingSuggestions(false);
        return;
      }
      const matched: Suggestion[] = [];
      for (const o of (data ?? []) as any[]) {
        if (reservedOrderIdsSet.has(o.id)) continue;
        const item = (o.order_items ?? []).find((it: any) => {
          const hay = `${it.item_name ?? ''} ${it.description ?? ''} ${it.sku ?? ''}`.toLowerCase();
          return hay.includes(norm);
        });
        if (!item) continue;
        matched.push({
          id: o.id,
          order_number: o.order_number,
          order_status: o.order_status,
          expected_shipment_date: o.expected_shipment_date,
          customer: o.customers?.company_name || o.customers?.contact_name || '—',
          matched_item: item.item_name || item.description || item.sku || '—',
        });
      }
      // Sort: overdue first, then earliest shipment date, then nulls last
      matched.sort((a, b) => {
        const da = a.expected_shipment_date ? new Date(a.expected_shipment_date).getTime() : Infinity;
        const db = b.expected_shipment_date ? new Date(b.expected_shipment_date).getTime() : Infinity;
        return da - db;
      });
      setSuggestions(matched.slice(0, 20));
      setLoadingSuggestions(false);
    })();
    return () => { cancelled = true; };
  }, [open, modelName, reservedOrderId, reservedOrderIdsSet]);

  const loadDevices = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('lager_devices')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast.error('Fehler beim Laden: ' + error.message);
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as any[];
    const orderIds = Array.from(new Set(rows.map((r) => r.reserved_order_id).filter(Boolean)));
    let orderMap: Record<string, { id: string; order_number: string }> = {};
    if (orderIds.length > 0) {
      const { data: ords } = await supabase
        .from('orders')
        .select('id, order_number')
        .in('id', orderIds);
      (ords ?? []).forEach((o: any) => { orderMap[o.id] = o; });
    }
    setDevices(rows.map((r) => ({ ...r, orders: r.reserved_order_id ? orderMap[r.reserved_order_id] ?? null : null })) as LagerDevice[]);
    setLoading(false);
  };

  useEffect(() => {
    loadDevices();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setSerial('');
    setModelName('');
    setEntryDate(today);
    setNotes('');
    setReservedOrderId(null);
    setReservedOrderNumber(null);
    setOriginalReservedOrderId(null);
  };

  const openEdit = (d: LagerDevice) => {
    setEditingId(d.id);
    setSerial(d.serial_number);
    setModelName(d.model_name);
    setEntryDate(d.entry_date);
    setNotes(d.notes ?? '');
    setReservedOrderId(d.reserved_order_id);
    setReservedOrderNumber(d.orders?.order_number ?? null);
    setOriginalReservedOrderId(d.reserved_order_id);
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = formSchema.safeParse({
      serial_number: serial,
      model_name: modelName,
      entry_date: entryDate,
      notes: notes || null,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Ungültige Eingabe');
      return;
    }

    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const finalReservedOrderId = reservedOrderId;

    const payload = {
      serial_number: parsed.data.serial_number,
      model_name: parsed.data.model_name,
      entry_date: parsed.data.entry_date,
      notes: parsed.data.notes ?? null,
      reserved_order_id: finalReservedOrderId,
      updated_by: userData.user?.id,
    };
    const { error } = editingId
      ? await supabase.from('lager_devices').update(payload).eq('id', editingId)
      : await supabase.from('lager_devices').insert([
          { ...payload, airtable_record_id: null, created_by: userData.user?.id },
        ]);

    if (error) {
      setSaving(false);
      toast.error('Speichern fehlgeschlagen: ' + error.message);
      return;
    }

    // If new reservation: ensure a route_plans entry exists (without date)
    if (finalReservedOrderId && finalReservedOrderId !== originalReservedOrderId) {
      const { data: existing } = await supabase
        .from('route_plans')
        .select('id')
        .eq('order_id', finalReservedOrderId)
        .limit(1);
      if (!existing || existing.length === 0) {
        const { error: rpErr } = await supabase.from('route_plans').insert([
          {
            order_id: finalReservedOrderId,
            planning_status: 'offen',
            priority: 'normal',
            planning_note: 'Automatisch erstellt: Lagergerät reserviert',
            created_by: userData.user?.id,
          },
        ]);
        if (rpErr) {
          toast.warning('Tourenplan konnte nicht angelegt werden: ' + rpErr.message);
        }
      }
    }

    // If reservation was removed: delete the auto-created route_plan(s) for that order
    // — only if no other lager device is still reserved for it and the plan has no date yet.
    if (originalReservedOrderId && finalReservedOrderId !== originalReservedOrderId) {
      const { data: stillReserved } = await supabase
        .from('lager_devices')
        .select('id')
        .eq('reserved_order_id', originalReservedOrderId)
        .limit(1);
      if (!stillReserved || stillReserved.length === 0) {
        const { error: delErr } = await supabase
          .from('route_plans')
          .delete()
          .eq('order_id', originalReservedOrderId)
          .is('planned_date', null);
        if (delErr) {
          toast.warning('Tourenplan konnte nicht entfernt werden: ' + delErr.message);
        }
      }
    }

    setSaving(false);
    toast.success(editingId ? 'Lagergerät aktualisiert' : 'Lagergerät erfasst');
    resetForm();
    setOpen(false);
    loadDevices();
  };

  

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          icon={<Warehouse className="w-6 h-6 text-primary" />}
          title="Lagergeräte"
          subtitle="Erfassung und Übersicht aller Lagergeräte"
        />
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> Neues Lagergerät
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Lagergerät bearbeiten' : 'Lagergerät erfassen'}</DialogTitle>
              <DialogDescription>
                Bitte alle Pflichtfelder ausfüllen.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="serial">Seriennummer *</Label>
                <Input
                  id="serial"
                  value={serial}
                  onChange={(e) => setSerial(e.target.value)}
                  placeholder="z. B. SN-123456"
                  maxLength={100}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Modell *</Label>
                <Select value={modelName} onValueChange={setModelName}>
                  <SelectTrigger id="model">
                    <SelectValue placeholder="Modell auswählen" />
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    {ALIX_MODEL_GROUPS.map((group) => (
                      <SelectGroup key={group.label}>
                        <SelectLabel>{group.label}</SelectLabel>
                        {group.models.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="entry-date">Eingangsdatum *</Label>
                <Input
                  id="entry-date"
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  required
                />
              </div>

              {isAdmin && (
                <div className="space-y-2">
                  <Label>Auftragszuweisung</Label>
                  {reservedOrderNumber ? (
                    <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/40 px-3 py-2">
                      <Link2 className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">{reservedOrderNumber}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="ml-auto h-7"
                        onClick={() => { setReservedOrderId(null); setReservedOrderNumber(null); setOriginalReservedOrderId(null); }}
                      >
                        <X className="w-3 h-3 mr-1" /> Reservierung freigeben
                      </Button>
                    </div>
                  ) : (
                    <Button type="button" variant="outline" onClick={() => setPickerOpen(true)} className="gap-2">
                      <Link2 className="w-4 h-4" /> Auftrag auswählen
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Bei Zuweisung wird das Gerät bis zur Auslieferung reserviert und der Auftrag erscheint in der Tourenplanung (ohne Termin).
                  </p>

                  {!reservedOrderId && modelName && (
                    <div className="mt-3 rounded-md border border-yellow-500/40 bg-yellow-500/5 p-3 space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Sparkles className="w-4 h-4 text-yellow-500" />
                        Vorschläge offene Aufträge für „{modelName}"
                        {loadingSuggestions && <Loader2 className="w-3 h-3 animate-spin" />}
                      </div>
                      {!loadingSuggestions && suggestions.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Keine offenen Aufträge mit diesem Modell gefunden.</p>
                      ) : (
                        <div className="max-h-56 overflow-y-auto divide-y divide-border rounded border border-border bg-background/40">
                          {suggestions.map((s) => {
                            const days = s.expected_shipment_date
                              ? Math.ceil((new Date(s.expected_shipment_date).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000)
                              : null;
                            const prio =
                              days === null ? 'text-muted-foreground'
                              : days < 0 ? 'text-destructive'
                              : days <= 7 ? 'text-yellow-500'
                              : 'text-muted-foreground';
                            const prioLabel =
                              days === null ? '—'
                              : days < 0 ? `${Math.abs(days)} T überfällig`
                              : days === 0 ? 'Heute'
                              : `in ${days} T`;
                            return (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => { setReservedOrderId(s.id); setReservedOrderNumber(s.order_number); }}
                                className="w-full text-left px-3 py-2 hover:bg-secondary/50 transition-colors flex items-center gap-3"
                              >
                                <Package className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-sm font-medium">{s.order_number}</span>
                                    <span className={`text-xs font-semibold ${prio}`}>{prioLabel}</span>
                                  </div>
                                  <div className="text-xs text-muted-foreground truncate">
                                    {s.customer} · {s.matched_item}
                                  </div>
                                </div>
                                <span className="text-[10px] uppercase tracking-wide text-primary">Reservieren</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="notes">Notizen (intern)</Label>
                <p className="text-xs text-muted-foreground">Nur intern sichtbar – wird nirgendwo sonst angezeigt.</p>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={1000}
                  rows={3}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Abbrechen
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Speichern
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <OrderPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(o) => {
          setReservedOrderId(o.id);
          setReservedOrderNumber(o.order_number);
        }}
      />

      <div className="rounded-lg border border-border bg-card">
        {loading ? (
          <div className="p-8 flex items-center justify-center text-muted-foreground">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Lade…
          </div>
        ) : devices.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            Noch keine Lagergeräte erfasst.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Seriennummer</TableHead>
                <TableHead>Modell</TableHead>
                <TableHead>Eingangsdatum</TableHead>
                <TableHead>Reservierter Auftrag</TableHead>
                <TableHead>Notizen (intern)</TableHead>
                <TableHead className="w-24 text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {devices.map((d) => (
                <TableRow key={d.id} className={d.reserved_order_id ? 'bg-yellow-500/10 hover:bg-yellow-500/15' : ''}>
                  <TableCell className="font-mono">{d.serial_number}</TableCell>
                  <TableCell>{d.model_name}</TableCell>
                  <TableCell>
                    {format(new Date(d.entry_date), 'dd.MM.yyyy', { locale: de })}
                  </TableCell>
                  <TableCell>
                    {d.orders?.order_number ? (
                      <Badge className="font-mono bg-yellow-500/20 text-yellow-600 dark:text-yellow-300 border border-yellow-500/40 hover:bg-yellow-500/25">
                        {d.orders.order_number}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {d.notes ?? '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(d)} className="gap-1">
                      <Pencil className="w-4 h-4" /> Bearbeiten
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

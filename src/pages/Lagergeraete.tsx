import { useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Plus, Warehouse, Link2, X, Sparkles, Package, Search, ArrowUpDown, ArrowUp, ArrowDown, Mail, Send, PackageCheck, FileDown, FileText } from 'lucide-react';
import { createPDF } from '@/lib/pdf-utils';
import autoTable from 'jspdf-autotable';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
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
import { sendCustomerShippingNotice } from '@/lib/send-customer-shipping-notice';
import OrderPickerDialog from '@/components/OrderPickerDialog';
import { useAuth } from '@/hooks/useAuth';
import { StatusBadge } from '@/components/StatusBadge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Select as BulkSelect, SelectContent as BulkSelectContent, SelectItem as BulkSelectItem, SelectTrigger as BulkSelectTrigger, SelectValue as BulkSelectValue } from '@/components/ui/select';
import { useViewMode } from '@/hooks/useViewMode';
import { ViewToggle } from '@/components/ViewToggle';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

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
  orders?: { id: string; order_number: string; customer_name?: string | null } | null;
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

type DeviceTypeFilter = 'Neugerät' | 'Leihgerät';

interface LagerDevicesPageProps {
  filterType?: DeviceTypeFilter;
  filterStatuses?: string[];
  pageTitle?: string;
  pageSubtitle?: string;
  addLabel?: string;
  dialogTitle?: string;
  emptyLabel?: string;
  pageIcon?: React.ReactNode;
  rowAccentClass?: string;
}

function getDeviceTypeFromNotes(notes: string | null | undefined): DeviceTypeFilter {
  return (notes ?? '').includes('[Typ: Leihgerät]') || (notes ?? '').includes('[Leihgerät]')
    ? 'Leihgerät'
    : 'Neugerät';
}

const DEVICE_STATUS_OPTIONS = ['Bestand', 'Produktion', 'Shell Warehouse', 'Sperre BOSS', 'Transfer', 'Hold', 'Ausgeliefert'] as const;
type DeviceStatus = typeof DEVICE_STATUS_OPTIONS[number];

// Mapping Geräte-Status → Kunden-E-Mail-Vorlage (template_key) für Bulk-Versand
const BULK_TEMPLATE_BY_STATUS: Record<string, 'customer_warehouse_prepared' | 'customer_in_production' | 'customer_in_transit' | 'customer_warehouse_received'> = {
  'Shell Warehouse': 'customer_warehouse_prepared',
  'Produktion': 'customer_in_production',
  'Transfer': 'customer_in_transit',
  'Bestand': 'customer_warehouse_received',
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isRateLimited = (msg?: string) => !!msg && /429|rate_limit|High demand/i.test(msg);

function getStatusFromNotes(notes: string | null | undefined): DeviceStatus {
  const m = /\[Status:\s*([^\]]+)\]/.exec(notes ?? '');
  const v = m?.[1]?.trim();
  return (DEVICE_STATUS_OPTIONS as readonly string[]).includes(v ?? '') ? (v as DeviceStatus) : 'Bestand';
}

export default function Lagergeraete({
  filterType,
  filterStatuses,
  pageTitle = 'Lagergeräte',
  pageSubtitle = 'Erfassung und Übersicht aller Lagergeräte',
  addLabel = 'Neues Lagergerät',
  dialogTitle = 'Lagergerät',
  emptyLabel = 'Noch keine Lagergeräte erfasst.',
  pageIcon,
  rowAccentClass,
}: LagerDevicesPageProps = {}) {
  const { isAdmin } = useAuth();
  const [devices, setDevices] = useState<LagerDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);

  const today = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [serial, setSerial] = useState('');
  const [modelName, setModelName] = useState<string>('');
  const [deviceType, setDeviceType] = useState<'Neugerät' | 'Leihgerät'>(filterType ?? 'Neugerät');
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>('Bestand');
  const [entryDate, setEntryDate] = useState(today);
  const [notes, setNotes] = useState('');
  const [reservedOrderId, setReservedOrderId] = useState<string | null>(null);
  const [reservedOrderNumber, setReservedOrderNumber] = useState<string | null>(null);
  const [originalReservedOrderId, setOriginalReservedOrderId] = useState<string | null>(null);
  const [reservationWeek, setReservationWeek] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<DeviceStatus>('Bestand');
  const [bulkApplying, setBulkApplying] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [bulkResending, setBulkResending] = useState(false);
  const [bulkSendEmail, setBulkSendEmail] = useState(true);

  // Welcher Status der aktuellen Seite ist Bulk-Versand-fähig?
  const bulkResendStatus = useMemo(
    () => (filterStatuses ?? []).find((s) => BULK_TEMPLATE_BY_STATUS[s]),
    [filterStatuses],
  );
  const bulkResendTemplateKey = bulkResendStatus ? BULK_TEMPLATE_BY_STATUS[bulkResendStatus] : null;

  const runBulkResend = async () => {
    if (!bulkResendStatus || !bulkResendTemplateKey) return;
    setBulkResending(true);
    try {
      const targets = devices.filter(
        (d) => d.reserved_order_id && getStatusFromNotes(d.notes) === bulkResendStatus,
      );
      if (targets.length === 0) {
        toast.info('Keine passenden Geräte mit Auftrag gefunden.');
        return;
      }
      let ok = 0, fail = 0;
      for (const d of targets) {
        const res = await sendCustomerShippingNotice(
          d.reserved_order_id as string,
          d.id,
          'manuell',
          bulkResendTemplateKey,
        );
        if (res.ok) ok++; else { fail++; console.warn('Bulk-Versand Fehler', d, res.message); }
      }
      toast.success(`Versendet: ${ok} · Fehler: ${fail}`);
    } catch (e: any) {
      toast.error('Bulk-Versand fehlgeschlagen: ' + (e?.message || 'Unbekannter Fehler'));
    } finally {
      setBulkResending(false);
    }
  };

  // Global search across devices and available (unreserved) open orders
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'serial_number' | 'model_name' | 'entry_date' | 'order_number' | 'status' | 'notes'>('serial_number');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useViewMode();
  type FreeOrder = {
    id: string;
    order_number: string;
    order_status: string | null;
    expected_shipment_date: string | null;
    customer: string;
    matched_item?: string;
  };
  const [freeOrders, setFreeOrders] = useState<FreeOrder[]>([]);
  const [loadingFreeOrders, setLoadingFreeOrders] = useState(false);

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

  const typeFilteredDevices = useMemo(() => {
    const allowed = (filterStatuses ?? ['Bestand']).map((s) => s.toLowerCase());
    const isWarehouse = (filterStatuses ?? []).includes('Shell Warehouse');
    let base = devices.filter((d) => allowed.includes(getStatusFromNotes(d.notes).toLowerCase()));
    // Reservierte Geräte werden im Warehouse ausgeblendet – sie erscheinen in „Bestellungen möglich".
    if (isWarehouse) base = base.filter((d) => !d.reserved_order_id);
    if (!filterType) return base;
    return base.filter((d) => getDeviceTypeFromNotes(d.notes) === filterType);
  }, [devices, filterType, filterStatuses]);

  const filteredDevices = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return typeFilteredDevices;
    return typeFilteredDevices.filter((d) => {
      const hay = `${d.serial_number ?? ''} ${d.model_name ?? ''} ${d.notes ?? ''} ${d.orders?.order_number ?? ''} ${d.reservation_week ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [typeFilteredDevices, searchQuery]);

  const sortedDevices = useMemo(() => {
    const arr = [...filteredDevices];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      let av: any; let bv: any;
      switch (sortField) {
        case 'serial_number': av = a.serial_number ?? ''; bv = b.serial_number ?? ''; break;
        case 'model_name': av = a.model_name ?? ''; bv = b.model_name ?? ''; break;
        case 'entry_date': av = a.entry_date ?? ''; bv = b.entry_date ?? ''; break;
        case 'order_number': av = a.orders?.order_number ?? ''; bv = b.orders?.order_number ?? ''; break;
        case 'status': av = getStatusFromNotes(a.notes); bv = getStatusFromNotes(b.notes); break;
        case 'notes': av = a.notes ?? ''; bv = b.notes ?? ''; break;
      }
      return String(av).localeCompare(String(bv), 'de', { numeric: true, sensitivity: 'base' }) * dir;
    });
    return arr;
  }, [filteredDevices, sortField, sortDir]);

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
  };

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-50" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />;
  };

  // Search free (unreserved) open orders matching the query
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setFreeOrders([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoadingFreeOrders(true);
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, order_status, expected_shipment_date, customers(company_name, contact_name), order_items(item_name, description, sku)')
        .in('order_status', ['overdue', 'Overdue', 'invoiced', 'Invoiced', 'open', 'Open', 'offen', 'Offen', 'approved', 'Approved'])
        .limit(500);
      if (cancelled) return;
      if (error) { setLoadingFreeOrders(false); return; }
      const norm = q.toLowerCase();
      const matched: FreeOrder[] = [];
      for (const o of (data ?? []) as any[]) {
        if (reservedOrderIdsSet.has(o.id)) continue;
        const customer = o.customers?.company_name || o.customers?.contact_name || '—';
        const matchedItem = (o.order_items ?? []).find((it: any) =>
          `${it.item_name ?? ''} ${it.description ?? ''} ${it.sku ?? ''}`.toLowerCase().includes(norm),
        );
        const inHeader = `${o.order_number ?? ''} ${customer}`.toLowerCase().includes(norm);
        if (!matchedItem && !inHeader) continue;
        matched.push({
          id: o.id,
          order_number: o.order_number,
          order_status: o.order_status,
          expected_shipment_date: o.expected_shipment_date,
          customer,
          matched_item: matchedItem?.item_name || matchedItem?.description || matchedItem?.sku,
        });
      }
      matched.sort((a, b) => {
        const da = a.expected_shipment_date ? new Date(a.expected_shipment_date).getTime() : Infinity;
        const db = b.expected_shipment_date ? new Date(b.expected_shipment_date).getTime() : Infinity;
        return da - db;
      });
      setFreeOrders(matched.slice(0, 30));
      setLoadingFreeOrders(false);
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [searchQuery, reservedOrderIdsSet]);

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
    let orderMap: Record<string, { id: string; order_number: string; customer_name?: string | null }> = {};
    if (orderIds.length > 0) {
      const { data: ords } = await supabase
        .from('orders')
        .select('id, order_number, customers(company_name, contact_name)')
        .in('id', orderIds);
      (ords ?? []).forEach((o: any) => {
        orderMap[o.id] = {
          id: o.id,
          order_number: o.order_number,
          customer_name: o.customers?.company_name || o.customers?.contact_name || null,
        };
      });
    }
    setDevices(rows.map((r) => ({ ...r, orders: r.reserved_order_id ? orderMap[r.reserved_order_id] ?? null : null })) as LagerDevice[]);
    setLoading(false);
  };

  useEffect(() => {
    loadDevices();
  }, []);

  type ModelOption = { name: string; sku?: string | null };
  const [extraModelGroups, setExtraModelGroups] = useState<{ label: string; models: ModelOption[] }[]>([]);

  useEffect(() => {
    (async () => {
      const knownModels = new Set<string>();
      ALIX_MODEL_GROUPS.forEach((g) => g.models.forEach((m) => knownModels.add(m.toLowerCase())));

      const { data: items } = await supabase
        .from('zoho_items')
        .select('name, sku, category_name, brand, manufacturer')
        .order('name', { ascending: true })
        .limit(2000);

      const { data: existing } = await supabase
        .from('lager_devices')
        .select('model_name')
        .limit(2000);

      const byCategory = new Map<string, Map<string, ModelOption>>();
      const addTo = (cat: string, opt: ModelOption) => {
        const key = (opt.name ?? '').trim();
        if (!key) return;
        if (!byCategory.has(cat)) byCategory.set(cat, new Map());
        const map = byCategory.get(cat)!;
        if (!map.has(key.toLowerCase())) map.set(key.toLowerCase(), { name: key, sku: opt.sku ?? null });
      };

      (items ?? []).forEach((it: any) => {
        const name = (it.name ?? '').trim();
        if (!name) return;
        const cat = (it.category_name || it.brand || it.manufacturer || 'Weitere Artikel').toString();
        const isAlixLasers = /alix\s*lasers?/i.test(cat);
        if (!isAlixLasers && knownModels.has(name.toLowerCase())) return;
        addTo(isAlixLasers ? 'Alix Lasers (Artikel)' : cat, { name, sku: it.sku });
      });

      const internal = new Map<string, ModelOption>();
      (existing ?? []).forEach((d: any) => {
        const n = (d.model_name ?? '').trim();
        if (n && !knownModels.has(n.toLowerCase())) internal.set(n.toLowerCase(), { name: n });
      });
      byCategory.forEach((m) => m.forEach((_, k) => internal.delete(k)));
      if (internal.size > 0) byCategory.set('Interne Modelle', internal);

      const groups = Array.from(byCategory.entries())
        .map(([label, map]) => ({
          label,
          models: Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name)),
        }))
        .sort((a, b) => {
          if (a.label === 'Interne Modelle') return 1;
          if (b.label === 'Interne Modelle') return -1;
          return a.label.localeCompare(b.label);
        });
      setExtraModelGroups(groups);
    })();
  }, [devices.length]);

  const resetForm = () => {
    setEditingId(null);
    setSerial('');
    setModelName('');
    setDeviceType(filterType ?? 'Neugerät');
    setDeviceStatus('Bestand');
    setEntryDate(today);
    setNotes('');
    setReservedOrderId(null);
    setReservedOrderNumber(null);
    setOriginalReservedOrderId(null);
    setReservationWeek('');
  };

  const openEdit = (d: LagerDevice) => {
    setEditingId(d.id);
    setSerial(d.serial_number);
    setModelName(d.model_name);
    setDeviceType(getDeviceTypeFromNotes(d.notes));
    setDeviceStatus(getStatusFromNotes(d.notes));
    setEntryDate(d.entry_date);
    setNotes(d.notes ?? '');
    setReservedOrderId(d.reserved_order_id);
    setReservedOrderNumber(d.orders?.order_number ?? null);
    setOriginalReservedOrderId(d.reserved_order_id);
    setReservationWeek(d.reservation_week ?? '');
    setOpen(true);
  };

  const markAsDelivered = async (d: LagerDevice) => {
    if (!confirm(`Gerät "${d.serial_number}" als ausgeliefert markieren?\n\nEs wird aus dem Bestand entfernt und unter „Ausgeliefert" geführt.`)) return;
    const typPart = getDeviceTypeFromNotes(d.notes) === 'Leihgerät' ? '[Typ: Leihgerät] ' : '[Typ: Neugerät] ';
    const rest = (d.notes ?? '')
      .replace(/\s*\[Status:\s*[^\]]+\]\s*/g, ' ')
      .replace(/\s*\[Typ:\s*[^\]]+\]\s*/g, ' ')
      .replace(/\s*\[Leihgerät\]\s*/g, ' ')
      .trim();
    const newNotes = `${typPart}[Status: Ausgeliefert]${rest ? ' ' + rest : ''}`;
    const { error } = await supabase
      .from('lager_devices')
      .update({ notes: newNotes })
      .eq('id', d.id);
    if (error) {
      toast.error('Fehler: ' + error.message);
      return;
    }
    setDevices((prev) => prev.map((x) => x.id === d.id ? { ...x, notes: newNotes } : x));
    toast.success(`Gerät ${d.serial_number} als ausgeliefert markiert.`);
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

    const cleanedNotes = (parsed.data.notes ?? '')
      .replace(/\s*\[Typ:\s*(Neugerät|Leihgerät)\]\s*/g, ' ')
      .replace(/\s*\[Status:\s*[^\]]+\]\s*/g, ' ')
      .trim();
    const notesWithType = `[Typ: ${deviceType}] [Status: ${deviceStatus}]${cleanedNotes ? ' ' + cleanedNotes : ''}`;
    const payload = {
      serial_number: parsed.data.serial_number,
      model_name: parsed.data.model_name,
      entry_date: parsed.data.entry_date,
      notes: notesWithType,
      reserved_order_id: finalReservedOrderId,
      reservation_week: finalReservedOrderId ? (reservationWeek || null) : null,
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

    // Notify customer when an order is freshly assigned to a device
    if (finalReservedOrderId && finalReservedOrderId !== originalReservedOrderId) {
      const tplKey = deviceStatus === 'Transfer'
        ? 'customer_in_transit'
        : deviceStatus === 'Produktion'
          ? 'customer_in_production'
          : deviceStatus === 'Shell Warehouse'
            ? 'customer_warehouse_prepared'
            : 'customer_warehouse_received';
      const res = await sendCustomerShippingNotice(finalReservedOrderId, editingId ?? undefined, 'automatisch', tplKey);
      if (res.ok) toast.success('Kunden-E-Mail versendet');
      else toast.warning('Kunden-E-Mail nicht versendet: ' + res.message);
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
          icon={pageIcon ?? <Warehouse className="w-6 h-6 text-primary" />}
          title={pageTitle}
          subtitle={pageSubtitle}
        />
        <div className="flex items-center gap-2">
          {isAdmin && bulkResendStatus && bulkResendTemplateKey && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="gap-2" disabled={bulkResending}>
                  {bulkResending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Erneut an alle senden
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>E-Mail erneut an alle Kunden senden?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Versendet die zugeordnete Vorlage manuell an alle Kunden, deren reservierte Geräte aktuell den Status
                    <strong> "{bulkResendStatus}"</strong> haben. Aktion kann nicht rückgängig gemacht werden.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                  <AlertDialogAction onClick={runBulkResend}>Jetzt versenden</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> {addLabel}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? `${dialogTitle} bearbeiten` : `${dialogTitle} erfassen`}</DialogTitle>
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
                <Popover open={modelPickerOpen} onOpenChange={setModelPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="model"
                      type="button"
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between font-normal"
                    >
                      <span className="truncate">{modelName || 'Modell auswählen'}</span>
                      <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command
                      filter={(value, search) => {
                        if (!search) return 1;
                        return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
                      }}
                    >
                      <CommandInput placeholder="Suche nach Name oder SKU…" />
                      <CommandList className="max-h-72">
                        <CommandEmpty>Keine Treffer.</CommandEmpty>
                        {ALIX_MODEL_GROUPS.map((group) => (
                          <CommandGroup key={group.label} heading={group.label}>
                            {group.models.map((m) => (
                              <CommandItem
                                key={m}
                                value={m}
                                onSelect={() => { setModelName(m); setModelPickerOpen(false); }}
                              >
                                {m}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        ))}
                        {extraModelGroups.map((group) => (
                          <CommandGroup key={`extra-${group.label}`} heading={group.label}>
                            {group.models.map((m) => (
                              <CommandItem
                                key={`${group.label}-${m.name}`}
                                value={`${m.name} ${m.sku ?? ''}`}
                                onSelect={() => { setModelName(m.name); setModelPickerOpen(false); }}
                              >
                                <div className="flex w-full items-center justify-between gap-2">
                                  <span className="truncate">{m.name}</span>
                                  {m.sku && (
                                    <span className="text-xs text-muted-foreground shrink-0">{m.sku}</span>
                                  )}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        ))}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="device-type">Gerätetyp *</Label>
                <Select value={deviceType} onValueChange={(v) => setDeviceType(v as 'Neugerät' | 'Leihgerät')}>
                  <SelectTrigger id="device-type">
                    <SelectValue placeholder="Typ auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Neugerät">Neugerät</SelectItem>
                    <SelectItem value="Leihgerät">Leihgerät</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="device-status">Status *</Label>
                <Select value={deviceStatus} onValueChange={(v) => setDeviceStatus(v as DeviceStatus)}>
                  <SelectTrigger id="device-status">
                    <SelectValue placeholder="Status auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEVICE_STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
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
                  {reservedOrderId && (
                    <div className="space-y-1 pt-2">
                      <Label htmlFor="reservation-week" className="text-xs">Kalenderwoche der Reservierung</Label>
                      <Input
                        id="reservation-week"
                        type="week"
                        value={reservationWeek}
                        onChange={(e) => setReservationWeek(e.target.value)}
                      />
                    </div>
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
      </div>

      <OrderPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(o) => {
          setReservedOrderId(o.id);
          setReservedOrderNumber(o.order_number);
        }}
      />

      {/* Statistik-Übersicht */}
      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-blue-500/20 flex items-center justify-center">
              <Warehouse className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-blue-500/80 font-medium">Geräte im Lager</div>
              <div className="text-2xl font-display font-bold text-blue-500">{typeFilteredDevices.length}</div>
            </div>
          </div>
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-amber-500/20 flex items-center justify-center">
              <Link2 className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-amber-500/80 font-medium">Reserviert</div>
              <div className="text-2xl font-display font-bold text-amber-500">{typeFilteredDevices.filter(d => d.reserved_order_id).length}</div>
            </div>
          </div>
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-emerald-500/20 flex items-center justify-center">
              <Package className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-emerald-500/80 font-medium">Verfügbar</div>
              <div className="text-2xl font-display font-bold text-emerald-500">{typeFilteredDevices.filter(d => !d.reserved_order_id).length}</div>
            </div>
          </div>
        </div>
      )}

      {/* Suchleiste */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Suche Geräte (Seriennummer, Modell, Notiz, Auftrag…) oder freie Aufträge"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Suche zurücksetzen"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <ViewToggle value={viewMode} onChange={setViewMode} />
        </div>

        {searchQuery.trim().length >= 2 && isAdmin && (
          <div className="rounded-lg border border-border bg-card p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="w-4 h-4 text-yellow-500" />
              Freie Aufträge passend zu „{searchQuery}"
              {loadingFreeOrders && <Loader2 className="w-3 h-3 animate-spin" />}
            </div>
            {!loadingFreeOrders && freeOrders.length === 0 ? (
              <p className="text-xs text-muted-foreground">Keine freien Aufträge gefunden.</p>
            ) : (
              <div className="max-h-64 overflow-y-auto divide-y divide-border rounded border border-border bg-background/40">
                {freeOrders.map((o) => (
                  <div key={o.id} className="px-3 py-2 flex items-center gap-3">
                    <Package className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium">{o.order_number}</span>
                        <span className="text-xs text-muted-foreground capitalize">{o.order_status || '—'}</span>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {o.customer}{o.matched_item ? ` · ${o.matched_item}` : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="flex items-center gap-3 px-1">
          <Switch
            id="selection-mode"
            checked={selectionMode}
            onCheckedChange={(v) => {
              setSelectionMode(v);
              if (!v) setSelectedIds(new Set());
            }}
          />
          <label htmlFor="selection-mode" className="text-sm font-medium cursor-pointer select-none">
            Markierung aktivieren
          </label>
          {selectionMode && (
            <span className="text-xs text-muted-foreground">
              Mehrfachauswahl ist aktiv – wähle Geräte über die Checkboxen.
            </span>
          )}
        </div>
      )}

      {selectionMode && selectedIds.size > 0 && isAdmin && (
        <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium">{selectedIds.size} ausgewählt</span>
          <BulkSelect value={bulkStatus} onValueChange={(v) => setBulkStatus(v as DeviceStatus)}>
            <BulkSelectTrigger className="w-[200px] h-9">
              <BulkSelectValue placeholder="Status wählen" />
            </BulkSelectTrigger>
            <BulkSelectContent>
              {DEVICE_STATUS_OPTIONS.map((s) => (
                <BulkSelectItem key={s} value={s}>{s}</BulkSelectItem>
              ))}
            </BulkSelectContent>
          </BulkSelect>
          <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
            <Checkbox checked={bulkSendEmail} onCheckedChange={(v) => setBulkSendEmail(!!v)} />
            E-Mail für neuen Status senden
            {BULK_TEMPLATE_BY_STATUS[bulkStatus] ? (
              <span className="text-muted-foreground">({BULK_TEMPLATE_BY_STATUS[bulkStatus]})</span>
            ) : (
              <span className="text-muted-foreground">(keine Vorlage)</span>
            )}
          </label>
          <Button
            size="sm"
            disabled={bulkApplying}
            onClick={async () => {
              setBulkApplying(true);
              const ids = Array.from(selectedIds);
              const targets = devices.filter((d) => ids.includes(d.id));
              const tplKey = BULK_TEMPLATE_BY_STATUS[bulkStatus] ?? null;
              let ok = 0; let fail = 0;
              const toEmail: Array<{ deviceId: string; orderId: string }> = [];
              for (const d of targets) {
                const cleaned = (d.notes ?? '').replace(/\s*\[Status:\s*[^\]]+\]\s*/g, ' ').trim();
                const typMatch = (d.notes ?? '').match(/\[Typ:\s*(Neugerät|Leihgerät)\]/);
                const typPart = typMatch ? `[Typ: ${typMatch[1]}] ` : '';
                const rest = cleaned.replace(/\[Typ:\s*(Neugerät|Leihgerät)\]\s*/g, '').trim();
                const newNotes = `${typPart}[Status: ${bulkStatus}]${rest ? ' ' + rest : ''}`;
                const { error } = await supabase
                  .from('lager_devices')
                  .update({ notes: newNotes })
                  .eq('id', d.id);
                if (error) fail++;
                else {
                  ok++;
                  setDevices((prev) => prev.map((x) => x.id === d.id ? { ...x, notes: newNotes } : x));
                  if (bulkSendEmail && tplKey && d.reserved_order_id) {
                    toEmail.push({ deviceId: d.id, orderId: d.reserved_order_id });
                  }
                }
              }

              let mailOk = 0, mailFail = 0;
              for (let i = 0; i < toEmail.length; i++) {
                const t = toEmail[i];
                let attempt = 0; let sent = false;
                while (attempt < 3 && !sent) {
                  attempt++;
                  const res = await sendCustomerShippingNotice(t.orderId, t.deviceId, 'manuell', tplKey!);
                  if (res.ok) { sent = true; mailOk++; break; }
                  if (isRateLimited(res.message)) { await sleep(2000 * attempt); continue; }
                  mailFail++; console.warn('Status-E-Mail Fehler', t, res.message); break;
                }
                if (!sent && attempt >= 3) mailFail++;
                if (i < toEmail.length - 1) await sleep(1200);
              }

              setBulkApplying(false);
              setSelectedIds(new Set());
              const parts = [`${ok} Status aktualisiert`];
              if (fail > 0) parts.push(`${fail} Fehler`);
              if (toEmail.length > 0) parts.push(`${mailOk} E-Mails gesendet${mailFail ? `, ${mailFail} fehlgeschlagen` : ''}`);
              if (fail === 0 && mailFail === 0) toast.success(parts.join(' · '));
              else toast.warning(parts.join(' · '));
            }}
          >
            {bulkApplying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Statuswechsel anwenden
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={duplicating}
            onClick={async () => {
              setDuplicating(true);
              const ids = Array.from(selectedIds);
              const targets = devices.filter((d) => ids.includes(d.id));
              const { data: userData } = await supabase.auth.getUser();
              const payload = targets.map((d) => ({
                serial_number: `${d.serial_number}-COPY-${Date.now().toString(36)}`,
                model_name: d.model_name,
                entry_date: today,
                notes: d.notes,
                airtable_record_id: null,
                reserved_order_id: null,
                reservation_week: null,
                created_by: userData.user?.id,
              }));
              const { data: inserted, error } = await supabase
                .from('lager_devices')
                .insert(payload)
                .select('id');
              setDuplicating(false);
              if (error) { toast.error(`Fehler beim Duplizieren: ${error.message}`); return; }
              toast.success(`${inserted?.length ?? 0} Gerät(e) dupliziert`);
              setSelectedIds(new Set());
              loadDevices();
            }}
          >
            {duplicating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Duplizieren
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const ids = Array.from(selectedIds);
              const rows = devices.filter((d) => ids.includes(d.id));
              const header = ['Seriennummer', 'Modell', 'Status', 'Eingangsdatum', 'Auftrag', 'Kunde', 'KW', 'Notizen'];
              const esc = (v: any) => {
                const s = (v ?? '').toString().replace(/"/g, '""');
                return /[";\n]/.test(s) ? `"${s}"` : s;
              };
              const lines = [header.join(';')];
              rows.forEach((d) => {
                const cleaned = (d.notes ?? '').replace(/\[Status:[^\]]+\]/g, '').replace(/\[Typ:[^\]]+\]/g, '').trim();
                lines.push([
                  d.serial_number,
                  d.model_name,
                  getStatusFromNotes(d.notes),
                  d.entry_date,
                  d.orders?.order_number ?? '',
                  d.orders?.customer_name ?? '',
                  formatWeek(d.reservation_week),
                  cleaned,
                ].map(esc).join(';'));
              });
              const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${pageTitle.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <FileDown className="w-4 h-4 mr-2" /> CSV
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const ids = Array.from(selectedIds);
              const rows = devices.filter((d) => ids.includes(d.id));
              const doc = createPDF({ orientation: 'landscape' });
              doc.setFont('Inter', 'bold');
              doc.setFontSize(14);
              doc.text(`${pageTitle} – Auswahl (${rows.length})`, 14, 14);
              doc.setFont('Inter', 'normal');
              doc.setFontSize(9);
              doc.text(format(new Date(), 'dd.MM.yyyy HH:mm', { locale: de }), 14, 20);
              autoTable(doc, {
                startY: 26,
                head: [['Seriennummer', 'Modell', 'Status', 'Eingang', 'Auftrag', 'Kunde', 'KW', 'Notizen']],
                body: rows.map((d) => {
                  const cleaned = (d.notes ?? '').replace(/\[Status:[^\]]+\]/g, '').replace(/\[Typ:[^\]]+\]/g, '').trim();
                  return [
                    d.serial_number,
                    d.model_name,
                    getStatusFromNotes(d.notes),
                    d.entry_date,
                    d.orders?.order_number ?? '',
                    d.orders?.customer_name ?? '',
                    formatWeek(d.reservation_week),
                    cleaned,
                  ];
                }),
                styles: { font: 'Inter', fontSize: 8, cellPadding: 2 },
                headStyles: { fillColor: [30, 30, 30] },
              });
              doc.save(`${pageTitle.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
            }}
          >
            <FileText className="w-4 h-4 mr-2" /> PDF
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
            Auswahl aufheben
          </Button>
        </div>
      )}

      <div className="rounded-lg border border-border bg-card">
        {loading ? (
          <div className="p-8 flex items-center justify-center text-muted-foreground">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Lade…
          </div>
        ) : typeFilteredDevices.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            {emptyLabel}
          </div>
        ) : filteredDevices.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            Keine Lagergeräte passend zur Suche.
          </div>
        ) : viewMode === 'cards' ? (
          <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredDevices.map((d) => {
              const s = getStatusFromNotes(d.notes);
              return (
                <div
                  key={d.id}
                  className={`rounded-lg border border-border p-3 space-y-2 hover:border-primary/40 transition-colors ${d.reserved_order_id ? 'bg-yellow-500/10' : 'bg-card'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono text-sm font-semibold truncate">{d.serial_number}</div>
                      <div className="text-xs text-muted-foreground truncate">{d.model_name}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectionMode && (
                        <Checkbox
                          checked={selectedIds.has(d.id)}
                          onCheckedChange={(v) => {
                            setSelectedIds((prev) => {
                              const next = new Set(prev);
                              if (v) next.add(d.id); else next.delete(d.id);
                              return next;
                            });
                          }}
                          aria-label={`Auswählen ${d.serial_number}`}
                        />
                      )}
                      <StatusBadge
                        status={s}
                        className={s === 'Transfer' ? 'bg-red-500/15 text-red-500 border-red-500/40 animate-pulse' : undefined}
                      />
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Eingang: {format(new Date(d.entry_date), 'dd.MM.yyyy', { locale: de })}
                  </div>
                  {d.orders?.order_number && (
                    <div className="space-y-1">
                      <Badge className="font-mono bg-yellow-500/20 text-yellow-600 dark:text-yellow-300 border border-yellow-500/40 hover:bg-yellow-500/25">
                        {d.orders.order_number}
                      </Badge>
                      {d.orders.customer_name && (
                        <div className="text-xs text-muted-foreground truncate">{d.orders.customer_name}</div>
                      )}
                    </div>
                  )}
                  {d.notes && (
                    <div className="text-xs text-muted-foreground line-clamp-2 border-t border-border/50 pt-2">{d.notes}</div>
                  )}
                  <div className="flex justify-end gap-1 pt-1">
                    {d.reserved_order_id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 h-8 text-primary hover:text-primary"
                        onClick={async () => {
                          const r = await sendCustomerShippingNotice(d.reserved_order_id!, d.id, 'manuell', 'customer_shipping_notice');
                          if (r.ok) toast.success(r.message); else toast.error(r.message);
                        }}
                      >
                        <Mail className="w-4 h-4" /> E-Mail an Kunde
                      </Button>
                    )}
                    {getStatusFromNotes(d.notes) !== 'Ausgeliefert' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => markAsDelivered(d)}
                        className="gap-1 h-8 text-blue-500 hover:text-blue-600"
                      >
                        <PackageCheck className="w-4 h-4" /> Lieferung
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => openEdit(d)} className="gap-1 h-8">
                      <Pencil className="w-4 h-4" /> Bearbeiten
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {selectionMode && (
                  <TableHead className="w-10">
                    <Checkbox
                      checked={filteredDevices.length > 0 && filteredDevices.every((d) => selectedIds.has(d.id))}
                      onCheckedChange={(v) => {
                        if (v) setSelectedIds(new Set(filteredDevices.map((d) => d.id)));
                        else setSelectedIds(new Set());
                      }}
                      aria-label="Alle auswählen"
                    />
                  </TableHead>
                )}
                <TableHead onClick={() => toggleSort('serial_number')} className="cursor-pointer select-none hover:text-foreground"><span className="inline-flex items-center gap-1">Seriennummer <SortIcon field="serial_number" /></span></TableHead>
                <TableHead onClick={() => toggleSort('model_name')} className="cursor-pointer select-none hover:text-foreground"><span className="inline-flex items-center gap-1">Modell <SortIcon field="model_name" /></span></TableHead>
                <TableHead onClick={() => toggleSort('entry_date')} className="cursor-pointer select-none hover:text-foreground"><span className="inline-flex items-center gap-1">Eingangsdatum <SortIcon field="entry_date" /></span></TableHead>
                <TableHead onClick={() => toggleSort('order_number')} className="cursor-pointer select-none hover:text-foreground"><span className="inline-flex items-center gap-1">Reservierter Auftrag <SortIcon field="order_number" /></span></TableHead>
                <TableHead onClick={() => toggleSort('status')} className="cursor-pointer select-none hover:text-foreground"><span className="inline-flex items-center gap-1">Status <SortIcon field="status" /></span></TableHead>
                <TableHead onClick={() => toggleSort('notes')} className="cursor-pointer select-none hover:text-foreground"><span className="inline-flex items-center gap-1">Notizen (intern) <SortIcon field="notes" /></span></TableHead>
                <TableHead className="w-24 text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedDevices.map((d) => (
                <TableRow key={d.id} className={d.reserved_order_id ? 'bg-yellow-500/10 hover:bg-yellow-500/15' : (rowAccentClass ?? '')}>
                  {selectionMode && (
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(d.id)}
                        onCheckedChange={(v) => {
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            if (v) next.add(d.id); else next.delete(d.id);
                            return next;
                          });
                        }}
                        aria-label={`Auswählen ${d.serial_number}`}
                      />
                    </TableCell>
                  )}
                  <TableCell className="font-mono">{d.serial_number}</TableCell>
                  <TableCell>{d.model_name}</TableCell>
                  <TableCell>
                    {format(new Date(d.entry_date), 'dd.MM.yyyy', { locale: de })}
                  </TableCell>
                  <TableCell>
                    {d.orders?.order_number ? (
                      <div className="space-y-1">
                        <Badge className="font-mono bg-yellow-500/20 text-yellow-600 dark:text-yellow-300 border border-yellow-500/40 hover:bg-yellow-500/25">
                          {d.orders.order_number}
                        </Badge>
                        {d.orders.customer_name && (
                          <div className="text-xs text-muted-foreground truncate max-w-[220px]">
                            {d.orders.customer_name}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const s = getStatusFromNotes(d.notes);
                      return (
                        <StatusBadge
                          status={s}
                          className={s === 'Transfer' ? 'bg-red-500/15 text-red-500 border-red-500/40 animate-pulse' : undefined}
                        />
                      );
                    })()}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {d.notes ?? '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {d.reserved_order_id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1 text-primary hover:text-primary"
                          onClick={async () => {
                            const r = await sendCustomerShippingNotice(d.reserved_order_id!, d.id, 'manuell', 'customer_shipping_notice');
                            if (r.ok) toast.success(r.message); else toast.error(r.message);
                          }}
                        >
                          <Mail className="w-4 h-4" /> E-Mail an Kunde
                        </Button>
                      )}
                      {getStatusFromNotes(d.notes) !== 'Ausgeliefert' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => markAsDelivered(d)}
                          className="gap-1 text-blue-500 hover:text-blue-600"
                        >
                          <PackageCheck className="w-4 h-4" /> Lieferung
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => openEdit(d)} className="gap-1">
                        <Pencil className="w-4 h-4" /> Bearbeiten
                      </Button>
                    </div>
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

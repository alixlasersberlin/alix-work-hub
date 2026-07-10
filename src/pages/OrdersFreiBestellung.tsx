import { useEffect, useState, useMemo, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckCircle2, Search, Loader2, Inbox, Factory, Warehouse, Download, FileText, FileSpreadsheet, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/infinity/PageHeader';
import { InfinityStatusBadge } from '@/components/infinity/StatusBadge';
import { StatusBadge } from '@/components/StatusBadge';
import { PageSizeSelector, usePagination, PaginationControls } from '@/components/PageSizeSelector';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { createPDF } from '@/lib/pdf-utils';
import autoTable from 'jspdf-autotable';
import { fetchPendingRestbestellungOrderIds } from '@/lib/restbestellung';
import { useAtOnly } from '@/hooks/useAtOnly';
import { useAuth } from '@/hooks/useAuth';

const FREI_HIDDEN_NOTE = 'frei_bestellung_hidden';

function formatDate(date: string | null) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getStatus(notes: string | null | undefined): string {
  const matches = [...(notes ?? '').matchAll(/\[Status:\s*([^\]]+)\]/g)];
  const last = matches[matches.length - 1];
  return (last?.[1] ?? 'Bestand').trim();
}

function isLoanerDevice(notes: string | null | undefined) {
  return /\[Typ:\s*Leihger[äa]t\]/i.test(notes || '') || /leihger[äa]t/i.test(notes || '');
}

function isInRepair(notes: string | null | undefined) {
  return /\[Reparatur:\s*[^\]]+\]/i.test(notes || '');
}

function isReservableBestandDevice(device: Pick<FreeDevice, 'notes' | 'delivered_order_id'> & { reserved_order_id?: string | null }) {
  return getStatus(device.notes) === 'Bestand'
    && !device.reserved_order_id
    && !device.delivered_order_id
    && !isLoanerDevice(device.notes)
    && !isInRepair(device.notes);
}

type FreeDevice = {
  id: string;
  serial_number: string;
  model_name: string;
  notes: string | null;
  reserved_order_id?: string | null;
  delivered_order_id?: string | null;
};

type OrderItem = { order_id: string; item_name: string | null; description: string | null; sku: string | null; quantity: number | null; unit: string | null };

function normalize(s: string | null | undefined) {
  return (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function normalizeModelName(s: string | null | undefined) {
  return normalize(s).replace(/\s*-\s*at$/, '').trim();
}

// Stopwords that are too generic to count as product identity.
const MATCH_STOPWORDS = new Set([
  'alix', 'ai', 'ki', 'smart', 'pro', 'max', 'mini', 'plus', 'new',
  'and', 'und', 'mit', 'with', 'inkl', 'inklusive', 'set',
]);

// Farben werden separat behandelt: wenn Auftrag UND Gerät eine Farbe nennen,
// muss sie übereinstimmen. Synonyme werden auf eine kanonische Farbe gemappt.
const COLOR_SYNONYMS: Record<string, string> = {
  white: 'white', weiss: 'white', 'weiß': 'white', weis: 'white',
  black: 'black', schwarz: 'black',
  gold: 'gold', golden: 'gold',
  silver: 'silver', silber: 'silver',
  blue: 'blue', blau: 'blue',
  red: 'red', rot: 'red',
  grey: 'grey', gray: 'grey', grau: 'grey',
  green: 'green', 'grün': 'green', gruen: 'green',
  pink: 'pink', rosa: 'pink',
};

function tokenize(s: string | null | undefined): string[] {
  return (s || '').toLowerCase().split(/[^a-zäöüß0-9]+/).filter(Boolean);
}

function strongTokens(s: string | null | undefined): string[] {
  return tokenize(s).filter(t =>
    t.length >= 3 && !MATCH_STOPWORDS.has(t) && !COLOR_SYNONYMS[t] && !/^\d+w?$/.test(t)
  );
}

function colorsOf(s: string | null | undefined): Set<string> {
  const out = new Set<string>();
  for (const t of tokenize(s)) {
    const c = COLOR_SYNONYMS[t];
    if (c) out.add(c);
  }
  return out;
}

function findMatches(items: OrderItem[], devices: FreeDevice[]): FreeDevice[] {
  if (!items.length || !devices.length) return [];
  // Strenges Matching: für jeden Auftragsposten den NORMALISIERTEN Modellnamen
  // als vollständigen Substring im Gerätenamen (oder umgekehrt) verlangen.
  // Token-Fallbacks (ein geteiltes Wort reicht) sind absichtlich entfernt —
  // sie führten dazu, dass dasselbe Lagergerät als Treffer für viele
  // unpassende Aufträge gezählt wurde („mehr Geräte als vorhanden").
  const orderColors = new Set<string>();
  const itemNeedles: string[] = [];
  for (const it of items) {
    for (const c of colorsOf(`${it.item_name || ''} ${it.description || ''} ${it.sku || ''}`)) orderColors.add(c);
    const name = normalizeModelName(it.item_name);
    if (name && name.length >= 3 && !MATCH_STOPWORDS.has(name)) itemNeedles.push(name);
    const sku = normalizeModelName(it.sku);
    if (sku && sku.length >= 3) itemNeedles.push(sku);
  }
  if (!itemNeedles.length) return [];

  const seen = new Set<string>();
  const out: FreeDevice[] = [];
  for (const d of devices) {
    const m = normalizeModelName(d.model_name);
    if (!m || m.length < 3) continue;

    // Vollständige Modellbezeichnung muss in beide Richtungen mindestens als
    // Substring eines Auftragspostens auftauchen (Gerät ⊆ Posten oder Posten ⊆ Gerät).
    const hit = itemNeedles.some(n => n.includes(m) || m.includes(n));
    if (!hit) continue;

    // Farb-Filter: wenn beide Seiten Farben nennen, müssen ALLE Gerätefarben
    // in den Auftragsfarben enthalten sein.
    if (orderColors.size > 0) {
      const devColors = colorsOf(`${d.model_name} ${d.notes || ''}`);
      if (devColors.size > 0) {
        let allMatch = true;
        for (const c of devColors) if (!orderColors.has(c)) { allMatch = false; break; }
        if (!allMatch) continue;
      }
    }

    if (!seen.has(d.id)) {
      seen.add(d.id);
      out.push(d);
    }
  }
  return out;
}


export default function OrdersFreiBestellung() {
  const [orders, setOrders] = useState<any[]>([]);
  const [itemsByOrder, setItemsByOrder] = useState<Record<string, OrderItem[]>>({});
  const [freeBestand, setFreeBestand] = useState<FreeDevice[]>([]);
  const [reservedByOrder, setReservedByOrder] = useState<Record<string, { id: string; serial_number: string; model_name: string }[]>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const atOnly = useAtOnly();
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');

  const [reserveOrder, setReserveOrder] = useState<any | null>(null);
  const [reserveDeviceId, setReserveDeviceId] = useState<string>('');
  const [reserving, setReserving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [unassignOrder, setUnassignOrder] = useState<any | null>(null);
  const [unassigning, setUnassigning] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) => setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const reload = async () => {
    setLoading(true);
    setError(null);

    // Zusätzlich: teilgelieferte Aufträge mit "Restbestellung pending"-Marker
    const pendingRestIds = await fetchPendingRestbestellungOrderIds();

    let baseQuery = supabase
      .from('orders')
      .select('id, order_number, source_system, order_status, order_date, expected_shipment_date, total_amount, currency, deposit_ok, deposit_ok_by, deposit_ok_at, deposit_amount, customers(company_name, contact_name)')
      .eq('deposit_ok', true)
      .not('deposit_ok_by', 'is', null)
      .neq('deposit_ok_by', '')
      .not('order_status', 'in', '("Anwalt","Hold","anwalt","hold","geliefert","Geliefert","GELIEFERT","delivered","Delivered")')
      .order('deposit_ok_at', { ascending: false })
      .limit(500);
    if (atOnly) baseQuery = baseQuery.eq('source_system', 'zoho_eu_2');


    let restQuery: any = Promise.resolve({ data: [] as any[], error: null });
    if (pendingRestIds.size > 0) {
      let rq = supabase
        .from('orders')
        .select('id, order_number, source_system, order_status, order_date, expected_shipment_date, total_amount, currency, deposit_ok, deposit_ok_by, deposit_ok_at, deposit_amount, customers(company_name, contact_name)')
        .in('id', Array.from(pendingRestIds))
        .eq('order_status', 'teilgeliefert');
      if (atOnly) rq = rq.eq('source_system', 'zoho_eu_2');
      restQuery = rq;
    }

    const [{ data, error: err }, { data: restData }] = await Promise.all([baseQuery, restQuery]);
    if (err) setError(err.message);

    // Exclude orders that already have a production order — außer für teilgelieferte Rest-Aufträge.
    const [{ data: existing }, { data: reservedDevs }, { data: freeDevs }, { data: hiddenNotes }] = await Promise.all([
      supabase.from('production_orders').select('order_id'),
      supabase.from('lager_devices').select('id, serial_number, model_name, notes, reserved_order_id').not('reserved_order_id', 'is', null),
      supabase.from('lager_devices').select('id, serial_number, model_name, notes, delivered_order_id').is('reserved_order_id', null).is('delivered_order_id', null),
      supabase.from('order_notes').select('order_id').eq('note_type', FREI_HIDDEN_NOTE),
    ]);
    const usedOrderIds = new Set(((existing ?? []).map((p: any) => p.order_id)));
    const hiddenOrderIds = new Set(((hiddenNotes ?? []) as any[]).map(n => n.order_id));
    // Reservierte Gerätezählung pro Auftrag (Leihgeräte ausgenommen).
    const reservedCountByOrder = new Map<string, number>();
    for (const d of (reservedDevs ?? []) as any[]) {
      if (!d.reserved_order_id) continue;
      if (isLoanerDevice(d.notes)) continue;
      reservedCountByOrder.set(d.reserved_order_id, (reservedCountByOrder.get(d.reserved_order_id) ?? 0) + 1);
    }

    // Erforderliche Gerätestückzahl pro Auftrag (Summe der order_items.quantity).
    // Wir laden Items schon jetzt, damit wir Aufträge nur dann ausblenden, wenn
    // ALLE Geräte reserviert sind (sonst bleiben sie sichtbar).
    const candidateIds = Array.from(new Set([
      ...((data ?? []) as any[]).map((o: any) => o.id),
      ...((restData ?? []) as any[]).map((o: any) => o.id),
    ]));
    const requiredByOrder = new Map<string, number>();
    if (candidateIds.length > 0) {
      const { data: qtyRows } = await supabase
        .from('order_items')
        .select('order_id, quantity')
        .in('order_id', candidateIds);
      for (const r of (qtyRows ?? []) as any[]) {
        const q = Number(r.quantity ?? 1) || 1;
        requiredByOrder.set(r.order_id, (requiredByOrder.get(r.order_id) ?? 0) + q);
      }
    }
    const isFullyReserved = (orderId: string) => {
      const req = requiredByOrder.get(orderId) ?? 0;
      const res = reservedCountByOrder.get(orderId) ?? 0;
      return req > 0 && res >= req;
    };

    // Aufträge mit bereits angelegter Production-Order werden ausgeblendet —
    // sie liegen jetzt bei „Factory Orders". Ausnahme: Restbestellung-Marker
    // (Teilgeliefert) sollen weiterhin sichtbar bleiben.
    const baseFiltered = (data ?? []).filter((o: any) =>
      !pendingRestIds.has(o.id) && !hiddenOrderIds.has(o.id) && !usedOrderIds.has(o.id) && !isFullyReserved(o.id)
    );
    const restMapped = (restData ?? []).map((o: any) => ({ ...o, _isRestbestellung: true })).filter((o: any) => !hiddenOrderIds.has(o.id) && !isFullyReserved(o.id));
    const combined = [...restMapped, ...baseFiltered];


    // -AT-Aufträge (zoho_eu_2) sind jetzt ebenfalls direkt für Bestellungen freigeschaltet,
    // unabhängig von order_at_approval.bestellfreigabe.
    const filteredOrders = combined;
    setOrders(filteredOrders);

    // Map reserved devices by order id (Leihgeräte ausschließen)
    const resMap: Record<string, { id: string; serial_number: string; model_name: string }[]> = {};
    for (const d of (reservedDevs ?? []) as any[]) {
      if (!d.reserved_order_id) continue;
      if (isLoanerDevice(d.notes)) continue;
      (resMap[d.reserved_order_id] ??= []).push({ id: d.id, serial_number: d.serial_number, model_name: d.model_name });
    }
    setReservedByOrder(resMap);

    // Only Bestand devices
    const bestandOnly = ((freeDevs as FreeDevice[]) ?? []).filter(isReservableBestandDevice);
    setFreeBestand(bestandOnly);

    // Load order items for visible orders
    if (filteredOrders.length > 0) {
      const ids = filteredOrders.map((o: any) => o.id);
      const { data: items } = await supabase
        .from('order_items')
        .select('order_id, item_name, description, sku, quantity, unit, item_order')
        .in('order_id', ids)
        .order('item_order', { ascending: true });
      const map: Record<string, OrderItem[]> = {};
      for (const it of (items as OrderItem[]) ?? []) {
        (map[it.order_id] ??= []).push(it);
      }
      setItemsByOrder(map);
    } else {
      setItemsByOrder({});
    }
    setLoading(false);
  };

  useEffect(() => { reload(); }, [atOnly]);

  const matchesByOrder = useMemo(() => {
    const m: Record<string, FreeDevice[]> = {};
    for (const o of orders) {
      m[o.id] = findMatches(itemsByOrder[o.id] || [], freeBestand);
    }
    return m;
  }, [orders, itemsByOrder, freeBestand]);

  const filtered = useMemo(() => orders.filter(o => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      o.order_number?.toLowerCase().includes(q) ||
      o.customers?.company_name?.toLowerCase().includes(q) ||
      o.customers?.contact_name?.toLowerCase().includes(q) ||
      o.deposit_ok_by?.toLowerCase().includes(q)
    );
  }), [orders, search]);

  const { pageSize, setPageSize, page, setPage, totalPages, paged, total } = usePagination(filtered, 20);

  const openReserve = (o: any) => {
    const m = matchesByOrder[o.id] || [];
    setReserveOrder(o);
    setReserveDeviceId(m[0]?.id || '');
  };

  const confirmReserve = async () => {
    if (!reserveOrder || !reserveDeviceId) return;
    setReserving(true);
    const { data: currentDevice, error: checkErr } = await supabase
      .from('lager_devices')
      .select('id, notes, reserved_order_id, delivered_order_id')
      .eq('id', reserveDeviceId)
      .maybeSingle();

    if (checkErr || !currentDevice || !isReservableBestandDevice(currentDevice)) {
      setReserving(false);
      toast.error('Dieses Gerät ist nicht mehr reservierbar (z. B. in Reparatur oder bereits zugeordnet).');
      setReserveOrder(null);
      setReserveDeviceId('');
      reload();
      return;
    }

    const { error: upErr } = await supabase
      .from('lager_devices')
      .update({ reserved_order_id: reserveOrder.id })
      .eq('id', reserveDeviceId)
      .is('reserved_order_id', null)
      .is('delivered_order_id', null);
    setReserving(false);
    if (upErr) {
      toast.error('Reservierung fehlgeschlagen: ' + upErr.message);
      return;
    }
    toast.success('Gerät aus Lagerbestand reserviert — keine Bestellung nötig');
    setReserveOrder(null);
    setReserveDeviceId('');
    reload();
  };

  const confirmUnassign = async () => {
    if (!unassignOrder) return;
    const orderId = unassignOrder.id;
    const orderNumber = unassignOrder.order_number;
    setUnassigning(true);
    try {
      const { error: resolveErr } = await supabase.rpc('resolve_frei_bestellung_assignment', { _order_id: orderId });
      if (resolveErr) {
        console.error('[confirmUnassign] resolve failed', resolveErr);
        toast.error('Zuordnung konnte nicht gelöscht werden: ' + resolveErr.message);
        return;
      }

      // Optimistisch aus lokaler Liste entfernen — auch falls reload langsam ist
      setOrders(prev => prev.filter((o: any) => o.id !== orderId));
      setSelected(prev => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
      setUnassignOrder(null);
      toast.success(`Zuordnung für ${orderNumber} gelöscht`);
      reload();
    } catch (e: any) {
      console.error('[confirmUnassign] unexpected', e);
      toast.error('Unerwarteter Fehler: ' + (e?.message ?? String(e)));
    } finally {
      setUnassigning(false);
    }
  };

  const allVisibleSelected = paged.length > 0 && paged.every((o: any) => selected.has(o.id));
  const toggleAll = () => {
    setSelected(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) paged.forEach((o: any) => next.delete(o.id));
      else paged.forEach((o: any) => next.add(o.id));
      return next;
    });
  };
  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const getExportRows = () =>
    selected.size > 0 ? filtered.filter((o: any) => selected.has(o.id)) : filtered;

  const rowToCells = (o: any) => {
    const items = itemsByOrder[o.id] || [];
    const names = items.map(i => i.item_name).filter(Boolean).join(', ');
    const matches = matchesByOrder[o.id] || [];
    return [
      o.order_number || '',
      o.customers?.company_name || o.customers?.contact_name || '',
      names,
      formatDate(o.deposit_ok_at),
      o.deposit_amount != null ? `${Number(o.deposit_amount).toFixed(2).replace('.', ',')} ${o.currency || 'EUR'}` : '',
      formatDate(o.expected_shipment_date),
      matches.length > 0 ? `${matches.length}x vorhanden` : '',
      o.order_status || '',
    ];
  };

  const downloadCSV = () => {
    const data = getExportRows();
    const headers = ['Auftragsnr.', 'Kunde', 'Artikel', 'Freigabe am', 'Anzahlung', 'Lieferdatum', 'Lagerbestand', 'Status'];
    const lines = [headers.join(';')];
    data.forEach((o: any) => {
      const cells = rowToCells(o).map(v => `"${String(v).replace(/"/g, '""')}"`);
      lines.push(cells.join(';'));
    });
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bestellung_moeglich_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${data.length} Einträge exportiert`);
  };

  const downloadPDF = () => {
    const data = getExportRows();
    const doc = createPDF({ orientation: 'landscape' });
    doc.setFont('Inter', 'bold');
    doc.setFontSize(14);
    doc.text('Bestellung möglich', 14, 14);
    doc.setFont('Inter', 'normal');
    doc.setFontSize(9);
    doc.text(`${data.length} Aufträge · ${new Date().toLocaleDateString('de-DE')}`, 14, 20);
    autoTable(doc, {
      startY: 24,
      styles: { font: 'Inter', fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 30, 30], textColor: 255 },
      head: [['Auftragsnr.', 'Kunde', 'Artikel', 'Freigabe am', 'Anzahlung', 'Lieferdatum', 'Lagerbestand', 'Status']],
      body: data.map(rowToCells),
    });
    doc.save(`bestellung_moeglich_${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success(`${data.length} Einträge exportiert`);
  };

  const selectionCount = selected.size;

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <PageHeader
        icon={CheckCircle2}
        title="Bestellung möglich"
        subtitle={`${filtered.length} Aufträge mit bestätigter Anzahlung — bereit zur Bestellung${selectionCount > 0 ? ` · ${selectionCount} ausgewählt` : ''}`}
        noBreadcrumbs
        meta={<InfinityStatusBadge kind="done" label={`${filtered.length}`} />}
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="default">
                <Download className="w-4 h-4 mr-2" />
                Download ({selectionCount > 0 ? selectionCount : filtered.length})
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={downloadCSV}>
                <FileSpreadsheet className="w-4 h-4 mr-2" /> Als CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={downloadPDF}>
                <FileText className="w-4 h-4 mr-2" /> Als PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Suche nach Auftrag, Kunde, Mitarbeiter..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 bg-secondary border-border" />
        </div>
        <PageSizeSelector value={pageSize} onChange={setPageSize} />
      </div>

      {error && <div className="mb-4 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      <div className="rounded-xl border border-border bg-card card-glow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="px-3 py-3 w-8">
                  <Checkbox
                    checked={allVisibleSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Alle auswählen"
                  />
                </th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Auftragsnr.</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Kunde</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Artikel</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Freigabe am</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Anzahlung</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Lieferdatum</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Lagerbestand</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Status</th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">Aktion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={10} className="px-4 py-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-12 text-center">
                  <Inbox className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-muted-foreground">Keine Aufträge mit Anzahlungsbestätigung gefunden.</p>
                </td></tr>
              ) : (
                paged.map(o => {
                  const matches = matchesByOrder[o.id] || [];
                  const inStock = matches.length > 0;
                  const isSel = selected.has(o.id);
                  return (
                    <Fragment key={o.id}>
                    <tr className={`hover:bg-secondary/30 transition-colors ${isSel ? 'bg-primary/5' : ''}`}>
                      <td className="px-3 py-3 w-8" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSel}
                          onCheckedChange={() => toggleOne(o.id)}
                          aria-label="Auswählen"
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); toggleExpand(o.id); }}
                            className="p-1 -ml-1 rounded hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors"
                            aria-label={expanded.has(o.id) ? 'Positionen ausblenden' : 'Positionen anzeigen'}
                            title={expanded.has(o.id) ? 'Positionen ausblenden' : 'Positionen anzeigen'}
                          >
                            {expanded.has(o.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                          <span className="cursor-pointer hover:underline" onClick={() => navigate(`/auftraege/${o.id}`)}>{o.order_number}</span>
                          {o._isRestbestellung && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 text-[10px] font-semibold uppercase tracking-wider">
                              Restbestellung
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{o.customers?.company_name || o.customers?.contact_name || '—'}</td>
                      <td className="px-4 py-3 text-foreground">
                        {(() => {
                          const items = itemsByOrder[o.id] || [];
                          const names = items.map(i => i.item_name).filter(Boolean) as string[];
                          if (names.length === 0) return <span className="text-muted-foreground">—</span>;
                          return (
                            <HoverCard openDelay={100} closeDelay={50}>
                              <HoverCardTrigger asChild>
                                <span className="line-clamp-2 cursor-help underline decoration-dotted decoration-muted-foreground/50 underline-offset-2">
                                  {names.join(', ')}
                                </span>
                              </HoverCardTrigger>
                              <HoverCardContent className="w-80 max-h-80 overflow-auto">
                                <div className="text-xs font-semibold text-muted-foreground mb-2">
                                  Artikel ({items.length})
                                </div>
                                <ul className="space-y-2 text-sm">
                                  {items.map((it, idx) => (
                                    <li key={idx} className="border-b border-border/50 pb-2 last:border-0 last:pb-0">
                                      <div className="font-medium text-foreground">{it.item_name || '—'}</div>
                                      {it.sku && <div className="text-xs text-muted-foreground font-mono">SKU: {it.sku}</div>}
                                      {it.description && <div className="text-xs text-muted-foreground mt-0.5">{it.description}</div>}
                                    </li>
                                  ))}
                                </ul>
                              </HoverCardContent>
                            </HoverCard>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(o.deposit_ok_at)}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {o.deposit_amount != null ? `${Number(o.deposit_amount).toLocaleString('de-DE', { minimumFractionDigits: 2 })} ${o.currency || '€'}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(o.expected_shipment_date)}</td>
                      <td className="px-4 py-3">
                        {(() => {
                          const reserved = reservedByOrder[o.id] || [];
                          if (reserved.length > 0) {
                            return (
                              <HoverCard>
                                <HoverCardTrigger asChild>
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/15 text-amber-500 text-xs font-medium cursor-help">
                                    <Warehouse className="w-3.5 h-3.5" />
                                    {reserved.length}× reserviert
                                  </span>
                                </HoverCardTrigger>
                                <HoverCardContent className="w-80">
                                  <p className="text-xs font-semibold text-muted-foreground mb-2">Reservierte Geräte</p>
                                  <ul className="space-y-1 text-sm">
                                    {reserved.map(r => (
                                      <li key={r.id} className="flex flex-col border-b border-border/40 last:border-0 pb-1 last:pb-0">
                                        <span className="font-medium">{r.model_name}</span>
                                        <span className="text-xs text-muted-foreground font-mono">SN: {r.serial_number}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </HoverCardContent>
                              </HoverCard>
                            );
                          }
                          return inStock ? (
                            <HoverCard openDelay={120} closeDelay={80}>
                              <HoverCardTrigger asChild>
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-500 text-xs font-medium cursor-help">
                                  <Warehouse className="w-3.5 h-3.5" />
                                  {matches.length}× vorhanden
                                </span>
                              </HoverCardTrigger>
                              <HoverCardContent className="w-80">
                                <p className="text-xs font-semibold text-muted-foreground mb-2">
                                  Verfügbare Lagergeräte ({matches.length})
                                </p>
                                <ul className="space-y-1 text-sm max-h-72 overflow-y-auto">
                                  {matches.map(d => (
                                    <li key={d.id} className="flex flex-col border-b border-border/40 last:border-0 pb-1 last:pb-0">
                                      <span className="font-medium">{d.model_name}</span>
                                      <span className="text-xs text-muted-foreground font-mono">SN: {d.serial_number}</span>
                                    </li>
                                  ))}
                                </ul>
                              </HoverCardContent>
                            </HoverCard>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          );
                        })()}
                      </td>

                      <td className="px-4 py-3"><StatusBadge status={o.order_status} /></td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          {(reservedByOrder[o.id]?.length ?? 0) > 0 && (
                            <span className="inline-flex items-center gap-1 text-xs text-amber-500 font-medium">
                              <CheckCircle2 className="w-4 h-4" /> {reservedByOrder[o.id].length}× reserviert
                            </span>
                          )}
                          {inStock && (
                            <Button size="sm" variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => openReserve(o)}>
                              <Warehouse className="w-4 h-4 mr-1" /> Aus Lager reservieren
                            </Button>
                          )}
                          <Button size="sm" onClick={() => navigate(`/order/neu?order_id=${o.id}`)}>
                            <Factory className="w-4 h-4 mr-1" /> Bestellung
                          </Button>
                          {isSuperAdmin && (
                            <Button
                              size="sm"
                              variant="destructive"
                              className="text-white hover:text-white"
                              onClick={() => setUnassignOrder(o)}
                              title="Lager-Reservierung entfernen und Auftrag aus dieser Liste ausblenden"
                            >
                              <Trash2 className="w-4 h-4 mr-1" /> Zuordnung löschen
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expanded.has(o.id) && (() => {
                      const items = itemsByOrder[o.id] || [];
                      return (
                        <tr key={o.id + '_pos'} className="bg-secondary/20">
                          <td colSpan={10} className="px-4 py-4">
                            <div className="ml-8 border-l-2 border-primary/40 pl-4">
                              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                                Positionen ({items.length})
                              </div>
                              {items.length === 0 ? (
                                <div className="text-sm text-muted-foreground">Keine Positionen vorhanden.</div>
                              ) : (
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-left text-muted-foreground border-b border-border/60">
                                      <th className="py-1.5 pr-3 font-medium">#</th>
                                      <th className="py-1.5 pr-3 font-medium">Artikel</th>
                                      <th className="py-1.5 pr-3 font-medium">SKU</th>
                                      <th className="py-1.5 pr-3 font-medium">Beschreibung</th>
                                      <th className="py-1.5 pr-3 font-medium text-right">Menge</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-border/40">
                                    {items.map((it, idx) => (
                                      <tr key={idx}>
                                        <td className="py-1.5 pr-3 text-muted-foreground">{idx + 1}</td>
                                        <td className="py-1.5 pr-3 text-foreground font-medium">{it.item_name || '—'}</td>
                                        <td className="py-1.5 pr-3 text-muted-foreground font-mono">{it.sku || '—'}</td>
                                        <td className="py-1.5 pr-3 text-muted-foreground">{it.description || '—'}</td>
                                        <td className="py-1.5 pr-3 text-foreground text-right">
                                          {it.quantity != null ? `${Number(it.quantity).toLocaleString('de-DE')}${it.unit ? ' ' + it.unit : ''}` : '—'}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })()}
                  </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} total={total} />

      {reserveOrder && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-background/80 px-4 py-8 backdrop-blur-sm"
          onClick={() => { if (!reserving) { setReserveOrder(null); setReserveDeviceId(''); } }}
        >
          <div
            className="relative w-full max-w-lg rounded-lg border border-border bg-background p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4">
              <h2 className="font-display text-lg font-semibold leading-none tracking-tight flex items-center gap-2">
                <Warehouse className="w-5 h-5 text-emerald-500" />
                Aus Lagerbestand reservieren
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Für Auftrag <span className="font-medium text-foreground">{reserveOrder?.order_number}</span> wurde ein passendes Gerät im Lagerbestand gefunden. Wird ein Gerät reserviert, ist <span className="font-medium">keine Bestellung</span> mehr nötig.
              </p>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {(matchesByOrder[reserveOrder?.id] || []).map(d => (
                <label key={d.id} className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer ${reserveDeviceId === d.id ? 'border-emerald-500 bg-emerald-500/10' : 'border-border'}`}>
                  <input
                    type="radio"
                    name="lagerdevice"
                    checked={reserveDeviceId === d.id}
                    onChange={() => setReserveDeviceId(d.id)}
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{d.model_name}</div>
                    <div className="text-xs text-muted-foreground font-mono">SN: {d.serial_number}</div>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => { setReserveOrder(null); setReserveDeviceId(''); }} disabled={reserving}>
                Abbrechen
              </Button>
              <Button onClick={confirmReserve} disabled={!reserveDeviceId || reserving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {reserving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                Reservierung bestätigen
              </Button>
            </div>
          </div>
        </div>
      )}


      <AlertDialog open={!!unassignOrder} onOpenChange={(v) => { if (!v) setUnassignOrder(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" />
              Zuordnung löschen
            </AlertDialogTitle>
            <AlertDialogDescription>
              Alle Lager-Reservierungen für Auftrag <span className="font-medium text-foreground">{unassignOrder?.order_number}</span> werden entfernt
              und der Auftrag wird aus „Bestellung möglich" ausgeblendet. Der Auftrag selbst bleibt unverändert.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unassigning}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmUnassign(); }}
              disabled={unassigning}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {unassigning ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1" />}
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

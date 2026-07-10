import { useState, useEffect, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Search, Loader2, Inbox, X, SearchCheck, ChevronDown, ChevronRight,
  Factory, Warehouse, Banknote, MapPin, FileText, MessageSquare, Landmark,
  BookmarkPlus, CheckCircle2,
} from 'lucide-react';
import { PageHeader } from '@/components/infinity/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { ALIX_MODEL_GROUPS } from '@/lib/alix-models';

type ProductionVorgang = {
  id: string;
  production_order_number: string | null;
  modellname: string | null;
  status: string | null;
  approval_status: string | null;
  liefertermin: string | null;
  is_reclamation: boolean;
};

type LagerVorgang = { id: string; model_name: string; serial_number: string };
type RouteVorgang = { id: string; planned_date: string | null; planning_status: string; assigned_employee: string | null };
type FinanceVorgang = { id: string; invoice_status: string | null; amount_due: number | null; amount_paid: number | null; currency: string | null };
type BankVorgang = { id: string; status: string; decision_text: string | null; request_date: string | null };
type DocumentVorgang = { id: string; file_name: string; document_type: string | null; created_at: string };
type NoteVorgang = { id: string; note_text: string; note_type: string | null; created_at: string };

type Related = {
  production: ProductionVorgang[];
  lager: LagerVorgang[];
  routes: RouteVorgang[];
  finance: FinanceVorgang[];
  bank: BankVorgang[];
  documents: DocumentVorgang[];
  notes: NoteVorgang[];
};

type Hit = {
  id: string;
  order_number: string;
  order_status: string | null;
  order_date: string | null;
  total_amount: number | null;
  currency: string | null;
  customer_name: string;
  customer_phone: string | null;
  city: string | null;
  zip: string | null;
  models: string[];
  related: Related;
};

const EMPTY = { name: '', zip: '', city: '', orderNumber: '', phone: '', model: '', serial: '', notes: '' };

function formatDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString('de-DE') : '—';
}

function addr(o: any) {
  const b = o?.billing_address || o?.customers?.billing_address || {};
  const s = o?.shipping_address || o?.customers?.shipping_address || {};
  return {
    zip: (b.zip || s.zip || '').toString(),
    city: (b.city || s.city || '').toString(),
  };
}

function emptyRelated(): Related {
  return { production: [], lager: [], routes: [], finance: [], bank: [], documents: [], notes: [] };
}

function totalVorgaenge(r: Related) {
  return r.production.length + r.lager.length + r.routes.length + r.finance.length + r.bank.length + r.documents.length + r.notes.length;
}

export default function Detailsuche() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const atOnly = hasRole('Österreich');
  const [form, setForm] = useState({ ...EMPTY });
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [unassignedLager, setUnassignedLager] = useState<Array<{ id: string; serial_number: string; model_name: string | null; notes: string | null }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Reservierungs-Panel
  type AvailOrder = {
    id: string;
    order_number: string;
    customer_name: string;
    zip: string | null;
    city: string | null;
    open_models: string[];
    order_date: string | null;
  };
  const [availOrders, setAvailOrders] = useState<AvailOrder[] | null>(null);
  const [loadingAvail, setLoadingAvail] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [reservingId, setReservingId] = useState<string | null>(null);

  // Auto-Auswahl, wenn genau ein freies Lagergerät vorliegt
  useEffect(() => {
    if (!selectedDeviceId && unassignedLager.length === 1) {
      setSelectedDeviceId(unassignedLager[0].id);
    }
    if (selectedDeviceId && !unassignedLager.some(d => d.id === selectedDeviceId)) {
      setSelectedDeviceId('');
    }
  }, [unassignedLager, selectedDeviceId]);

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const update = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const reset = () => {
    setForm({ ...EMPTY }); setHits(null); setUnassignedLager([]); setError(null);
    setExpanded(new Set()); setAvailOrders(null); setSelectedDeviceId('');
  };

  const loadAvailableOrders = async () => {
    setLoadingAvail(true); setError(null);
    try {
      const modelFilter = form.model.trim();

      // 1) Offene Produktions-Positionen ohne Seriennummer
      let poQ = supabase
        .from('production_orders')
        .select('order_id, modellname')
        .is('seriennummer', null)
        .not('order_id', 'is', null)
        .limit(2000);
      if (modelFilter) poQ = poQ.ilike('modellname', `%${modelFilter}%`);
      const { data: poRows, error: poErr } = await poQ;
      if (poErr) throw poErr;

      const openModelsByOrder = new Map<string, Set<string>>();
      for (const p of (poRows || []) as any[]) {
        if (!p.order_id) continue;
        const set = openModelsByOrder.get(p.order_id) ?? new Set<string>();
        if (p.modellname) set.add(p.modellname);
        openModelsByOrder.set(p.order_id, set);
      }
      const candidateIds = Array.from(openModelsByOrder.keys());
      if (candidateIds.length === 0) { setAvailOrders([]); setLoadingAvail(false); return; }

      // 2) Bereits durch Lagergerät reservierte Aufträge ausschließen
      const { data: reserved } = await supabase
        .from('lager_devices')
        .select('reserved_order_id')
        .in('reserved_order_id', candidateIds);
      const reservedSet = new Set<string>((reserved || []).map((r: any) => r.reserved_order_id).filter(Boolean));
      const targetIds = candidateIds.filter(id => !reservedSet.has(id));
      if (targetIds.length === 0) { setAvailOrders([]); setLoadingAvail(false); return; }

      // 3) Auftragsdetails laden
      let oQ = supabase
        .from('orders')
        .select('id, order_number, order_date, billing_address, shipping_address, customers(company_name, contact_name)')
        .in('id', targetIds)
        .order('order_date', { ascending: false })
        .limit(500);
      if (atOnly) oQ = oQ.eq('source_system', 'zoho_eu_2');
      const { data: orderRows, error: oErr } = await oQ;
      if (oErr) throw oErr;

      const out: AvailOrder[] = ((orderRows || []) as any[]).map(o => {
        const a = addr(o);
        return {
          id: o.id,
          order_number: o.order_number,
          customer_name: o.customers?.company_name || o.customers?.contact_name || '—',
          zip: a.zip || null,
          city: a.city || null,
          open_models: Array.from(openModelsByOrder.get(o.id) ?? []),
          order_date: o.order_date,
        };
      });
      setAvailOrders(out);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoadingAvail(false);
    }
  };

  const reserveOrder = async (orderId: string) => {
    if (!selectedDeviceId) {
      toast.error('Bitte zuerst ein Lagergerät auswählen (Suche per Seriennummer).');
      return;
    }
    setReservingId(orderId);
    try {
      const { error: upErr } = await supabase
        .from('lager_devices')
        .update({ reserved_order_id: orderId })
        .eq('id', selectedDeviceId);
      if (upErr) throw upErr;
      toast.success('Reservierung gespeichert.');
      // Lokal entfernen
      setAvailOrders(prev => prev ? prev.filter(o => o.id !== orderId) : prev);
      setUnassignedLager(prev => prev.filter(d => d.id !== selectedDeviceId));
      setSelectedDeviceId('');
    } catch (e: any) {
      toast.error(e.message || 'Reservierung fehlgeschlagen');
    } finally {
      setReservingId(null);
    }
  };


  const runSearch = async () => {
    const trimmed = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()])) as typeof EMPTY;
    if (!Object.values(trimmed).some(Boolean)) {
      toast.error('Bitte mindestens ein Suchkriterium angeben');
      return;
    }
    setLoading(true); setError(null); setHits(null); setUnassignedLager([]); setExpanded(new Set());

    try {
      // 1) Order-IDs aus production_orders via Modellname
      let modelOrderIds: Set<string> | null = null;
      if (trimmed.model) {
        const { data, error } = await supabase
          .from('production_orders')
          .select('order_id')
          .ilike('modellname', `%${trimmed.model}%`)
          .not('order_id', 'is', null)
          .limit(2000);
        if (error) throw error;
        modelOrderIds = new Set((data || []).map((r: any) => r.order_id).filter(Boolean));
        const { data: items } = await supabase
          .from('order_items')
          .select('order_id')
          .ilike('item_name', `%${trimmed.model}%`)
          .limit(2000);
        for (const it of (items || []) as any[]) if (it.order_id) modelOrderIds.add(it.order_id);
        if (modelOrderIds.size === 0) { setHits([]); setLoading(false); return; }
      }

      // 1b) Order-IDs via Seriennummer (production_orders + lager_devices)
      let serialOrderIds: Set<string> | null = null;
      let standaloneLager: Array<{ id: string; serial_number: string; model_name: string | null; notes: string | null }> = [];
      if (trimmed.serial) {
        serialOrderIds = new Set<string>();
        const { data: poSer, error: poSerErr } = await supabase
          .from('production_orders')
          .select('order_id')
          .ilike('seriennummer', `%${trimmed.serial}%`)
          .not('order_id', 'is', null)
          .limit(2000);
        if (poSerErr) throw poSerErr;
        for (const r of (poSer || []) as any[]) if (r.order_id) serialOrderIds.add(r.order_id);
        const { data: lagSer } = await supabase
          .from('lager_devices')
          .select('id, serial_number, model_name, reserved_order_id, notes')
          .ilike('serial_number', `%${trimmed.serial}%`)
          .limit(2000);
        for (const r of (lagSer || []) as any[]) {
          // Leihgeräte explizit ausschließen — sie sind nur temporär verliehen
          // und gehören NICHT in Bestellwesen / Reservierungen / Vorschläge.
          const isLeih = /\[Typ:\s*Leihgerät\]|\[Leihgerät\]/.test(r.notes ?? '');
          if (isLeih) continue;
          if (r.reserved_order_id) {
            serialOrderIds.add(r.reserved_order_id);
          } else {
            standaloneLager.push({ id: r.id, serial_number: r.serial_number, model_name: r.model_name, notes: r.notes });
          }
        }
        setUnassignedLager(standaloneLager);
        if (serialOrderIds.size === 0) { setHits([]); setLoading(false); return; }
      }

      // 1c) Order-IDs via Notiz-Stichwort (order_notes, customer_notes, lager_devices.notes)
      let notesOrderIds: Set<string> | null = null;
      if (trimmed.notes) {
        notesOrderIds = new Set<string>();
        const kw = trimmed.notes;

        // order_notes direkt am Auftrag
        const { data: onRows, error: onErr } = await supabase
          .from('order_notes')
          .select('order_id')
          .ilike('note_text', `%${kw}%`)
          .not('order_id', 'is', null)
          .limit(2000);
        if (onErr) throw onErr;
        for (const r of (onRows || []) as any[]) if (r.order_id) notesOrderIds.add(r.order_id);

        // customer_notes → Aufträge des Kunden
        const { data: cnRows } = await supabase
          .from('customer_notes')
          .select('customer_id')
          .ilike('note_text', `%${kw}%`)
          .not('customer_id', 'is', null)
          .limit(2000);
        const noteCustomerIds = Array.from(new Set(((cnRows || []) as any[]).map(r => r.customer_id).filter(Boolean)));
        if (noteCustomerIds.length > 0) {
          const { data: ordByCust } = await supabase
            .from('orders')
            .select('id')
            .in('customer_id', noteCustomerIds)
            .limit(2000);
          for (const r of (ordByCust || []) as any[]) if (r.id) notesOrderIds.add(r.id);
        }

        // lager_devices.notes → über reserved_order_id, sonst standalone
        const { data: lagNotes } = await supabase
          .from('lager_devices')
          .select('id, serial_number, model_name, reserved_order_id, notes')
          .ilike('notes', `%${kw}%`)
          .limit(2000);
        for (const r of (lagNotes || []) as any[]) {
          const isLeih = /\[Typ:\s*Leihgerät\]|\[Leihgerät\]/.test(r.notes ?? '');
          if (isLeih) continue;
          if (r.reserved_order_id) {
            notesOrderIds.add(r.reserved_order_id);
          } else if (!standaloneLager.some(s => s.id === r.id)) {
            standaloneLager.push({ id: r.id, serial_number: r.serial_number, model_name: r.model_name, notes: r.notes });
          }
        }
        setUnassignedLager(standaloneLager);
        if (notesOrderIds.size === 0 && standaloneLager.length === 0) { setHits([]); setLoading(false); return; }
      }




      // 2) Kunden-IDs nach Name / Telefon
      let customerIds: Set<string> | null = null;
      if (trimmed.name || trimmed.phone) {
        let q = supabase.from('customers').select('id').limit(2000);
        if (trimmed.name) {
          q = q.or(`company_name.ilike.%${trimmed.name}%,contact_name.ilike.%${trimmed.name}%`);
        }
        if (trimmed.phone) {
          q = q.ilike('phone', `%${trimmed.phone}%`);
        }
        const { data, error } = await q;
        if (error) throw error;
        customerIds = new Set((data || []).map((r: any) => r.id));
        if (customerIds.size === 0) { setHits([]); setLoading(false); return; }
      }

      // 3) Orders laden
      let q = supabase
        .from('orders')
        .select('id, order_number, order_status, order_date, total_amount, currency, billing_address, shipping_address, customers(id, company_name, contact_name, phone, billing_address, shipping_address)')
        .order('order_date', { ascending: false })
        .limit(500);

      if (trimmed.orderNumber) q = q.ilike('order_number', `%${trimmed.orderNumber}%`);
      if (customerIds) q = q.in('customer_id', Array.from(customerIds));
      if (modelOrderIds) q = q.in('id', Array.from(modelOrderIds));
      if (serialOrderIds) q = q.in('id', Array.from(serialOrderIds));
      if (notesOrderIds) q = q.in('id', Array.from(notesOrderIds));
      // Rolle Österreich: ausschließlich Aufträge aus Zoho EU 2 (-AT)
      if (atOnly) q = q.eq('source_system', 'zoho_eu_2');

      const { data: rows, error: oErr } = await q;
      if (oErr) throw oErr;

      let filtered = (rows || []) as any[];
      if (trimmed.zip) {
        const z = trimmed.zip.toLowerCase();
        filtered = filtered.filter(o => addr(o).zip.toLowerCase().includes(z));
      }
      if (trimmed.city) {
        const c = trimmed.city.toLowerCase();
        filtered = filtered.filter(o => addr(o).city.toLowerCase().includes(c));
      }

      const orderIds = filtered.map(o => o.id);
      const relatedByOrder: Record<string, Related> = {};
      for (const id of orderIds) relatedByOrder[id] = emptyRelated();

      if (orderIds.length) {
        const [
          { data: pos },
          { data: lager },
          { data: routes },
          { data: finance },
          { data: bank },
          { data: docs },
          { data: notes },
        ] = await Promise.all([
          supabase.from('production_orders')
            .select('id, order_id, production_order_number, modellname, status, approval_status, liefertermin, is_reclamation')
            .in('order_id', orderIds),
          supabase.from('lager_devices')
            .select('id, model_name, serial_number, reserved_order_id, notes')
            .in('reserved_order_id', orderIds),
          supabase.from('route_plans')
            .select('id, order_id, planned_date, planning_status, assigned_employee')
            .in('order_id', orderIds),
          supabase.from('finance_records')
            .select('id, order_id, invoice_status, amount_due, amount_paid, currency')
            .in('order_id', orderIds),
          supabase.from('bank_financing_requests')
            .select('id, order_id, status, decision_text, request_date')
            .in('order_id', orderIds),
          supabase.from('order_documents')
            .select('id, order_id, file_name, document_type, created_at')
            .in('order_id', orderIds),
          supabase.from('order_notes')
            .select('id, order_id, note_text, note_type, created_at')
            .in('order_id', orderIds),
        ]);

        for (const p of (pos || []) as any[]) {
          relatedByOrder[p.order_id]?.production.push(p);
        }
        for (const d of (lager || []) as any[]) {
          // Leihgeräte aus den verknüpften Lager-Treffern ausblenden
          const isLeih = /\[Typ:\s*Leihgerät\]|\[Leihgerät\]/.test(d.notes ?? '');
          if (isLeih) continue;
          relatedByOrder[d.reserved_order_id]?.lager.push(d);
        }
        for (const r of (routes || []) as any[]) {
          relatedByOrder[r.order_id]?.routes.push(r);
        }
        for (const f of (finance || []) as any[]) {
          relatedByOrder[f.order_id]?.finance.push(f);
        }
        for (const b of (bank || []) as any[]) {
          relatedByOrder[b.order_id]?.bank.push(b);
        }
        for (const d of (docs || []) as any[]) {
          relatedByOrder[d.order_id]?.documents.push(d);
        }
        for (const n of (notes || []) as any[]) {
          relatedByOrder[n.order_id]?.notes.push(n);
        }
      }

      const result: Hit[] = filtered.map(o => {
        const a = addr(o);
        const rel = relatedByOrder[o.id] || emptyRelated();
        const models = Array.from(new Set(rel.production.map(p => p.modellname).filter(Boolean) as string[]));
        return {
          id: o.id,
          order_number: o.order_number,
          order_status: o.order_status,
          order_date: o.order_date,
          total_amount: o.total_amount,
          currency: o.currency,
          customer_name: o.customers?.company_name || o.customers?.contact_name || '—',
          customer_phone: o.customers?.phone || null,
          zip: a.zip || null,
          city: a.city || null,
          models,
          related: rel,
        };
      });
      setHits(result);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <PageHeader
        icon={SearchCheck}
        title="Detailsuche"
        subtitle="Suche nach Name, PLZ, Wohnort, Auftragsnummer, Telefonnummer, Modell oder Seriennummer"
        noBreadcrumbs
      />

      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div><Label>Name (Firma / Kontakt)</Label>
            <Input value={form.name} onChange={update('name')} placeholder="z. B. Müller GmbH" /></div>
          <div><Label>PLZ</Label>
            <Input value={form.zip} onChange={update('zip')} placeholder="z. B. 12347" /></div>
          <div><Label>Wohnort</Label>
            <Input value={form.city} onChange={update('city')} placeholder="z. B. Berlin" /></div>
          <div><Label>Auftragsnummer</Label>
            <Input value={form.orderNumber} onChange={update('orderNumber')} placeholder="z. B. SO-00123" /></div>
          <div><Label>Telefonnummer</Label>
            <Input value={form.phone} onChange={update('phone')} placeholder="z. B. +49 …" /></div>
          <div><Label>Modell</Label>
            <Input value={form.model} onChange={update('model')} placeholder="z. B. Alix Infinity" list="detailsuche-modell-list" />
            <datalist id="detailsuche-modell-list">
              {ALIX_MODEL_GROUPS.flatMap(g => g.models).map(m => (
                <option key={m} value={m} />
              ))}
            </datalist></div>
          <div><Label>Seriennummer</Label>
            <Input value={form.serial} onChange={update('serial')} placeholder="z. B. SN-12345" autoComplete="off" data-1p-ignore data-lpignore="true" data-form-type="other" name="serial-search" /></div>
          <div className="md:col-span-2 lg:col-span-3"><Label>Notizen (Stichwort)</Label>
            <Input value={form.notes} onChange={update('notes')} placeholder="z. B. Star, Reklamation, Retoure – sucht in Auftrags-, Kunden- und Lagernotizen" /></div>
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button onClick={runSearch} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
            Suchen
          </Button>
          <Button variant="outline" onClick={reset} disabled={loading}>
            <X className="w-4 h-4 mr-2" /> Zurücksetzen
          </Button>
          <Button variant="secondary" onClick={loadAvailableOrders} disabled={loadingAvail}>
            {loadingAvail ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BookmarkPlus className="w-4 h-4 mr-2" />}
            Reservierung – verfügbare Aufträge
          </Button>
        </div>
        {error && <div className="text-sm text-destructive">{error}</div>}
      </div>

      {availOrders !== null && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 overflow-hidden">
          <div className="px-4 py-3 border-b border-amber-500/20 flex flex-wrap items-center gap-3">
            <BookmarkPlus className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold">Verfügbare Aufträge für Reservierung</h3>
            <span className="text-xs text-muted-foreground">({availOrders.length})</span>
            <div className="ml-auto flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap">Lagergerät:</Label>
              <select
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="">— wählen —</option>
                {unassignedLager.map(d => (
                  <option key={d.id} value={d.id}>
                    {(d.model_name || '—')} · SN {d.serial_number}
                  </option>
                ))}
              </select>
              <Button size="sm" variant="ghost" className="h-8" onClick={() => setAvailOrders(null)}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
          {unassignedLager.length === 0 && (
            <div className="px-4 py-2 text-xs text-muted-foreground border-b border-amber-500/20">
              Tipp: Zuerst per <strong>Seriennummer</strong> ein freies Lagergerät suchen, damit es zur Reservierung verfügbar ist.
            </div>
          )}
          <div className="divide-y divide-border max-h-[480px] overflow-y-auto">
            {availOrders.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                Keine offenen Aufträge ohne Reservierung gefunden.
              </div>
            ) : availOrders.map(o => (
              <div key={o.id} className="px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-1 hover:bg-amber-500/10">
                <button onClick={() => navigate(`/auftraege/${o.id}`)} className="font-medium hover:underline">
                  {o.order_number}
                </button>
                <span className="text-xs text-muted-foreground">{formatDate(o.order_date)}</span>
                <span className="text-sm">{o.customer_name}</span>
                <span className="text-xs text-muted-foreground">{[o.zip, o.city].filter(Boolean).join(' ')}</span>
                {o.open_models.length > 0 && (
                  <span className="text-xs text-amber-600 dark:text-amber-400">{o.open_models.join(', ')}</span>
                )}
                <Button
                  size="sm"
                  className="ml-auto"
                  disabled={!selectedDeviceId || reservingId === o.id}
                  onClick={() => reserveOrder(o.id)}
                >
                  {reservingId === o.id
                    ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                    : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
                  Reservieren
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {unassignedLager.length > 0 && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 overflow-hidden">
          <div className="px-4 py-3 border-b border-emerald-500/20 flex items-center gap-2">
            <Warehouse className="w-4 h-4 text-emerald-500" />
            <h3 className="text-sm font-semibold">Lagergeräte ohne Auftrag</h3>
            <span className="text-xs text-muted-foreground">({unassignedLager.length})</span>
          </div>
          <div className="divide-y divide-border">
            {unassignedLager.map(d => {
              const archived = /\[Status:\s*Archiviert\]/i.test(d.notes ?? '');
              return (
                <button
                  key={d.id}
                  onClick={() => navigate(`/lager/lagergeraete?serial=${encodeURIComponent(d.serial_number)}`)}
                  className="w-full text-left px-4 py-3 hover:bg-emerald-500/10 flex flex-wrap items-center gap-x-3 gap-y-1"
                >
                  <span className="font-medium">{d.model_name || '—'}</span>
                  <span className="font-mono text-xs text-muted-foreground">SN {d.serial_number}</span>
                  {archived && <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded bg-muted text-muted-foreground">Archiviert</span>}
                  <span className="text-xs text-muted-foreground ml-auto">Keinem Auftrag zugewiesen</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {hits !== null && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">

          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold">Ergebnisse</h3>
            <span className="text-xs text-muted-foreground">{hits.length} Treffer</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="w-10"></th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Auftragsnr.</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Datum</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Kunde</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">PLZ / Ort</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Vorgänge</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Status</th>
                  <th className="text-right px-4 py-3 text-muted-foreground font-medium">Betrag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {hits.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-12 text-center">
                    <Inbox className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                    <p className="text-muted-foreground">Keine Vorgänge gefunden.</p>
                  </td></tr>
                ) : hits.map(h => {
                  const isOpen = expanded.has(h.id);
                  const r = h.related;
                  const badges = [
                    { count: r.production.length, label: 'Bestellungen', icon: Factory, color: 'text-amber-500 bg-amber-500/10' },
                    { count: r.lager.length, label: 'Reservierungen', icon: Warehouse, color: 'text-emerald-500 bg-emerald-500/10' },
                    { count: r.routes.length, label: 'Zuweisungen', icon: MapPin, color: 'text-sky-500 bg-sky-500/10' },
                    { count: r.finance.length, label: 'Finance', icon: Banknote, color: 'text-violet-500 bg-violet-500/10' },
                    { count: r.bank.length, label: 'Bank', icon: Landmark, color: 'text-blue-500 bg-blue-500/10' },
                    { count: r.documents.length, label: 'Dokumente', icon: FileText, color: 'text-muted-foreground bg-muted/30' },
                    { count: r.notes.length, label: 'Notizen', icon: MessageSquare, color: 'text-muted-foreground bg-muted/30' },
                  ].filter(b => b.count > 0);
                  return (
                    <Fragment key={h.id}>
                      <tr key={h.id} className="hover:bg-secondary/30">
                        <td className="px-2">
                          <button onClick={() => toggleExpand(h.id)} className="p-1 hover:bg-muted rounded" aria-label="Vorgänge anzeigen">
                            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        </td>
                        <td className="px-4 py-3 font-medium cursor-pointer" onClick={() => navigate(`/auftraege/${h.id}`)}>{h.order_number}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(h.order_date)}</td>
                        <td className="px-4 py-3">
                          <div>{h.customer_name}</div>
                          {h.customer_phone && <div className="text-xs text-muted-foreground">{h.customer_phone}</div>}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{[h.zip, h.city].filter(Boolean).join(' ') || '—'}</td>
                        <td className="px-4 py-3">
                          {badges.length === 0 ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {badges.map(b => {
                                const Icon = b.icon;
                                return (
                                  <span key={b.label} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${b.color}`}>
                                    <Icon className="w-3 h-3" /> {b.count} {b.label}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                          {totalVorgaenge(r) > 0 && (
                            <button onClick={() => toggleExpand(h.id)} className="text-[11px] text-primary hover:underline mt-1">
                              {isOpen ? 'Details ausblenden' : 'Details anzeigen'}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={h.order_status} /></td>
                        <td className="px-4 py-3 text-right text-muted-foreground">
                          {h.total_amount != null ? `${Number(h.total_amount).toLocaleString('de-DE', { minimumFractionDigits: 2 })} ${h.currency || '€'}` : '—'}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr key={`${h.id}-d`} className="bg-secondary/20">
                          <td></td>
                          <td colSpan={7} className="px-4 py-4">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                              {r.production.length > 0 && (
                                <Section title="Bestellungen / Produktion" icon={Factory} color="text-amber-500">
                                  {r.production.map(p => (
                                    <button
                                      key={p.id}
                                      onClick={() => navigate(p.is_reclamation ? `/order/reklamation/${p.id}` : `/order/${p.id}`)}
                                      className="block text-left w-full hover:bg-muted/40 rounded px-2 py-1"
                                    >
                                      <span className="font-mono text-xs">{p.production_order_number || p.id.slice(0, 8)}</span>
                                      {p.modellname && <> · <span>{p.modellname}</span></>}
                                      <span className="text-xs text-muted-foreground"> · {p.status}{p.is_reclamation ? ' · Reklamation' : ''} · {p.approval_status}{p.liefertermin ? ` · ${formatDate(p.liefertermin)}` : ''}</span>
                                    </button>
                                  ))}
                                </Section>
                              )}
                              {r.lager.length > 0 && (
                                <Section title="Reservierungen Lagerbestand" icon={Warehouse} color="text-emerald-500">
                                  {r.lager.map(d => (
                                    <div key={d.id} className="px-2 py-1">
                                      <span className="font-medium">{d.model_name}</span>
                                      <span className="text-xs text-muted-foreground font-mono"> · SN {d.serial_number}</span>
                                    </div>
                                  ))}
                                </Section>
                              )}
                              {r.routes.length > 0 && (
                                <Section title="Zuweisungen / Tourenplanung" icon={MapPin} color="text-sky-500">
                                  {r.routes.map(rp => (
                                    <button
                                      key={rp.id}
                                      onClick={() => navigate(`/tourenplanung/${rp.id}`)}
                                      className="block text-left w-full hover:bg-muted/40 rounded px-2 py-1"
                                    >
                                      <span>{formatDate(rp.planned_date)}</span>
                                      <span className="text-xs text-muted-foreground"> · {rp.planning_status}{rp.assigned_employee ? ` · ${rp.assigned_employee}` : ''}</span>
                                    </button>
                                  ))}
                                </Section>
                              )}
                              {r.finance.length > 0 && (
                                <Section title="Finance" icon={Banknote} color="text-violet-500">
                                  {r.finance.map(f => (
                                    <button
                                      key={f.id}
                                      onClick={() => navigate(`/finance/${f.id}`)}
                                      className="block text-left w-full hover:bg-muted/40 rounded px-2 py-1"
                                    >
                                      <span>{f.invoice_status || '—'}</span>
                                      <span className="text-xs text-muted-foreground"> · Offen {Number(f.amount_due || 0).toLocaleString('de-DE')} / Gezahlt {Number(f.amount_paid || 0).toLocaleString('de-DE')} {f.currency || '€'}</span>
                                    </button>
                                  ))}
                                </Section>
                              )}
                              {r.bank.length > 0 && (
                                <Section title="Bankfinanzierung" icon={Landmark} color="text-blue-500">
                                  {r.bank.map(b => (
                                    <div key={b.id} className="px-2 py-1">
                                      <span>{b.status}</span>
                                      {b.decision_text && <span className="text-xs text-muted-foreground"> · {b.decision_text}</span>}
                                      {b.request_date && <span className="text-xs text-muted-foreground"> · {formatDate(b.request_date)}</span>}
                                    </div>
                                  ))}
                                </Section>
                              )}
                              {r.documents.length > 0 && (
                                <Section title="Dokumente" icon={FileText} color="text-muted-foreground">
                                  {r.documents.map(d => (
                                    <div key={d.id} className="px-2 py-1">
                                      <span className="font-medium">{d.file_name}</span>
                                      <span className="text-xs text-muted-foreground"> · {d.document_type || '—'} · {formatDate(d.created_at)}</span>
                                    </div>
                                  ))}
                                </Section>
                              )}
                              {r.notes.length > 0 && (
                                <Section title="Notizen" icon={MessageSquare} color="text-muted-foreground">
                                  {r.notes.map(n => (
                                    <div key={n.id} className="px-2 py-1">
                                      <div className="text-xs text-muted-foreground">{formatDate(n.created_at)} · {n.note_type || 'general'}</div>
                                      <div className="text-sm">{n.note_text}</div>
                                    </div>
                                  ))}
                                </Section>
                              )}
                              {totalVorgaenge(r) === 0 && (
                                <div className="text-sm text-muted-foreground italic">Keine zusätzlichen Vorgänge im System.</div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({
  title, icon: Icon, color, children,
}: { title: string; icon: any; color: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wide mb-2 ${color}`}>
        <Icon className="w-3.5 h-3.5" /> {title}
      </div>
      <div className="space-y-0.5 text-sm">{children}</div>
    </div>
  );
}

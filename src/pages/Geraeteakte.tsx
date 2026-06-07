import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Search, FileText, Wrench, Package, Receipt, Inbox, CircleDot,
  ShoppingCart, Truck, ShieldCheck, MapPin, Activity, Camera, Hammer, AlertTriangle, RefreshCw, Undo2,
} from 'lucide-react';

type AnyRow = any;

const EVENT_META: Record<string, { icon: any; cls: string }> = {
  Verkauf:     { icon: ShoppingCart,  cls: 'bg-blue-500/15 text-blue-300 border-blue-500/40' },
  Lieferung:   { icon: Truck,         cls: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40' },
  Wartung:     { icon: Wrench,        cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' },
  Reparatur:   { icon: Hammer,        cls: 'bg-amber-500/15 text-amber-300 border-amber-500/40' },
  Ersatzteil:  { icon: Package,       cls: 'bg-violet-500/15 text-violet-300 border-violet-500/40' },
  Reklamation: { icon: AlertTriangle, cls: 'bg-red-500/15 text-red-300 border-red-500/40' },
  Garantie:    { icon: ShieldCheck,   cls: 'bg-teal-500/15 text-teal-300 border-teal-500/40' },
  Leasing:     { icon: FileText,      cls: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/40' },
  Austausch:   { icon: RefreshCw,     cls: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/40' },
  'Rücknahme': { icon: Undo2,         cls: 'bg-slate-500/15 text-slate-300 border-slate-500/40' },
};

function Ampel({ status }: { status: 'gruen' | 'gelb' | 'rot' }) {
  const map = {
    gruen: { cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', label: 'Grün – keine offenen Vorgänge' },
    gelb:  { cls: 'bg-amber-500/20 text-amber-300 border-amber-500/40',       label: 'Gelb – Aktion erforderlich' },
    rot:   { cls: 'bg-red-500/20 text-red-300 border-red-500/40',             label: 'Rot – kritisch' },
  } as const;
  const c = map[status];
  return <Badge variant="outline" className={`gap-1 ${c.cls}`}><CircleDot className="w-3 h-3" /> {c.label}</Badge>;
}

function fmtDate(v: any) {
  if (!v) return '–';
  try { return new Date(v).toLocaleDateString('de-DE'); } catch { return String(v); }
}
function fmtDateTime(v: any) {
  if (!v) return '–';
  try { return new Date(v).toLocaleString('de-DE'); } catch { return String(v); }
}

function eventLink(ev: AnyRow): string | null {
  if (ev.event_source === 'orders') return `/auftraege/${ev.reference_id}`;
  if (ev.event_source === 'repair_orders') return `/reparatur/auftraege/${ev.reference_id}`;
  if (ev.event_source === 'tickets') return `/tickets/${ev.reference_id}`;
  if (ev.event_source === 'repair_spare_parts' && ev.meta?.repair_order_id) return `/reparatur/auftraege/${ev.meta.repair_order_id}`;
  if (ev.event_source === 'route_plans') return `/tourenplanung/${ev.reference_id}`;
  return null;
}

export default function Geraeteakte() {
  const [q, setQ] = useState('');
  const [serial, setSerial] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [serialOptions, setSerialOptions] = useState<{ serial: string; label?: string; customer?: string }[]>([]);

  const [lagerDevice, setLagerDevice] = useState<AnyRow | null>(null);
  const [order, setOrder] = useState<AnyRow | null>(null);
  const [customer, setCustomer] = useState<AnyRow | null>(null);
  const [warranty, setWarranty] = useState<AnyRow | null>(null);
  const [health, setHealth] = useState<AnyRow | null>(null);
  const [maintenances, setMaintenances] = useState<AnyRow[]>([]);
  const [lifecycle, setLifecycle] = useState<AnyRow[]>([]);
  const [tickets, setTickets] = useState<AnyRow[]>([]);
  const [repairs, setRepairs] = useState<AnyRow[]>([]);
  const [parts, setParts] = useState<AnyRow[]>([]);
  const [invoiceProps, setInvoiceProps] = useState<AnyRow[]>([]);
  const [quotes, setQuotes] = useState<AnyRow[]>([]);
  const [tours, setTours] = useState<AnyRow[]>([]);
  const [dispatchAttachments, setDispatchAttachments] = useState<AnyRow[]>([]);

  async function search() {
    const term = q.trim();
    if (!term) return;
    const like = `%${term}%`;

    const [tk, rp, ld] = await Promise.all([
      supabase.from('tickets')
        .select('serial_number,device_name,customer_name,order_number,ticket_number')
        .or(`serial_number.ilike.${like},customer_name.ilike.${like},order_number.ilike.${like},device_name.ilike.${like},ticket_number.ilike.${like}`)
        .not('serial_number', 'is', null).limit(50),
      supabase.from('repair_orders')
        .select('device_serial_number,device_brand,device_model,customer_name,order_number,repair_number')
        .or(`device_serial_number.ilike.${like},customer_name.ilike.${like},order_number.ilike.${like},device_brand.ilike.${like},device_model.ilike.${like},repair_number.ilike.${like}`)
        .not('device_serial_number', 'is', null).limit(50),
      supabase.from('lager_devices')
        .select('serial_number,model_name')
        .or(`serial_number.ilike.${like},model_name.ilike.${like}`)
        .limit(50),
    ]);

    const seen = new Map<string, { serial: string; label?: string; customer?: string }>();
    (tk.data || []).forEach((r: any) => seen.set(r.serial_number, { serial: r.serial_number, label: r.device_name, customer: r.customer_name }));
    (rp.data || []).forEach((r: any) => {
      if (!seen.has(r.device_serial_number)) {
        seen.set(r.device_serial_number, {
          serial: r.device_serial_number,
          label: [r.device_brand, r.device_model].filter(Boolean).join(' '),
          customer: r.customer_name,
        });
      }
    });
    (ld.data || []).forEach((r: any) => {
      if (!seen.has(r.serial_number)) seen.set(r.serial_number, { serial: r.serial_number, label: r.model_name });
    });
    setSerialOptions(Array.from(seen.values()));
  }

  async function loadSerial(s: string) {
    setSerial(s); setLoading(true);
    setLagerDevice(null); setOrder(null); setCustomer(null); setWarranty(null); setHealth(null);
    setMaintenances([]); setLifecycle([]); setTickets([]); setRepairs([]); setParts([]);
    setInvoiceProps([]); setQuotes([]); setTours([]); setDispatchAttachments([]);

    const [ld, dl, wr, dm, hs, tk, rp, tr] = await Promise.all([
      supabase.from('lager_devices').select('*').eq('serial_number', s).maybeSingle(),
      supabase.from('device_lifecycle').select('*').eq('serial_number', s).order('event_date', { ascending: false }),
      supabase.from('warranty_records').select('*').eq('serial_number', s).maybeSingle(),
      supabase.from('device_maintenance').select('*').eq('serial_number', s).order('next_maintenance_date', { ascending: true, nullsFirst: false }),
      supabase.from('device_health_scores').select('*').eq('serial_number', s).maybeSingle(),
      supabase.from('tickets').select('*').eq('serial_number', s).order('created_at', { ascending: false }),
      supabase.from('repair_orders').select('*').eq('device_serial_number', s).order('created_at', { ascending: false }),
      supabase.from('route_plans').select('*').eq('device_serial_number', s).order('planned_date', { ascending: false, nullsFirst: false }),
    ]);

    setLagerDevice(ld.data || null);
    setLifecycle(dl.data || []);
    setWarranty(wr.data || null);
    setMaintenances(dm.data || []);
    setHealth(hs.data || null);
    setTickets(tk.data || []);
    setRepairs(rp.data || []);
    setTours(tr.data || []);

    // Order via lager reservation
    const orderId = ld.data?.reserved_order_id;
    if (orderId) {
      const { data: o } = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle();
      setOrder(o || null);
      if (o?.customer_id) {
        const { data: c } = await supabase.from('customers').select('*').eq('id', o.customer_id).maybeSingle();
        setCustomer(c || null);
      }
    }

    const repairIds = (rp.data || []).map((r: any) => r.id);
    if (repairIds.length) {
      const [pa, iv, qv] = await Promise.all([
        supabase.from('repair_spare_parts').select('*').in('repair_order_id', repairIds).order('created_at', { ascending: false }),
        supabase.from('repair_invoice_proposals').select('*').in('repair_order_id', repairIds).order('created_at', { ascending: false }),
        supabase.from('repair_quotes').select('*').in('repair_order_id', repairIds).order('created_at', { ascending: false }),
      ]);
      setParts(pa.data || []);
      setInvoiceProps(iv.data || []);
      setQuotes(qv.data || []);
    }

    const tourIds = (tr.data || []).map((r: any) => r.id);
    if (tourIds.length) {
      const { data: att } = await supabase.from('dispatch_attachments').select('*').in('route_plan_id', tourIds).order('created_at', { ascending: false });
      setDispatchAttachments(att || []);
    }

    setLoading(false);
  }

  const ampel: 'gruen' | 'gelb' | 'rot' = useMemo(() => {
    if (health?.health_status === 'rot') return 'rot';
    if (health?.health_status === 'gelb') return 'gelb';
    const openRepairs = repairs.filter((r) => !['Ausgeliefert', 'Storniert'].includes(r.repair_status)).length;
    const openTickets = tickets.filter((t) => !['geschlossen', 'closed', 'gelöst'].includes((t.status || '').toLowerCase())).length;
    if (openRepairs >= 2) return 'rot';
    if (openTickets > 0 || openRepairs > 0) return 'gelb';
    return 'gruen';
  }, [tickets, repairs, health]);

  const warrantyBadge = useMemo(() => {
    if (!warranty) return { label: 'Keine Garantieerfassung', cls: 'bg-muted text-muted-foreground' };
    const end = warranty.warranty_end ? new Date(warranty.warranty_end) : null;
    if (!end) return { label: warranty.warranty_status || 'Unbekannt', cls: 'bg-muted text-foreground' };
    const now = new Date();
    if (end < now) return { label: `Abgelaufen (${fmtDate(end)})`, cls: 'bg-red-500/15 text-red-300 border-red-500/40' };
    const monthsLeft = (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30);
    if (monthsLeft <= 3) return { label: `Läuft bald ab (${fmtDate(end)})`, cls: 'bg-amber-500/15 text-amber-300 border-amber-500/40' };
    return { label: `Aktiv bis ${fmtDate(end)}`, cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' };
  }, [warranty]);

  const nextMaintenance = maintenances.find((m) => m.next_maintenance_date);
  const overdue = !!(nextMaintenance?.next_maintenance_date && new Date(nextMaintenance.next_maintenance_date) < new Date());

  async function openAttachment(bucket: string, path: string) {
    const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  }

  return (
    <div className="p-6 lg:p-8 space-y-4 animate-fade-in">
      <div className="flex items-center gap-3 flex-wrap">
        <FileText className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-display font-bold text-foreground">Geräteakte</h1>
        <Badge variant="outline">Service · Reparatur · Tour · Finance</Badge>
      </div>

      <Card className="p-4 space-y-3">
        <Label className="text-xs">Suche (Seriennummer, Modell, Kunde, Auftrag, Ticket-Nr., Reparatur-Nr.)</Label>
        <div className="flex gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} placeholder="z. B. SN-1234 / TIC-001 / REP-000123 / Mustermann GmbH" />
          <Button onClick={search}><Search className="w-4 h-4 mr-1" /> Suchen</Button>
        </div>

        {serialOptions.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
            {serialOptions.map((o) => (
              <button key={o.serial} onClick={() => loadSerial(o.serial)} className="text-left p-3 rounded-lg border border-border hover:border-primary transition">
                <div className="font-mono text-sm font-semibold">{o.serial}</div>
                <div className="text-xs text-muted-foreground">{o.label || '–'}</div>
                <div className="text-xs text-muted-foreground">{o.customer || '–'}</div>
              </button>
            ))}
          </div>
        )}
      </Card>

      {serial && (
        <>
          {/* Stammdaten */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="text-xs text-muted-foreground">Seriennummer</div>
                <div className="font-mono text-lg font-bold">{serial}</div>
              </div>
              <div className="flex gap-2 flex-wrap items-center">
                <Badge variant="outline" className={warrantyBadge.cls}>
                  <ShieldCheck className="w-3 h-3 mr-1" />{warrantyBadge.label}
                </Badge>
                {overdue && (
                  <Badge variant="outline" className="bg-red-500/15 text-red-300 border-red-500/40">
                    <AlertTriangle className="w-3 h-3 mr-1" />Wartung überfällig
                  </Badge>
                )}
                <Ampel status={ampel} />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-sm pt-2">
              <Field label="Modell" value={lagerDevice?.model_name || (repairs[0]?.device_brand ? `${repairs[0].device_brand} ${repairs[0].device_model || ''}` : tickets[0]?.device_name)} />
              <Field label="Standort/Lager" value={lagerDevice?.warehouse || lagerDevice?.location} />
              <Field label="Status (Lager)" value={lagerDevice?.status} />
              <Field label="Kunde" value={customer?.company_name || customer?.contact_name || order?.customer_name} />
              <Field label="Auftrag" value={order?.order_number} />
              <Field label="Kaufdatum / Auftrag" value={fmtDate(order?.order_date || order?.created_at)} />
              <Field label="Lieferdatum" value={fmtDate(order?.delivery_date)} />
              <Field label="Auftragsstatus" value={order?.order_status} />
              <Field label="Garantie-Start" value={fmtDate(warranty?.warranty_start)} />
              <Field label="Garantie-Ende" value={fmtDate(warranty?.warranty_end)} />
              <Field label="Letzte Wartung" value={fmtDate(nextMaintenance?.last_maintenance_date)} />
              <Field label="Nächste Wartung" value={fmtDate(nextMaintenance?.next_maintenance_date)} />
            </div>
          </Card>

          {/* Tabs */}
          <Card className="p-4 space-y-3">
            <Tabs defaultValue="timeline">
              <TabsList className="flex flex-wrap h-auto">
                <TabsTrigger value="timeline"><Activity className="w-3 h-3 mr-1" /> Zeitstrahl ({lifecycle.length})</TabsTrigger>
                <TabsTrigger value="tickets"><Inbox className="w-3 h-3 mr-1" /> Tickets ({tickets.length})</TabsTrigger>
                <TabsTrigger value="repairs"><Wrench className="w-3 h-3 mr-1" /> Reparaturen ({repairs.length})</TabsTrigger>
                <TabsTrigger value="tours"><MapPin className="w-3 h-3 mr-1" /> Touren ({tours.length})</TabsTrigger>
                <TabsTrigger value="parts"><Package className="w-3 h-3 mr-1" /> Ersatzteile ({parts.length})</TabsTrigger>
                <TabsTrigger value="quotes"><Receipt className="w-3 h-3 mr-1" /> KV ({quotes.length})</TabsTrigger>
                <TabsTrigger value="invoices"><Receipt className="w-3 h-3 mr-1" /> Rechnungen ({invoiceProps.length})</TabsTrigger>
                <TabsTrigger value="docs"><Camera className="w-3 h-3 mr-1" /> Dokumente</TabsTrigger>
                <TabsTrigger value="maintenance"><Wrench className="w-3 h-3 mr-1" /> Wartung ({maintenances.length})</TabsTrigger>
                <TabsTrigger value="warranty"><ShieldCheck className="w-3 h-3 mr-1" /> Garantie</TabsTrigger>
              </TabsList>

              <TabsContent value="timeline">
                {loading ? <Empty>Lade…</Empty> : lifecycle.length === 0 ? <Empty>Keine Ereignisse.</Empty> : (
                  <ol className="relative border-l border-border ml-2 mt-3 space-y-3">
                    {lifecycle.map((ev) => {
                      const m = EVENT_META[ev.event_type] || { icon: CircleDot, cls: 'bg-muted text-foreground border-border' };
                      const Icon = m.icon;
                      const link = eventLink(ev);
                      const inner = (
                        <div className={`rounded-lg border p-3 ${m.cls}`}>
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2 font-semibold text-xs">
                              <Icon className="w-3 h-3" />{ev.event_type}
                            </div>
                            <span className="text-[10px] opacity-80">{fmtDateTime(ev.event_date)}</span>
                          </div>
                          <div className="text-xs mt-1 opacity-90">{ev.description || '–'}</div>
                          {ev.customer_name && <div className="text-[10px] opacity-70 mt-0.5">{ev.customer_name}</div>}
                        </div>
                      );
                      return (
                        <li key={ev.id} className="ml-4">
                          <div className="absolute -left-1.5 w-3 h-3 rounded-full bg-primary border-2 border-background" />
                          {link ? <Link to={link} className="block hover:opacity-90">{inner}</Link> : inner}
                        </li>
                      );
                    })}
                  </ol>
                )}
              </TabsContent>

              <TabsContent value="tickets">
                <ListBlock loading={loading} rows={tickets} cols={[
                  { k: 'created_at', l: 'Datum', f: (v) => fmtDate(v) },
                  { k: 'ticket_number', l: 'Nr.' },
                  { k: 'title', l: 'Titel' },
                  { k: 'status', l: 'Status' },
                  { k: 'priority', l: 'Priorität' },
                ]} linkBase="/tickets/" />
              </TabsContent>

              <TabsContent value="repairs">
                <ListBlock loading={loading} rows={repairs} cols={[
                  { k: 'created_at', l: 'Datum', f: (v) => fmtDate(v) },
                  { k: 'repair_number', l: 'Nr.' },
                  { k: 'device_brand', l: 'Marke' },
                  { k: 'device_model', l: 'Modell' },
                  { k: 'repair_status', l: 'Status' },
                ]} linkBase="/reparatur/auftraege/" />
              </TabsContent>

              <TabsContent value="tours">
                <ListBlock loading={loading} rows={tours} cols={[
                  { k: 'planned_date', l: 'Datum', f: (v) => fmtDate(v) },
                  { k: 'tour_type', l: 'Einsatzart' },
                  { k: 'assigned_employee', l: 'Techniker' },
                  { k: 'planning_status', l: 'Status' },
                  { k: 'result_outcome', l: 'Ergebnis' },
                ]} linkBase="/tourenplanung/" />
              </TabsContent>

              <TabsContent value="parts">
                <ListBlock loading={loading} rows={parts} cols={[
                  { k: 'created_at', l: 'Datum', f: (v) => fmtDate(v) },
                  { k: 'part_name', l: 'Teil' },
                  { k: 'quantity', l: 'Menge' },
                  { k: 'status', l: 'Status' },
                  { k: 'priority', l: 'Priorität' },
                ]} />
              </TabsContent>

              <TabsContent value="quotes">
                <ListBlock loading={loading} rows={quotes} cols={[
                  { k: 'created_at', l: 'Datum', f: (v) => fmtDate(v) },
                  { k: 'quote_number', l: 'KV-Nr.' },
                  { k: 'total_amount', l: 'Summe', f: (v, r) => `${Number(v || 0).toFixed(2)} ${r.currency || 'EUR'}` },
                  { k: 'status', l: 'Status' },
                ]} />
              </TabsContent>

              <TabsContent value="invoices">
                <ListBlock loading={loading} rows={invoiceProps} cols={[
                  { k: 'created_at', l: 'Datum', f: (v) => fmtDate(v) },
                  { k: 'repair_number', l: 'Reparatur' },
                  { k: 'total_amount', l: 'Summe', f: (v, r) => `${Number(v || 0).toFixed(2)} ${r.currency || 'EUR'}` },
                  { k: 'status', l: 'Status' },
                ]} />
              </TabsContent>

              <TabsContent value="docs">
                {loading ? <Empty>Lade…</Empty> : (
                  <div className="space-y-3 mt-2">
                    {repairs.filter(r => r.report_pdf_path).map(r => (
                      <DocLink key={`rrep-${r.id}`} label={`Reparaturbericht ${r.repair_number}`} bucket="repair-files" path={r.report_pdf_path} onOpen={openAttachment} />
                    ))}
                    {repairs.filter(r => r.handover_pdf_path).map(r => (
                      <DocLink key={`rhand-${r.id}`} label={`Annahmebeleg ${r.repair_number}`} bucket="repair-files" path={r.handover_pdf_path} onOpen={openAttachment} />
                    ))}
                    {quotes.filter(q => q.pdf_path).map(q => (
                      <DocLink key={`kv-${q.id}`} label={`Kostenvoranschlag ${q.quote_number}`} bucket="repair-files" path={q.pdf_path} onOpen={openAttachment} />
                    ))}
                    {tours.filter(t => t.report_pdf_path).map(t => (
                      <DocLink key={`tour-${t.id}`} label={`Servicebericht Tour ${fmtDate(t.planned_date)}`} bucket="repair-files" path={t.report_pdf_path} onOpen={openAttachment} />
                    ))}
                    {tours.filter(t => t.signature_path).map(t => (
                      <DocLink key={`sig-${t.id}`} label={`Kundensignatur Tour ${fmtDate(t.planned_date)}`} bucket="repair-files" path={t.signature_path} onOpen={openAttachment} />
                    ))}
                    {dispatchAttachments.map(a => (
                      <DocLink key={`att-${a.id}`} label={a.file_name || a.file_path} bucket="repair-files" path={a.file_path} onOpen={openAttachment} />
                    ))}
                    {repairs.length === 0 && quotes.length === 0 && tours.length === 0 && dispatchAttachments.length === 0 && (
                      <Empty>Keine Dokumente vorhanden.</Empty>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="maintenance">
                <ListBlock loading={loading} rows={maintenances} cols={[
                  { k: 'last_maintenance_date', l: 'Letzte Wartung', f: (v) => fmtDate(v) },
                  { k: 'next_maintenance_date', l: 'Nächste Wartung', f: (v) => fmtDate(v) },
                  { k: 'maintenance_status', l: 'Status' },
                ]} />
              </TabsContent>

              <TabsContent value="warranty">
                {warranty ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm mt-2">
                    <Field label="Garantietyp" value={warranty.warranty_type} />
                    <Field label="Garantiestatus" value={warranty.warranty_status} />
                    <Field label="Start" value={fmtDate(warranty.warranty_start)} />
                    <Field label="Ende" value={fmtDate(warranty.warranty_end)} />
                    <Field label="Hersteller" value={warranty.manufacturer} />
                    <Field label="Vertrag" value={warranty.contract_number} />
                  </div>
                ) : <Empty>Keine Garantieerfassung für dieses Gerät.</Empty>}
              </TabsContent>
            </Tabs>
          </Card>
        </>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value?: any }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-medium text-foreground">{value || '–'}</div>
    </div>
  );
}

function Empty({ children }: { children: any }) {
  return <div className="p-6 text-center text-muted-foreground text-sm">{children}</div>;
}

function DocLink({ label, bucket, path, onOpen }: { label: string; bucket: string; path: string; onOpen: (b: string, p: string) => void }) {
  return (
    <button onClick={() => onOpen(bucket, path)} className="w-full text-left rounded-lg border border-border bg-card hover:border-primary p-3 flex items-center justify-between transition">
      <span className="flex items-center gap-2 text-sm"><FileText className="w-4 h-4 text-primary" />{label}</span>
      <span className="text-xs text-muted-foreground truncate max-w-xs">{path}</span>
    </button>
  );
}

function ListBlock({ rows, cols, loading, linkBase }: { rows: any[]; cols: { k: string; l: string; f?: (v: any, r: any) => string }[]; loading: boolean; linkBase?: string }) {
  if (loading) return <Empty>Lade…</Empty>;
  if (!rows.length) return <Empty>Keine Einträge.</Empty>;
  return (
    <div className="overflow-x-auto mt-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground border-b border-border">
            {cols.map((c) => <th key={c.k} className="py-2 pr-3">{c.l}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const content = cols.map((c) => <td key={c.k} className="py-2 pr-3">{c.f ? c.f(r[c.k], r) : (r[c.k] ?? '–')}</td>);
            return (
              <tr key={r.id} className="border-b border-border/40 hover:bg-muted/30">
                {linkBase ? (
                  <td colSpan={cols.length} className="p-0">
                    <Link to={linkBase + r.id} className="grid items-center py-0" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0,1fr))` }}>{content}</Link>
                  </td>
                ) : content}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

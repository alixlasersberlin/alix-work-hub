import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  Loader2, Truck, AlertTriangle, CalendarCheck, CalendarClock, ExternalLink,
  RefreshCw, Mail, Download, ShieldAlert, CheckCircle2, Clock, Search,
} from 'lucide-react';
import DeliveryBlockersCard from '@/components/delivery/DeliveryBlockersCard';
import {
  computeEtaState, computeTrafficLight, isWaitingForCustomer, daysUntil,
  ETA_STATE_LABELS, TRAFFIC_LABELS, TRAFFIC_CLASSES, PRIORITIES,
  type DeliveryRowInput, type TrafficLight,
} from '@/lib/delivery/control-tower';

const db = supabase as any;

const PHASE_LABELS: Record<string, string> = {
  auto: 'Automatisch',
  order_received: 'Auftrag eingegangen',
  order_check: 'Auftragsprüfung',
  production_planned: 'Produktion geplant',
  in_production: 'In Produktion',
  qc: 'Qualitätsprüfung',
  provisioning: 'Bereitstellung',
  tour_planning: 'Tourenplanung',
  out_for_delivery: 'Auslieferung',
  delivered: 'Geliefert',
};

type ViewKey =
  | 'all' | 'today' | 'tomorrow' | 'this_week' | 'next_week' | 'overdue'
  | 'ready' | 'at_risk' | 'blocked' | 'waiting_customer' | 'delivered_week';

interface Row {
  order_id: string;
  phase: string | null;
  eta_planned: string | null;
  eta_confirmed: boolean | null;
  is_delayed: boolean | null;
  qc_completed_at: string | null;
  production_end_planned: string | null;
  tour_id: string | null;
  priority: string | null;
  customer_response: string | null;
  customer_alternative_date: string | null;
  address_confirmed: boolean | null;
  last_status_change: string | null;
  order_number: string | null;
  customer_name: string | null;
  order_status: string | null;
  open_blockers: number;
  light: TrafficLight;
  light_reasons: string[];
  eta_state: string;
  waiting_customer: boolean;
}

function fmt(v?: string | null) {
  if (!v) return '–';
  try { return new Date(v).toLocaleDateString('de-DE'); } catch { return '–'; }
}

export default function DeliveryControlTower() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [phase, setPhase] = useState('all');
  const [view, setView] = useState<ViewKey>('all');
  const [detail, setDetail] = useState<Row | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [newDate, setNewDate] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [{ data }, { data: blockers }] = await Promise.all([
        db.from('order_delivery_status')
          .select('order_id, phase, eta_planned, eta_confirmed, is_delayed, qc_completed_at, production_end_planned, tour_id, priority, customer_response, customer_alternative_date, address_confirmed, last_status_change, orders(order_number, customer_name, order_status)')
          .order('eta_planned', { ascending: true, nullsFirst: false })
          .limit(1000),
        db.from('order_delivery_blockers').select('order_id').neq('blocker_status', 'resolved'),
      ]);

      const blockerCount = new Map<string, number>();
      ((blockers ?? []) as any[]).forEach((b) => {
        blockerCount.set(b.order_id, (blockerCount.get(b.order_id) ?? 0) + 1);
      });

      const mapped: Row[] = ((data ?? []) as any[]).map((r) => {
        const orderStatus = String(r.orders?.order_status ?? '').toLowerCase();
        const input: DeliveryRowInput = {
          phase: r.phase,
          eta_planned: r.eta_planned,
          eta_confirmed: r.eta_confirmed,
          is_delayed: r.is_delayed,
          qc_completed_at: r.qc_completed_at,
          production_end_planned: r.production_end_planned,
          tour_id: r.tour_id,
          tour_planned: Boolean(r.tour_id),
          customer_response: r.customer_response,
          delivered: r.phase === 'delivered' || orderStatus === 'geliefert' || orderStatus === 'abgeschlossen',
          open_blockers: blockerCount.get(r.order_id) ?? 0,
        };
        const { light, reasons } = computeTrafficLight(input);
        return {
          ...r,
          order_number: r.orders?.order_number ?? null,
          customer_name: r.orders?.customer_name ?? null,
          order_status: r.orders?.order_status ?? null,
          open_blockers: input.open_blockers,
          light,
          light_reasons: reasons,
          eta_state: computeEtaState(input),
          waiting_customer: isWaitingForCustomer(input),
        } as Row;
      });
      setRows(mapped);
    } catch (e: any) {
      toast.error(e?.message ?? 'Daten konnten nicht geladen werden');
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const kpi = useMemo(() => {
    const d = (r: Row) => daysUntil(r.eta_planned);
    return {
      today: rows.filter((r) => d(r) === 0).length,
      tomorrow: rows.filter((r) => d(r) === 1).length,
      week: rows.filter((r) => { const x = d(r); return x !== null && x >= 0 && x <= 7; }).length,
      ready: rows.filter((r) => r.tour_id && r.eta_confirmed && r.eta_state !== 'delivered').length,
      atRisk: rows.filter((r) => r.light === 'gelb').length,
      blocked: rows.filter((r) => r.open_blockers > 0).length,
      waiting: rows.filter((r) => r.waiting_customer).length,
      delayed: rows.filter((r) => r.eta_state === 'delayed').length,
      deliveredWeek: rows.filter((r) => r.eta_state === 'delivered' && (d(r) ?? -99) >= -7).length,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      const d = daysUntil(r.eta_planned);
      if (phase !== 'all' && (r.phase ?? 'auto') !== phase) return false;
      switch (view) {
        case 'today': if (d !== 0) return false; break;
        case 'tomorrow': if (d !== 1) return false; break;
        case 'this_week': if (d === null || d < 0 || d > 7) return false; break;
        case 'next_week': if (d === null || d < 8 || d > 14) return false; break;
        case 'overdue': if (r.eta_state !== 'delayed') return false; break;
        case 'ready': if (!(r.tour_id && r.eta_confirmed)) return false; break;
        case 'at_risk': if (r.light !== 'gelb' && r.light !== 'rot') return false; break;
        case 'blocked': if (r.open_blockers === 0) return false; break;
        case 'waiting_customer': if (!r.waiting_customer) return false; break;
        case 'delivered_week': if (r.eta_state !== 'delivered') return false; break;
        default: break;
      }
      if (needle) {
        const hay = `${r.order_number ?? ''} ${r.customer_name ?? ''}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, q, phase, view]);

  const tiles: { key: ViewKey; label: string; value: number; icon: typeof Truck }[] = [
    { key: 'today', label: 'Lieferungen heute', value: kpi.today, icon: Truck },
    { key: 'tomorrow', label: 'Lieferungen morgen', value: kpi.tomorrow, icon: CalendarClock },
    { key: 'this_week', label: 'Diese Woche', value: kpi.week, icon: CalendarCheck },
    { key: 'ready', label: 'Bereit zur Tour', value: kpi.ready, icon: CheckCircle2 },
    { key: 'at_risk', label: 'Termin gefährdet', value: kpi.atRisk, icon: AlertTriangle },
    { key: 'blocked', label: 'Blockiert', value: kpi.blocked, icon: ShieldAlert },
    { key: 'waiting_customer', label: 'Wartet auf Kunde', value: kpi.waiting, icon: Clock },
    { key: 'overdue', label: 'Verspätet', value: kpi.delayed, icon: AlertTriangle },
    { key: 'delivered_week', label: 'Geliefert', value: kpi.deliveredWeek, icon: CheckCircle2 },
  ];

  async function quickSetDate(r: Row) {
    if (!newDate) return;
    setBusy('date');
    const { error } = await db.from('order_delivery_status')
      .update({ eta_planned: newDate, eta_confirmed: false, last_status_change: new Date().toISOString() })
      .eq('order_id', r.order_id);
    setBusy(null);
    if (error) { toast.error('Termin konnte nicht gesetzt werden'); return; }
    await db.from('order_delivery_events').insert({
      order_id: r.order_id,
      event_type: 'eta_changed',
      title: 'Liefertermin aktualisiert',
      description: `Neuer Liefertermin: ${new Date(newDate).toLocaleDateString('de-DE')}`,
      visible_to_customer: true,
    });
    toast.success('Liefertermin gesetzt');
    setNewDate('');
    await load();
  }

  async function notify(r: Row) {
    setBusy('notify');
    try {
      const { error } = await supabase.functions.invoke('delivery-notify', { body: { order_id: r.order_id, force: true } });
      if (error) throw error;
      await db.from('order_delivery_comms').insert({
        order_id: r.order_id, channel: 'email', direction: 'outbound',
        event_key: 'manual_notify', subject: 'Lieferstatus-Information',
      });
      toast.success('Kunde benachrichtigt');
    } catch (e: any) {
      toast.error(e?.message ?? 'Versand fehlgeschlagen');
    }
    setBusy(null);
  }

  async function setPriority(r: Row, value: string) {
    const { error } = await db.from('order_delivery_status').update({ priority: value }).eq('order_id', r.order_id);
    if (error) { toast.error('Priorität konnte nicht gesetzt werden'); return; }
    toast.success('Priorität aktualisiert');
    setDetail({ ...r, priority: value });
    await load();
  }

  function exportCsv() {
    const head = ['Auftrag', 'Kunde', 'Phase', 'Liefertermin', 'ETA-Zustand', 'Ampel', 'Blocker', 'Kundenbestätigung', 'Priorität'];
    const lines = filtered.map((r) => [
      r.order_number ?? '', r.customer_name ?? '',
      PHASE_LABELS[r.phase ?? 'auto'] ?? r.phase ?? '',
      fmt(r.eta_planned),
      ETA_STATE_LABELS[r.eta_state as keyof typeof ETA_STATE_LABELS] ?? r.eta_state,
      TRAFFIC_LABELS[r.light], String(r.open_blockers),
      r.eta_confirmed ? 'bestätigt' : (r.customer_response ?? 'offen'),
      r.priority ?? 'normal',
    ]);
    const csv = [head, ...lines].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `control-tower-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Delivery Control Tower</h1>
          <p className="text-sm text-muted-foreground">
            Operative Gesamtübersicht aller Lieferungen mit regelbasierter Ampel, Blockern und Kundenaktionen.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm"><Link to="/dispatch/lieferstatus">Lieferstatus-Cockpit</Link></Button>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1.5" />} Aktualisieren
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((t) => (
          <button key={t.key} type="button" onClick={() => setView(view === t.key ? 'all' : t.key)} className="text-left">
            <Card className={view === t.key ? 'border-primary' : ''}>
              <CardContent className="p-4 flex items-center gap-3">
                <t.icon className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
                <div>
                  <div className="text-2xl font-semibold">{t.value}</div>
                  <div className="text-xs text-muted-foreground">{t.label}</div>
                </div>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 flex-wrap">
          <CardTitle className="text-base">Lieferungen ({filtered.length})</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                placeholder="Auftrag, Kunde, Ort…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-60 pl-8"
                aria-label="Lieferungen durchsuchen"
              />
            </div>
            <Select value={phase} onValueChange={setPhase}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Phasen</SelectItem>
                {Object.entries(PHASE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={view} onValueChange={(v) => setView(v as ViewKey)}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="today">Heute</SelectItem>
                <SelectItem value="tomorrow">Morgen</SelectItem>
                <SelectItem value="this_week">Diese Woche</SelectItem>
                <SelectItem value="next_week">Nächste Woche</SelectItem>
                <SelectItem value="overdue">Überfällig</SelectItem>
                <SelectItem value="at_risk">Gefährdet</SelectItem>
                <SelectItem value="blocked">Blockiert</SelectItem>
                <SelectItem value="waiting_customer">Wartet auf Kunde</SelectItem>
                <SelectItem value="ready">Bereit zur Tour</SelectItem>
                <SelectItem value="delivered_week">Geliefert</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download className="w-4 h-4 mr-1.5" /> CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading && <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>}
          {!loading && filtered.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">Keine Lieferungen für diese Auswahl.</p>
          )}
          {!loading && filtered.map((r, idx) => (
            <button
              type="button"
              key={r.order_id}
              onClick={() => { setDetail(r); setNewDate(r.eta_planned ?? ''); }}
              className={`w-full text-left flex items-center gap-3 flex-wrap rounded-md border p-3 hover:border-primary transition-colors ${idx % 2 === 1 ? 'bg-muted/30' : ''}`}
            >
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${TRAFFIC_CLASSES[r.light]}`}
                title={r.light_reasons.join(' · ')}
              >
                {TRAFFIC_LABELS[r.light]}
              </span>
              <div className="min-w-[180px]">
                <div className="font-medium text-sm">{r.order_number ?? '–'}</div>
                <div className="text-xs text-muted-foreground">{r.customer_name ?? '–'}</div>
              </div>
              <Badge variant="outline">{PHASE_LABELS[r.phase ?? 'auto'] ?? r.phase}</Badge>
              <Badge variant="secondary">{ETA_STATE_LABELS[r.eta_state as keyof typeof ETA_STATE_LABELS] ?? r.eta_state}</Badge>
              <span className="text-xs text-muted-foreground">
                Liefertermin: <span className="text-foreground">{fmt(r.eta_planned)}</span>
              </span>
              {r.open_blockers > 0 && (
                <Badge variant="destructive" className="gap-1"><ShieldAlert className="w-3 h-3" /> {r.open_blockers}</Badge>
              )}
              {r.waiting_customer && <Badge variant="outline">Wartet auf Kunde</Badge>}
              {r.priority && r.priority !== 'normal' && <Badge>{r.priority.toUpperCase()}</Badge>}
              <span className="ml-auto text-xs text-muted-foreground hidden md:inline">
                {r.last_status_change ? new Date(r.last_status_change).toLocaleString('de-DE') : ''}
              </span>
            </button>
          ))}
        </CardContent>
      </Card>

      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent className="w-full sm:max-w-xl p-0">
          {detail && (
            <ScrollArea className="h-full">
              <div className="p-6 space-y-4">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    {detail.order_number}
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${TRAFFIC_CLASSES[detail.light]}`}>
                      {TRAFFIC_LABELS[detail.light]}
                    </span>
                  </SheetTitle>
                </SheetHeader>

                <div className="text-sm text-muted-foreground">{detail.customer_name}</div>

                <Card>
                  <CardContent className="p-4 space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Phase</span><span>{PHASE_LABELS[detail.phase ?? 'auto']}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Liefertermin</span><span>{fmt(detail.eta_planned)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Terminsicherheit</span><span>{ETA_STATE_LABELS[detail.eta_state as keyof typeof ETA_STATE_LABELS]}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Kundenbestätigung</span><span>{detail.eta_confirmed ? 'bestätigt' : (detail.customer_response ?? 'offen')}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Lieferadresse</span><span>{detail.address_confirmed ? 'vom Kunden bestätigt' : 'nicht bestätigt'}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Tour</span><span>{detail.tour_id ? 'geplant' : 'nicht geplant'}</span></div>
                    <div className="pt-1 text-xs text-muted-foreground">Ampelbegründung: {detail.light_reasons.join(' · ')}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">Schnellaktionen</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <label className="text-xs text-muted-foreground" htmlFor="ct-date">Liefertermin setzen / ändern</label>
                        <Input id="ct-date" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                      </div>
                      <Button size="sm" onClick={() => quickSetDate(detail)} disabled={!newDate || busy === 'date'}>
                        {busy === 'date' && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />} Übernehmen
                      </Button>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Priorität</label>
                      <Select value={detail.priority ?? 'normal'} onValueChange={(v) => setPriority(detail, v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => notify(detail)} disabled={busy === 'notify'}>
                        {busy === 'notify' ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Mail className="w-4 h-4 mr-1.5" />} Kunde benachrichtigen
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/auftraege/${detail.order_id}?tab=lieferstatus`}>
                          <ExternalLink className="w-4 h-4 mr-1.5" /> Auftrag öffnen
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="ghost">
                        <Link to="/dispatch/touren"><Truck className="w-4 h-4 mr-1.5" /> Tourenplanung</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">Blocker</CardTitle></CardHeader>
                  <CardContent>
                    <DeliveryBlockersCard orderId={detail.order_id} compact onChanged={load} />
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

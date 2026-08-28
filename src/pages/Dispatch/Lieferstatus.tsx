import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Truck, AlertTriangle, CalendarCheck, CalendarClock, ExternalLink, RefreshCw } from 'lucide-react';

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

interface Row {
  order_id: string;
  phase: string | null;
  eta_planned: string | null;
  eta_confirmed: boolean | null;
  is_delayed: boolean | null;
  customer_response: string | null;
  customer_alternative_date: string | null;
  customer_response_note: string | null;
  last_status_change: string | null;
  order_number: string | null;
  customer_name: string | null;
}

function fmt(v?: string | null) {
  if (!v) return '–';
  try { return new Date(v).toLocaleDateString('de-DE'); } catch { return '–'; }
}

export default function DispatchLieferstatus() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [phase, setPhase] = useState('all');
  const [view, setView] = useState<'all' | 'delayed' | 'unconfirmed' | 'change_requested'>('all');

  async function load() {
    setLoading(true);
    const { data } = await db
      .from('order_delivery_status')
      .select('order_id, phase, eta_planned, eta_confirmed, is_delayed, customer_response, customer_alternative_date, customer_response_note, last_status_change, orders(order_number, customer_name)')
      .order('last_status_change', { ascending: false })
      .limit(500);
    setRows(
      (data ?? []).map((r: any) => ({
        ...r,
        order_number: r.orders?.order_number ?? null,
        customer_name: r.orders?.customer_name ?? null,
      })),
    );
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function resolveRequest(r: Row, action: 'accept' | 'reject') {
    setBusy(r.order_id);
    try {
      const patch: Record<string, unknown> = {
        customer_response: action === 'accept' ? 'confirmed' : null,
        customer_responded_at: new Date().toISOString(),
        last_status_change: new Date().toISOString(),
      };
      if (action === 'accept' && r.customer_alternative_date) {
        patch.eta_planned = r.customer_alternative_date;
        patch.eta_confirmed = true;
        patch.customer_alternative_date = null;
      } else if (action === 'reject') {
        patch.customer_alternative_date = null;
        patch.eta_confirmed = false;
      }
      const { error } = await db.from('order_delivery_status').update(patch).eq('order_id', r.order_id);
      if (error) throw error;

      await db.from('order_delivery_events').insert({
        order_id: r.order_id,
        event_type: action === 'accept' ? 'customer_request_accepted' : 'customer_request_rejected',
        title: action === 'accept' ? 'Wunschtermin des Kunden übernommen' : 'Terminwunsch des Kunden abgelehnt',
        description: r.customer_response_note ?? null,
      });

      try {
        await supabase.functions.invoke('delivery-notify', { body: { order_id: r.order_id } });
      } catch { /* Benachrichtigung ist optional */ }

      toast.success(action === 'accept' ? 'Wunschtermin übernommen' : 'Terminwunsch abgelehnt');
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? 'Aktion fehlgeschlagen');
    } finally {
      setBusy(null);
    }
  }


  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (phase !== 'all' && (r.phase ?? 'auto') !== phase) return false;
      if (view === 'delayed' && !r.is_delayed) return false;
      if (view === 'unconfirmed' && (r.eta_confirmed || !r.eta_planned)) return false;
      if (view === 'change_requested' && r.customer_response !== 'change_requested') return false;
      if (needle) {
        const hay = `${r.order_number ?? ''} ${r.customer_name ?? ''}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, q, phase, view]);

  const kpi = useMemo(() => ({
    total: rows.length,
    delayed: rows.filter((r) => r.is_delayed).length,
    unconfirmed: rows.filter((r) => r.eta_planned && !r.eta_confirmed).length,
    changeRequested: rows.filter((r) => r.customer_response === 'change_requested').length,
  }), [rows]);

  const tiles: { key: typeof view; label: string; value: number; icon: typeof Truck }[] = [
    { key: 'all', label: 'Aufträge im Portal-Tracking', value: kpi.total, icon: Truck },
    { key: 'delayed', label: 'Verzögert', value: kpi.delayed, icon: AlertTriangle },
    { key: 'unconfirmed', label: 'Termin unbestätigt', value: kpi.unconfirmed, icon: CalendarClock },
    { key: 'change_requested', label: 'Terminwunsch Kunde', value: kpi.changeRequested, icon: CalendarCheck },
  ];

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Lieferstatus-Cockpit</h1>
            <p className="text-sm text-muted-foreground">Alle Aufträge mit Kundenportal-Lieferstatus im Überblick.</p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1.5" />} Aktualisieren
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map((t) => (
            <button key={t.key} type="button" onClick={() => setView(t.key)} className="text-left">
              <Card className={view === t.key ? 'border-primary' : ''}>
                <CardContent className="p-4 flex items-center gap-3">
                  <t.icon className="w-5 h-5 text-muted-foreground" />
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
            <CardTitle className="text-base">Aufträge ({filtered.length})</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Input
                placeholder="Auftrag oder Kunde suchen…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-56"
              />
              <Select value={phase} onValueChange={setPhase}>
                <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Phasen</SelectItem>
                  {Object.entries(PHASE_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading && <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>}
            {!loading && filtered.length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">Keine Einträge gefunden.</p>
            )}
            {!loading && filtered.map((r, idx) => (
              <div
                key={r.order_id}
                className={`flex items-center gap-3 flex-wrap rounded-md border p-3 ${idx % 2 === 1 ? 'bg-muted/30' : ''}`}
              >
                <div className="min-w-[180px]">
                  <div className="font-medium text-sm">{r.order_number ?? '–'}</div>
                  <div className="text-xs text-muted-foreground">{r.customer_name ?? '–'}</div>
                </div>
                <Badge variant="outline">{PHASE_LABELS[r.phase ?? 'auto'] ?? r.phase}</Badge>
                <div className="text-xs text-muted-foreground">
                  Liefertermin: <span className="text-foreground">{fmt(r.eta_planned)}</span>
                  {r.eta_confirmed && <span className="text-primary ml-1">bestätigt</span>}
                </div>
                {r.is_delayed && <Badge variant="destructive">Verzögert</Badge>}
                {r.customer_response === 'confirmed' && <Badge className="bg-emerald-600 hover:bg-emerald-600">Kunde bestätigt</Badge>}
                {r.customer_response === 'change_requested' && (
                  <Badge variant="secondary">
                    Terminwunsch{r.customer_alternative_date ? `: ${fmt(r.customer_alternative_date)}` : ''}
                  </Badge>
                )}
                <div className="ml-auto flex items-center gap-2">
                  {r.customer_response === 'change_requested' && (
                    <>
                      {r.customer_alternative_date && (
                        <Button
                          size="sm"
                          disabled={busy === r.order_id}
                          onClick={() => resolveRequest(r, 'accept')}
                        >
                          {busy === r.order_id ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <CalendarCheck className="w-4 h-4 mr-1.5" />}
                          Wunschtermin übernehmen
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy === r.order_id}
                        onClick={() => resolveRequest(r, 'reject')}
                      >
                        Ablehnen
                      </Button>
                    </>
                  )}
                  <span className="text-xs text-muted-foreground hidden md:inline">
                    {r.last_status_change ? new Date(r.last_status_change).toLocaleString('de-DE') : ''}
                  </span>
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/auftraege/${r.order_id}?tab=lieferstatus`}>
                      <ExternalLink className="w-4 h-4 mr-1.5" /> Öffnen
                    </Link>
                  </Button>
                </div>

                {r.customer_response_note && (
                  <div className="w-full text-xs text-muted-foreground">Kundennachricht: {r.customer_response_note}</div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

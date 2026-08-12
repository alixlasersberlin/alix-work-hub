import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenantFilter } from '@/hooks/useTenantFilter';
import { toast } from 'sonner';
import { format, addDays, startOfWeek, endOfWeek, isSameDay, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  Navigation, Phone, FileText, CheckCircle2, ChevronLeft, ChevronRight, Truck, User, MapPin,
  Clock, Loader2, PackageCheck, AlertTriangle, Crown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DELIVERY_STATUS_LABELS, DELIVERY_TYPE_LABELS, statusClass } from './constants';

const DONE_STATUSES = ['erfolgreich_ausgeliefert', 'teilweise_ausgeliefert', 'abgeschlossen', 'storniert'];
const DAY_KEY = 'yyyy-MM-dd';

type Mode = 'today' | 'tomorrow' | 'week' | 'day';

function timeLabel(row: any) {
  const t = row.time_window_start ?? row.planned_arrival ?? null;
  if (!t) return '–';
  const s = String(t);
  if (s.includes('T')) return format(parseISO(s), 'HH:mm');
  return s.slice(0, 5);
}

function addressOf(row: any) {
  return [row.delivery_street, [row.delivery_zip, row.delivery_city].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');
}

export default function DispatchMeineTouren() {
  const { user, profile, hasAnyRole, isAdmin } = useAuth();
  const { tenantId } = useTenantFilter();
  const qc = useQueryClient();

  const canSeeAll = isAdmin || hasAnyRole(['Tourenplanung', 'Auftragsverwaltung', 'Order', 'SACHBEARBEITUNG']);
  const [scope, setScope] = useState<'mine' | 'all'>(canSeeAll ? 'all' : 'mine');
  const [mode, setMode] = useState<Mode>('today');
  const [day, setDay] = useState<Date>(new Date());
  const [busyId, setBusyId] = useState<string | null>(null);

  const today = new Date();

  const range = useMemo(() => {
    if (mode === 'today') return { from: today, to: today };
    if (mode === 'tomorrow') return { from: addDays(today, 1), to: addDays(today, 1) };
    if (mode === 'week') return { from: today, to: endOfWeek(today, { weekStartsOn: 1 }) };
    return { from: day, to: day };
  }, [mode, day]);

  const fromKey = format(range.from, DAY_KEY);
  const toKey = format(range.to, DAY_KEY);

  const { data: myDriver } = useQuery({
    queryKey: ['dispatch', 'my-driver', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from('drivers').select('id, full_name').eq('user_id', user!.id).maybeSingle();
      return data ?? null;
    },
    staleTime: 300_000,
  });

  const { data: appts, isPending } = useQuery({
    queryKey: ['dispatch', 'my-tours', fromKey, toKey, tenantId],
    queryFn: async () => {
      let q = supabase
        .from('delivery_appointments')
        .select('id, order_id, order_number, customer_name, company_name, contact_name, contact_phone, contact_mobile, delivery_street, delivery_zip, delivery_city, appointment_type, status, planned_date, planned_arrival, time_window_start, time_window_end, device_name, scope_of_delivery, customer_notes, internal_notes, payment_status, open_amount, is_vip, responsible_user_id')
        .gte('planned_date', fromKey)
        .lte('planned_date', toKey)
        .order('planned_date', { ascending: true })
        .order('time_window_start', { ascending: true, nullsFirst: false })
        .limit(300);
      if (tenantId) q = q.eq('tenant_id', tenantId as never);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 15_000,
    refetchInterval: 60_000,
  });

  const apptIds = useMemo(() => (appts ?? []).map((a: any) => a.id), [appts]);

  const { data: stops } = useQuery({
    queryKey: ['dispatch', 'my-tour-stops', apptIds.join(',')],
    enabled: apptIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_tour_stops')
        .select('id, appointment_id, position, stop_status, planned_arrival, notes, tour:tour_id(id, tour_number, title, status, tour_date, driver_id, codriver_id, drivers:driver_id(full_name), vehicles:vehicle_id(license_plate, name))')
        .in('appointment_id', apptIds);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 15_000,
  });

  const stopByAppt = useMemo(() => {
    const m: Record<string, any> = {};
    (stops ?? []).forEach((s: any) => { m[s.appointment_id] = s; });
    return m;
  }, [stops]);

  // Realtime: gleiche Datenbasis wie der Tourenkalender
  useEffect(() => {
    const ch = supabase
      .channel('meine-touren-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_appointments' }, () => {
        qc.invalidateQueries({ queryKey: ['dispatch'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_tour_stops' }, () => {
        qc.invalidateQueries({ queryKey: ['dispatch'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const rows = useMemo(() => {
    const now = new Date();
    let list = (appts ?? []).map((a: any) => ({ ...a, stop: stopByAppt[a.id] ?? null }));
    if (scope === 'mine') {
      list = list.filter((a: any) =>
        a.responsible_user_id === user?.id ||
        (myDriver?.id && (a.stop?.tour?.driver_id === myDriver.id || a.stop?.tour?.codriver_id === myDriver.id)),
      );
    }
    // Vergangene Termine ausblenden (nur für heute relevant)
    list = list.filter((a: any) => {
      if (!a.planned_date) return false;
      const d = parseISO(a.planned_date);
      if (!isSameDay(d, now)) return true;
      if (DONE_STATUSES.includes(a.status)) return false;
      return true;
    });
    return list.sort((a: any, b: any) =>
      `${a.planned_date}${timeLabel(a)}`.localeCompare(`${b.planned_date}${timeLabel(b)}`),
    );
  }, [appts, stopByAppt, scope, user?.id, myDriver?.id]);

  const todaysAll = useMemo(
    () => (appts ?? []).filter((a: any) => a.planned_date === format(today, DAY_KEY)),
    [appts],
  );
  const doneToday = todaysAll.filter((a: any) => DONE_STATUSES.includes(a.status)).length;
  const next = rows[0] ?? null;

  const grouped = useMemo(() => {
    const m: { key: string; label: string; items: any[] }[] = [];
    rows.forEach((r: any) => {
      const key = r.planned_date;
      let g = m.find(x => x.key === key);
      if (!g) {
        g = { key, label: format(parseISO(key), 'EEEE, dd.MM.yyyy', { locale: de }), items: [] };
        m.push(g);
      }
      g.items.push(r);
    });
    return m;
  }, [rows]);

  async function markDone(row: any) {
    setBusyId(row.id);
    const nextStatus = 'erfolgreich_ausgeliefert';
    const { error } = await supabase
      .from('delivery_appointments')
      .update({ status: nextStatus as never, updated_by: user?.id ?? null })
      .eq('id', row.id);
    if (!error) {
      await supabase.from('delivery_status_history').insert({
        appointment_id: row.id,
        from_status: row.status,
        to_status: nextStatus,
        changed_by: user?.id ?? null,
        changed_by_name: profile?.full_name ?? null,
        source: 'mobile_meine_touren',
      });
      if (row.stop?.id) {
        await supabase.from('delivery_tour_stops').update({ stop_status: nextStatus as never }).eq('id', row.stop.id);
      }
    }
    setBusyId(null);
    if (error) { toast.error(error.message); return; }
    toast.success('Termin als erledigt gesetzt');
    qc.invalidateQueries({ queryKey: ['dispatch'] });
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-3 pb-24 pt-3 sm:px-4">
      {/* Sticky Kopf */}
      <div className="sticky top-0 z-20 -mx-3 space-y-2 border-b border-border bg-background/95 px-3 pb-3 pt-2 backdrop-blur sm:-mx-4 sm:px-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold leading-tight">Meine Touren</h1>
            <p className="text-xs text-muted-foreground">{format(today, 'EEEE, dd.MM.yyyy', { locale: de })}</p>
          </div>
          {canSeeAll && (
            <div className="flex overflow-hidden rounded-lg border border-border">
              <button
                onClick={() => setScope('mine')}
                className={`px-3 py-2 text-xs font-semibold ${scope === 'mine' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
              >Meine</button>
              <button
                onClick={() => setScope('all')}
                className={`px-3 py-2 text-xs font-semibold ${scope === 'all' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
              >Alle</button>
            </div>
          )}
        </div>

        {/* Tagesnavigation */}
        <div className="flex items-center gap-2">
          <div className="flex flex-1 overflow-hidden rounded-lg border border-border">
            {([['today', 'Heute'], ['tomorrow', 'Morgen'], ['week', 'Diese Woche']] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setMode(k as Mode)}
                className={`flex-1 px-2 py-2 text-xs font-semibold ${mode === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
              >{label}</button>
            ))}
          </div>
          <Button
            variant="outline" size="icon" className="h-10 w-10 shrink-0" aria-label="Vorheriger Tag"
            onClick={() => { const base = mode === 'day' ? day : range.from; setDay(addDays(base, -1)); setMode('day'); }}
          ><ChevronLeft className="h-5 w-5" /></Button>
          <Button
            variant="outline" size="icon" className="h-10 w-10 shrink-0" aria-label="Nächster Tag"
            onClick={() => { const base = mode === 'day' ? day : range.from; setDay(addDays(base, 1)); setMode('day'); }}
          ><ChevronRight className="h-5 w-5" /></Button>
        </div>
        {mode === 'day' && (
          <p className="text-xs font-medium text-muted-foreground">
            Tag: {format(day, 'EEEE, dd.MM.yyyy', { locale: de })}
          </p>
        )}

        {/* Schnellübersicht */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border border-border bg-card px-2 py-2">
            <div className="text-base font-bold">{todaysAll.length}</div>
            <div className="text-[11px] text-muted-foreground">Termine heute</div>
          </div>
          <div className="rounded-lg border border-border bg-card px-2 py-2">
            <div className="text-base font-bold text-emerald-400">{doneToday}</div>
            <div className="text-[11px] text-muted-foreground">erledigt</div>
          </div>
          <div className="rounded-lg border border-border bg-card px-2 py-2">
            <div className="text-base font-bold text-amber-400">{Math.max(todaysAll.length - doneToday, 0)}</div>
            <div className="text-[11px] text-muted-foreground">offen</div>
          </div>
        </div>
      </div>

      {isPending && (
        <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Termine werden geladen …
        </div>
      )}

      {!isPending && rows.length === 0 && (
        <Card className="mt-4 p-6 text-center text-sm text-muted-foreground">
          Keine anstehenden Termine in diesem Zeitraum.
        </Card>
      )}

      {/* Nächster Termin */}
      {next && (
        <div className="mt-3">
          <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-primary">
            <Clock className="h-3.5 w-3.5" /> Nächster Termin
          </div>
          <StopCard row={next} highlight onDone={markDone} busy={busyId === next.id} />
        </div>
      )}

      {/* Weitere Termine */}
      <div className="mt-5 space-y-5">
        {grouped.map(group => {
          const items = group.items.filter((i: any) => i.id !== next?.id);
          if (items.length === 0) return null;
          return (
            <div key={group.key}>
              <div className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{group.label}</div>
              <div className="space-y-3">
                {items.map((row: any) => (
                  <StopCard key={row.id} row={row} onDone={markDone} busy={busyId === row.id} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StopCard({ row, highlight, onDone, busy }: { row: any; highlight?: boolean; onDone: (r: any) => void; busy: boolean }) {
  const address = addressOf(row);
  const phone = row.contact_mobile || row.contact_phone || null;
  const tour = row.stop?.tour ?? null;
  const isDone = DONE_STATUSES.includes(row.status);

  return (
    <Card className={`overflow-hidden p-4 ${highlight ? 'border-primary/60 bg-primary/5 shadow-lg' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-2xl font-extrabold leading-none">{timeLabel(row)}<span className="ml-1 text-sm font-medium text-muted-foreground">Uhr</span></div>
          <div className="mt-2 flex items-center gap-1 text-base font-bold leading-snug">
            {row.is_vip && <Crown className="h-4 w-4 shrink-0 text-amber-400" />}
            <span className="break-words">{row.company_name || row.customer_name || 'Kunde'}</span>
          </div>
          {address && (
            <div className="mt-1 flex items-start gap-1 break-words text-sm text-muted-foreground">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" /> <span>{address}</span>
            </div>
          )}
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-semibold ${statusClass(row.status)}`}>
          {DELIVERY_STATUS_LABELS[row.status] ?? row.status}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-1 text-sm">
        {row.order_number && <Info label="Auftrag" value={`#${row.order_number}`} />}
        <Info label="Art" value={DELIVERY_TYPE_LABELS[row.appointment_type] ?? row.appointment_type} />
        {tour?.tour_number && <Info label="Tour" value={`${tour.tour_number}${tour.status ? ` · ${tour.status}` : ''}`} icon={<Truck className="h-3.5 w-3.5" />} />}
        {tour?.drivers?.full_name && <Info label="Fahrer" value={tour.drivers.full_name} icon={<User className="h-3.5 w-3.5" />} />}
        {tour?.vehicles && <Info label="Fahrzeug" value={[tour.vehicles.name, tour.vehicles.license_plate].filter(Boolean).join(' · ')} />}
        {row.contact_name && <Info label="Ansprechpartner" value={row.contact_name} />}
        {phone && <Info label="Telefon" value={phone} />}
        {row.device_name && <Info label="Gerät" value={row.device_name} icon={<PackageCheck className="h-3.5 w-3.5" />} />}
        {row.scope_of_delivery && <Info label="Lieferumfang" value={row.scope_of_delivery} />}
        {row.customer_notes && <Info label="Hinweis" value={row.customer_notes} icon={<AlertTriangle className="h-3.5 w-3.5" />} />}
        {row.payment_status && <Info label="Zahlung" value={row.payment_status + (row.open_amount ? ` · offen ${Number(row.open_amount).toFixed(2)} €` : '')} />}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button asChild variant="outline" className="h-12 text-sm font-semibold" disabled={!address}>
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer">
            <Navigation className="mr-1 h-4 w-4" /> Navigation
          </a>
        </Button>
        <Button asChild variant="outline" className="h-12 text-sm font-semibold" disabled={!phone}>
          <a href={phone ? `tel:${String(phone).replace(/\s/g, '')}` : '#'}>
            <Phone className="mr-1 h-4 w-4" /> Anrufen
          </a>
        </Button>
        <Button asChild variant="outline" className="h-12 text-sm font-semibold">
          <Link to={row.order_id ? `/auftraege/${row.order_id}` : '/dispatch/termine'}>
            <FileText className="mr-1 h-4 w-4" /> Details
          </Link>
        </Button>
        <Button className="h-12 text-sm font-semibold" onClick={() => onDone(row)} disabled={busy || isDone}>
          {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1 h-4 w-4" />}
          {isDone ? 'Erledigt' : 'Erledigt'}
        </Button>
      </div>
    </Card>
  );
}

function Info({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 break-words">
      <span className="flex w-28 shrink-0 items-center gap-1 text-xs text-muted-foreground">{icon}{label}</span>
      <span className="min-w-0 break-words font-medium">{value}</span>
    </div>
  );
}

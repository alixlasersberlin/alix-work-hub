import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format, differenceInCalendarDays, parseISO, isValid } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  Check, Circle, AlertTriangle, ChevronDown, Truck, ShieldCheck,
  Clock, Package, CalendarDays, Cpu,
} from 'lucide-react';
import type { DeliveryJourneyPayload, DjStep, DjStepStatus } from '@/lib/portal/delivery-types';
import { DeviceAssembly } from './DeviceAssembly';
import '@/styles/delivery-journey.css';

function d(v?: string | null) {
  if (!v) return null;
  const dt = typeof v === 'string' ? parseISO(v) : new Date(v);
  return isValid(dt) ? dt : null;
}
function fmt(v?: string | null, pattern = 'dd. MMMM yyyy') {
  const dt = d(v);
  return dt ? format(dt, pattern, { locale: de }) : null;
}
function fmtTime(v?: string | null) {
  if (!v) return null;
  return String(v).slice(0, 5);
}

function StatusDot({ status }: { status: DjStepStatus }) {
  if (status === 'done') {
    return (
      <span className="w-7 h-7 rounded-full bg-primary/15 border border-primary/40 flex items-center justify-center shrink-0">
        <Check className="w-4 h-4 text-primary" />
      </span>
    );
  }
  if (status === 'active') {
    return (
      <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 dj-pulse">
        <span className="w-2 h-2 rounded-full bg-primary-foreground" />
      </span>
    );
  }
  if (status === 'issue') {
    return (
      <span className="w-7 h-7 rounded-full bg-destructive/10 border border-destructive/40 flex items-center justify-center shrink-0">
        <AlertTriangle className="w-4 h-4 text-destructive" />
      </span>
    );
  }
  return (
    <span className="w-7 h-7 rounded-full border border-border flex items-center justify-center shrink-0">
      <Circle className="w-2.5 h-2.5 text-muted-foreground" />
    </span>
  );
}

function SubStepList({ steps }: { steps: DjStep[] }) {
  return (
    <ul className="space-y-2">
      {steps.map((s, idx) => (
        <li key={s.key} className="flex items-center gap-3 dj-rise" style={{ animationDelay: `${idx * 70}ms` }}>
          <StatusDot status={s.status} />
          <span className={cn('text-sm', s.status === 'pending' && 'text-muted-foreground')}>{s.label}</span>
          {s.status === 'done' && <span className="text-xs text-primary ml-auto">abgeschlossen</span>}
          {s.status === 'active' && <span className="text-xs text-muted-foreground ml-auto">in Prüfung</span>}
        </li>
      ))}
    </ul>
  );
}

function Timeline({ steps }: { steps: DjStep[] }) {
  return (
    <>
      {/* Desktop: horizontal */}
      <div className="hidden md:flex items-start gap-1">
        {steps.map((s, i) => (
          <div key={s.key} className="flex-1 flex flex-col items-center text-center dj-rise" style={{ animationDelay: `${i * 80}ms` }}>
            <div className="flex items-center w-full">
              <div className={cn('h-px flex-1', i === 0 ? 'opacity-0' : s.status === 'pending' ? 'bg-border' : 'bg-primary/50')} />
              <StatusDot status={s.status} />
              <div className={cn('h-px flex-1', i === steps.length - 1 ? 'opacity-0' : steps[i + 1].status === 'pending' ? 'bg-border' : 'bg-primary/50')} />
            </div>
            <span className={cn('text-[11px] mt-2 leading-tight', s.status === 'pending' ? 'text-muted-foreground' : 'text-foreground font-medium')}>
              {s.label}
            </span>
          </div>
        ))}
      </div>
      {/* Mobile: vertikal */}
      <div className="md:hidden space-y-3 border-l border-border pl-4">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-3 relative dj-rise" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="absolute -left-[1.65rem]"><StatusDot status={s.status} /></div>
            <span className={cn('text-sm ml-2', s.status === 'pending' ? 'text-muted-foreground' : 'font-medium')}>{s.label}</span>
          </div>
        ))}
      </div>
    </>
  );
}

export function DeliveryJourney({
  data,
  orderNumber,
  orderDate,
}: {
  data: DeliveryJourneyPayload;
  orderNumber: string;
  orderDate?: string | null;
}) {
  const [showProduction, setShowProduction] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // "NEU"-Markierung: Einträge, die seit dem letzten Portalbesuch dazugekommen sind
  const seenKey = `dj-seen-${orderNumber}`;
  const [lastSeen] = useState<number>(() => {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(seenKey) : null;
    return raw ? Number(raw) || 0 : 0;
  });
  const newCount = useMemo(
    () => data.history.filter((h) => {
      const dt = d(h.date);
      return dt ? dt.getTime() > lastSeen : false;
    }).length,
    [data.history, lastSeen],
  );
  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem(seenKey, String(Date.now()));
  }, [seenKey]);



  const primaryDevice = data.devices?.[0]?.name ?? 'Ihr ALIX System';
  const plannedDate = d(data.eta.planned);
  const daysLeft = plannedDate ? differenceInCalendarDays(plannedDate, new Date()) : null;
  const isDelivered = data.phase === 'delivered';

  const etaText = useMemo(() => {
    const e = fmt(data.eta.earliest, 'dd.');
    const l = fmt(data.eta.latest);
    if (e && l) return `${e}–${l}`;
    return fmt(data.eta.planned) ?? null;
  }, [data.eta]);

  const confidenceLabel =
    data.confidence === 'confirmed'
      ? { title: 'Termin bestätigt', text: 'Ihr Liefertermin ist bestätigt.' }
      : data.confidence === 'forecast'
        ? { title: 'Termin kann sich noch ändern', text: 'Der Liefertermin ist derzeit eine Prognose.' }
        : { title: 'Termin wird vorbereitet', text: 'Wir planen derzeit Ihre Auslieferung.' };

  const countdown =
    isDelivered || daysLeft === null
      ? null
      : daysLeft > 1
        ? `Noch ${daysLeft} Tage bis zur geplanten Lieferung.`
        : daysLeft === 1
          ? 'Morgen ist es soweit.'
          : daysLeft === 0
            ? 'Heute kommt Ihr ALIX System.'
            : null;

  return (
    <div className="space-y-5">
      {/* HERO */}
      <Card className="border-primary/30 overflow-hidden">
        <CardContent className="p-6 md:p-8 space-y-4">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Meine Lieferung</div>
          <h1 className="text-2xl md:text-4xl font-semibold tracking-tight">{primaryDevice}</h1>
          <div className="text-sm text-muted-foreground">
            Auftrag {orderNumber}
            {fmt(orderDate) && <> · Bestellt am {fmt(orderDate)}</>}
          </div>

          {isDelivered ? (
            <div className="pt-2 dj-rise">
              <div className="flex items-center gap-2 text-primary">
                <Check className="w-6 h-6" />
                <span className="text-xl font-semibold">Erfolgreich geliefert</span>
              </div>
              <p className="text-muted-foreground mt-1">Willkommen bei ALIX.</p>
              {fmt(data.eta.delivered_at) && (
                <p className="text-sm mt-2">Lieferdatum: {fmt(data.eta.delivered_at)}</p>
              )}
            </div>
          ) : etaText ? (
            <div className="pt-2">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Voraussichtliche Lieferung</div>
              <div className="text-3xl md:text-5xl font-semibold tracking-tight mt-1 dj-rise">{etaText}</div>
              {data.eta.planned && data.eta.earliest && data.eta.latest && (
                <p className="text-sm text-muted-foreground mt-2">
                  Aktuell rechnen wir mit einer Lieferung am {fmt(data.eta.planned)}.
                </p>
              )}
            </div>
          ) : (
            <div className="pt-2">
              <div className="text-xl font-semibold">Liefertermin wird geplant</div>
              <p className="text-sm text-muted-foreground mt-1">
                Sobald die Produktions- und Tourenplanung abgeschlossen ist, sehen Sie hier Ihren voraussichtlichen Liefertermin.
              </p>
            </div>
          )}

          <p className="text-base text-foreground/85">{data.phase_text}</p>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Badge variant="outline" className="gap-1"><ShieldCheck className="w-3 h-3" /> {confidenceLabel.title}</Badge>
            {countdown && <Badge variant="outline" className="gap-1"><Clock className="w-3 h-3" /> {countdown}</Badge>}
            {data.partial_delivery && <Badge variant="outline">Teillieferung vorgesehen</Badge>}
          </div>
        </CardContent>
      </Card>

      {/* VERZÖGERUNG */}
      {data.delay.active && (
        <Card className="border-destructive/40">
          <CardContent className="p-6 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold">Aktualisierung zu Ihrer Lieferung</div>
              <p className="text-sm text-muted-foreground mt-1">
                Der ursprünglich geplante Liefertermin kann leider nicht eingehalten werden.
              </p>
              <p className="text-sm mt-2">{data.delay.reason}</p>
              {etaText && <p className="text-sm mt-2">Neuer Termin: <span className="font-medium">{etaText}</span></p>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* TIMELINE */}
      <Card>
        <CardContent className="p-6 space-y-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Ihre Lieferung im Überblick</div>
          <Timeline steps={data.steps} />
          <div className="rounded-lg bg-muted/40 p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Als Nächstes</div>
            <p className="text-sm mt-1">{data.next_text}</p>
          </div>
        </CardContent>
      </Card>

      {/* PRODUKTION / GERÄTEANIMATION */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">Fertigung & Prüfung</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowProduction((v) => !v)}>
              Details anzeigen
              <ChevronDown className={cn('w-4 h-4 ml-1 transition-transform', showProduction && 'rotate-180')} />
            </Button>
          </div>

          <DeviceAssembly steps={data.production.steps} scanning={data.phase === 'qc'} />

          {data.production.progress !== null && (
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Produktionsfortschritt</span>
                <span>{data.production.progress} %</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary dj-progress-bar" style={{ width: `${data.production.progress}%` }} />
              </div>
            </div>
          )}

          {showProduction && (
            <div className="grid gap-6 md:grid-cols-2 pt-2">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Produktion</div>
                <SubStepList steps={data.production.steps} />
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Qualitätsprüfung</div>
                <p className="text-xs text-muted-foreground mb-3">
                  Jedes ALIX System wird vor der Auslieferung vollständig geprüft.
                </p>
                <SubStepList steps={data.qc.steps} />
                {data.qc.passed && (
                  <div className="flex items-center gap-2 text-primary text-sm mt-3 dj-rise">
                    <Check className="w-4 h-4" /> Prüfung bestanden
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* FREIGABEN */}
      <Card>
        <CardContent className="p-6 space-y-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Interne Lieferfreigabe</div>
          {[data.releases.warehouse, data.releases.accounting, data.releases.dispatch].map((r) => (
            <div key={r.label} className="flex items-center gap-3">
              <StatusDot status={r.approved ? 'done' : 'pending'} />
              <span className="text-sm font-medium">{r.label}</span>
              <span className={cn('text-sm ml-auto', r.approved ? 'text-primary' : 'text-muted-foreground')}>{r.text}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* TOUR */}
      {data.tour_steps.length > 0 && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">Ihre Lieferung wurde eingeplant</span>
            </div>
            <div className="flex flex-wrap gap-6">
              {fmt(data.eta.planned) && (
                <div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1"><CalendarDays className="w-3 h-3" /> Termin</div>
                  <div className="font-medium">{fmt(data.eta.planned)}</div>
                </div>
              )}
              {(data.eta.window_start || data.eta.window_end) && (
                <div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> Zeitfenster</div>
                  <div className="font-medium">
                    {fmtTime(data.eta.window_start) ?? '—'} – {fmtTime(data.eta.window_end) ?? '—'} Uhr
                  </div>
                </div>
              )}
            </div>
            <div className="relative h-7">
              <div className="absolute top-1/2 left-0 right-0 h-px bg-border" />
              <Truck className="dj-truck absolute top-0 w-6 h-6 text-primary" />
            </div>
            <SubStepList steps={data.tour_steps} />
          </CardContent>
        </Card>
      )}

      {/* MEHRERE GERÄTE */}
      {data.devices.length > 1 && (
        <Card>
          <CardContent className="p-6 space-y-3">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Ihre Geräte</div>
            {data.devices.map((dev, i) => (
              <div key={`${dev.name}-${i}`} className="flex items-center gap-3">
                <Package className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">{dev.name}{dev.quantity > 1 ? ` × ${dev.quantity}` : ''}</span>
                {dev.serial_number && <span className="text-xs text-muted-foreground ml-auto">SN {dev.serial_number}</span>}
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              {data.partial_delivery ? 'Teillieferung vorgesehen.' : 'Alle Geräte werden gemeinsam geliefert.'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* HISTORIE */}
      {data.history.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <Button variant="ghost" size="sm" className="px-0" onClick={() => setShowHistory((v) => !v)}>
              Lieferhistorie
              {newCount > 0 && (
                <Badge className="ml-2 h-5 px-1.5 text-[10px]">{newCount} NEU</Badge>
              )}
              <ChevronDown className={cn('w-4 h-4 ml-1 transition-transform', showHistory && 'rotate-180')} />
            </Button>
            {showHistory && (
              <div className="mt-4 space-y-3 border-l border-border pl-4">
                {data.history.map((h, i) => {
                  const isNew = !!lastSeen && d(h.date) ? d(h.date)!.getTime() > lastSeen : !lastSeen;
                  return (
                    <div key={`${h.date}-${i}`} className="relative dj-rise" style={{ animationDelay: `${i * 50}ms` }}>
                      <div className="absolute -left-[1.4rem] w-2.5 h-2.5 rounded-full bg-primary mt-1.5" />
                      <div className="text-sm font-medium flex items-center gap-2">
                        {h.title}
                        {isNew && <Badge variant="outline" className="h-4 px-1 text-[9px] border-primary/50 text-primary">NEU</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">{fmt(h.date, 'dd.MM.yyyy')}</div>
                      {h.description && <p className="text-sm text-muted-foreground mt-0.5">{h.description}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}


      {fmt(data.last_update, 'dd.MM.yyyy HH:mm') && (
        <p className="text-xs text-muted-foreground text-center">
          Letzte Aktualisierung: {fmt(data.last_update, 'dd.MM.yyyy HH:mm')} Uhr
        </p>
      )}
    </div>
  );
}

import { useMemo, useState } from 'react';
import { format, differenceInCalendarDays, parseISO, isValid } from 'date-fns';
import { de } from 'date-fns/locale';
import { Check, ArrowRight, Truck, PackageCheck, Info, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { DeviceSilhouette } from './DeviceSilhouette';
import type { DeliveryJourneyPayload } from '@/lib/portal/delivery-types';
import '@/styles/delivery-check.css';

const STAGES = ['BESTELLUNG', 'VORBEREITUNG', 'BEREITSTELLUNG', 'LIEFERUNG', 'ANGEKOMMEN'] as const;

const PHASE_TO_STAGE: Record<string, number> = {
  order_received: 0,
  order_check: 0,
  production_planned: 1,
  in_production: 1,
  qc: 1,
  provisioning: 2,
  tour_planning: 2,
  out_for_delivery: 3,
  delivered: 4,
};

function toDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = parseISO(value);
  return isValid(d) ? d : null;
}

export interface CheckResult {
  order_number: string;
  customer_name: string | null;
  status_label: string;
  status_text: string;
  expected_delivery: string | null;
  delivery?: DeliveryJourneyPayload | null;
}

export function DeliveryResult({ data }: { data: CheckResult }) {
  const d = data.delivery ?? null;
  const devices = d?.devices?.length ? d.devices : [];
  const [deviceIdx, setDeviceIdx] = useState(0);
  const device = devices[deviceIdx] ?? null;

  const stageIdx = d ? (PHASE_TO_STAGE[d.phase] ?? 0) : 0;

  const planned = toDate(d?.eta?.planned ?? data.expected_delivery);
  const earliest = toDate(d?.eta?.earliest ?? null);
  const latest = toDate(d?.eta?.latest ?? null);
  const deliveredAt = toDate(d?.eta?.delivered_at ?? null);
  const confirmed = Boolean(d?.eta?.confirmed);
  const delayed = Boolean(d?.delay?.active);

  const dateHeadline = useMemo(() => {
    if (planned) return format(planned, 'd. MMMM', { locale: de }).toUpperCase();
    if (earliest && latest) {
      const sameMonth = format(earliest, 'M') === format(latest, 'M');
      return sameMonth
        ? `${format(earliest, 'd.', { locale: de })}–${format(latest, 'd. MMMM', { locale: de }).toUpperCase()}`
        : `${format(earliest, 'd. MMM', { locale: de })} – ${format(latest, 'd. MMM', { locale: de })}`.toUpperCase();
    }
    return null;
  }, [planned, earliest, latest]);

  const yearLine = planned ? format(planned, 'yyyy') : latest ? format(latest, 'yyyy') : null;

  const countdown = useMemo(() => {
    const ref = planned ?? earliest;
    if (deliveredAt || stageIdx === 4) return { big: 'ANGEKOMMEN ✓', small: 'Ihr ALIX System wurde geliefert.' };
    if (!ref) return null;
    const days = differenceInCalendarDays(ref, new Date());
    if (days < 0) return null;
    if (days === 0) return { big: 'HEUTE', small: 'kommt Ihr ALIX System.' };
    if (days === 1) return { big: 'MORGEN', small: 'ist es soweit.' };
    if (days <= 7) return { big: `Nur noch ${days} Tage`, small: 'bis Ihr ALIX System bei Ihnen ist.' };
    return { big: `Noch ${days} Tage`, small: 'bis Ihr ALIX System bei Ihnen ist.' };
  }, [planned, earliest, deliveredAt, stageIdx]);

  const windowText = d?.eta?.window_start && d?.eta?.window_end
    ? `${d.eta.window_start.slice(0, 5)} – ${d.eta.window_end.slice(0, 5)} Uhr`
    : null;

  const isDelivered = stageIdx === 4;
  const isEnRoute = stageIdx === 3;

  if (isDelivered) {
    return (
      <div className="space-y-5">
        <div className="text-center py-6 dc-reveal">
          <div className="mx-auto w-20 h-20 rounded-full bg-primary/12 text-primary flex items-center justify-center dc-check-pop">
            <Check className="w-10 h-10" strokeWidth={2.5} />
          </div>
          <div className="mt-5 text-3xl sm:text-4xl font-semibold tracking-tight">GELIEFERT</div>
          <p className="mt-2 text-muted-foreground">Viel Freude mit Ihrem neuen ALIX System.</p>
        </div>
        <Card className="dc-reveal dc-d2">
          <CardContent className="p-6 space-y-3 text-sm">
            {deliveredAt && (
              <Row label="Lieferdatum" value={format(deliveredAt, 'd. MMMM yyyy', { locale: de })} />
            )}
            {device && <Row label="Gerät" value={device.name} />}
            {device?.serial_number && <Row label="Seriennummer" value={device.serial_number} />}
            <Row label="Auftrag" value={data.order_number} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Gerät */}
      <div className="text-center dc-reveal">
        <div className="mx-auto w-44 h-40 sm:w-56 sm:h-48 dc-float">
          <DeviceSilhouette />
        </div>
        <div className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight">
          {device?.name ?? 'Ihr ALIX System'}
        </div>
        <div className="text-sm text-muted-foreground mt-1">Ihr ALIX System</div>
      </div>

      {/* Mehrere Geräte */}
      {devices.length > 1 && (
        <div className="dc-reveal dc-d1">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Ihre ALIX Systeme</div>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {devices.map((dev, i) => (
              <button
                key={`${dev.name}-${i}`}
                onClick={() => setDeviceIdx(i)}
                className={`shrink-0 rounded-xl border px-4 py-3 text-left min-w-[9rem] transition-all ${
                  i === deviceIdx ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-primary/40'
                }`}
              >
                <div className="text-sm font-medium truncate">{dev.name}</div>
                <div className="text-xs text-muted-foreground">
                  {dev.quantity > 1 ? `${dev.quantity} Stück` : 'Lieferung 1'}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Liefertermin */}
      <Card className="border-primary/25 dc-reveal dc-d2">
        <CardContent className="p-6 sm:p-8 text-center">
          {dateHeadline ? (
            <>
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                {confirmed ? 'Ihre Lieferung' : 'Voraussichtliche Lieferung'}
              </div>
              <div className="mt-3 text-4xl sm:text-6xl font-semibold tracking-tight leading-none">
                {dateHeadline}
              </div>
              {yearLine && <div className="mt-2 text-lg text-muted-foreground">{yearLine}</div>}
              {windowText && (
                <div className="mt-3 inline-flex items-center gap-2 text-sm font-medium">
                  <Clock className="w-4 h-4 text-primary" /> {windowText}
                </div>
              )}
              <div className="mt-4 text-sm">
                {confirmed ? (
                  <span className="inline-flex items-center gap-1.5 text-primary font-medium">
                    <Check className="w-4 h-4" /> Liefertermin bestätigt
                  </span>
                ) : (
                  <span className="text-muted-foreground">Voraussichtlicher Liefertermin</span>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="text-2xl sm:text-3xl font-semibold tracking-tight">
                Wir planen gerade Ihre Lieferung.
              </div>
              <p className="mt-3 text-sm text-muted-foreground max-w-sm mx-auto">
                Der Liefertermin wird Ihnen hier angezeigt, sobald die Planung abgeschlossen ist.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Countdown */}
      {countdown && (
        <div className="text-center dc-reveal dc-d3">
          <div className="text-xl sm:text-2xl font-semibold tracking-tight">{countdown.big}</div>
          <div className="text-sm text-muted-foreground">{countdown.small}</div>
        </div>
      )}

      {/* Timeline */}
      <Card className="dc-reveal dc-d3">
        <CardContent className="p-6">
          {/* Desktop / horizontal */}
          <div className="hidden sm:block relative">
            <div className="absolute left-[10%] right-[10%] top-3 h-px bg-border" />
            <div
              className="absolute left-[10%] top-3 h-px bg-primary dc-progress-line"
              style={{ width: `${(stageIdx / (STAGES.length - 1)) * 80}%` }}
            />
            <div className="relative flex justify-between">
              {STAGES.map((label, i) => {
                const done = i < stageIdx;
                const active = i === stageIdx;
                return (
                  <div key={label} className="flex-1 flex flex-col items-center text-center">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] border ${
                        done
                          ? 'bg-primary text-primary-foreground border-primary'
                          : active
                            ? 'bg-primary/15 text-primary border-primary dc-pulse'
                            : 'bg-background text-muted-foreground/60 border-border'
                      }`}
                    >
                      {done ? <Check className="w-3.5 h-3.5" /> : active ? '●' : '○'}
                    </span>
                    <span className={`mt-2 text-[10px] tracking-wider ${done || active ? 'text-foreground font-medium' : 'text-muted-foreground/60'}`}>
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mobile / vertikal */}
          <div className="sm:hidden relative pl-1">
            <div className="absolute left-[11px] top-3 bottom-3 w-px bg-border" />
            <div
              className="absolute left-[11px] top-3 w-px bg-primary dc-progress-line-v"
              style={{ height: `${(stageIdx / (STAGES.length - 1)) * 100}%` }}
            />
            <div className="relative space-y-4">
              {STAGES.map((label, i) => {
                const done = i < stageIdx;
                const active = i === stageIdx;
                return (
                  <div key={label} className="flex items-center gap-3">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] border shrink-0 ${
                        done
                          ? 'bg-primary text-primary-foreground border-primary'
                          : active
                            ? 'bg-primary/15 text-primary border-primary dc-pulse'
                            : 'bg-background text-muted-foreground/60 border-border'
                      }`}
                    >
                      {done ? <Check className="w-3.5 h-3.5" /> : active ? '●' : '○'}
                    </span>
                    <span className={`text-xs tracking-wider ${done || active ? 'text-foreground font-medium' : 'text-muted-foreground/60'}`}>
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Unterwegs */}
      {isEnRoute && (
        <Card className="dc-reveal dc-d4">
          <CardContent className="p-6">
            <div className="relative h-14">
              <div className="absolute left-0 right-0 top-1/2 h-px bg-border" />
              <div className="absolute left-0 top-1/2 -translate-y-1/2 text-xs font-medium">ALIX</div>
              <div className="absolute right-0 top-1/2 -translate-y-1/2 text-xs font-medium">SIE</div>
              <div className="absolute top-1/2 -translate-y-1/2 dc-truck" style={{ left: '4%' }}>
                <span className="w-9 h-9 rounded-full bg-primary/12 text-primary flex items-center justify-center">
                  <Truck className="w-4.5 h-4.5" />
                </span>
              </div>
            </div>
            <p className="text-center text-sm font-medium mt-1">Ihre Lieferung ist unterwegs.</p>
          </CardContent>
        </Card>
      )}

      {/* Verzögerung */}
      {delayed && (
        <Card className="border-amber-300/60 dc-reveal dc-d4">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <div className="font-medium">Update zu Ihrer Lieferung</div>
                <p className="text-sm text-muted-foreground mt-1">Der Lieferzeitraum wurde aktualisiert.</p>
                {earliest && latest && (
                  <div className="mt-2 text-lg font-semibold tracking-tight">
                    {format(earliest, 'd.', { locale: de })}–{format(latest, 'd. MMMM', { locale: de }).toUpperCase()}
                  </div>
                )}
                {d?.delay?.reason && <p className="text-sm mt-2">{d.delay.reason}</p>}
                <p className="text-sm text-muted-foreground mt-2">Vielen Dank für Ihre Geduld.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Aktueller Status */}
      <Card className="dc-reveal dc-d4">
        <CardContent className="p-6">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Ihr aktueller Status</div>
          <p className="mt-2 text-base font-medium">{d?.phase_text || data.status_text || data.status_label}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Sobald Ihre Lieferung fest eingeplant wurde, aktualisieren wir den Liefertermin automatisch.
          </p>
        </CardContent>
      </Card>

      {/* Was passiert als Nächstes */}
      {(d?.next_text || !d) && (
        <Card className="dc-reveal dc-d5">
          <CardContent className="p-6 flex items-start gap-3">
            <span className="w-9 h-9 rounded-full bg-primary/12 text-primary flex items-center justify-center shrink-0">
              <ArrowRight className="w-4.5 h-4.5" />
            </span>
            <div>
              <div className="font-medium">Was passiert als Nächstes?</div>
              <p className="text-sm text-muted-foreground mt-1">
                {d?.next_text || 'Ihr ALIX System wird als Nächstes für die Auslieferung eingeplant.'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <PackageCheck className="w-3.5 h-3.5" /> Auftrag {data.order_number}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

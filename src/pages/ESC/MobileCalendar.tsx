import { useMemo, useState } from 'react';
import { addDays, format, isSameDay, startOfDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CalendarDays, MapPin, User } from 'lucide-react';
import { useAppointments } from '@/hooks/esc/useAppointments';
import { useDepartments } from '@/hooks/esc/useDepartments';
import { EscStatusBadge } from '@/components/esc/StatusBadge';
import { DepartmentBadge } from '@/components/esc/DepartmentBadge';
import { ConfirmBanner } from '@/components/esc/ConfirmBanner';
import { isVipTraining } from '@/lib/esc/vip-kind';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Mobile-optimierter Teamkalender – nur Kalender, ohne App-Chrome.
 * Route: /m/kalender
 */
export default function MobileCalendar() {
  const { appointments } = useAppointments();
  const { departments } = useDepartments();
  const [day, setDay] = useState<Date>(() => startOfDay(new Date()));

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(startOfDay(new Date()), i)),
    [],
  );

  const dayAppointments = useMemo(
    () =>
      appointments
        .filter((a) => isSameDay(new Date(a.startAt), day))
        .sort((a, b) => a.startAt.localeCompare(b.startAt)),
    [appointments, day],
  );

  const deptOf = (id: string) => departments.find((d) => d.id === id);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Kopf */}
      <header className="sticky top-0 z-10 bg-card border-b px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="icon" onClick={() => setDay((d) => addDays(d, -1))} aria-label="Vorheriger Tag">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="text-center">
            <div className="text-sm font-semibold">{format(day, 'EEEE, dd. MMMM', { locale: de })}</div>
            <div className="text-[11px] text-muted-foreground">{dayAppointments.length} Termine</div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setDay((d) => addDays(d, 1))} aria-label="Nächster Tag">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* 7-Tage-Streifen */}
        <div className="mt-2 grid grid-cols-7 gap-1">
          {weekDays.map((d) => {
            const active = isSameDay(d, day);
            const count = appointments.filter((a) => isSameDay(new Date(a.startAt), d)).length;
            return (
              <button
                key={d.toISOString()}
                onClick={() => setDay(d)}
                className={cn(
                  'rounded-md py-1.5 text-center border',
                  active ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/40 border-transparent',
                )}
              >
                <div className="text-[10px] uppercase opacity-80">{format(d, 'EE', { locale: de })}</div>
                <div className="text-sm font-semibold leading-tight">{format(d, 'dd')}</div>
                <div className="text-[10px] opacity-80">{count > 0 ? count : '–'}</div>
              </button>
            );
          })}
        </div>
      </header>

      {/* Terminliste */}
      <main className="flex-1 p-3 space-y-2">
        {dayAppointments.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
            <CalendarDays className="h-8 w-8" />
            <span className="text-sm">Keine Termine an diesem Tag.</span>
          </div>
        )}

        {dayAppointments.map((a) => (
          <div
            key={a.id}
            className={cn(
              'rounded-lg border bg-card p-3',
              isVipTraining(a) && 'bg-emerald-500/15 border-emerald-500/50',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm font-bold tabular-nums">
                {format(new Date(a.startAt), 'HH:mm')}
                {a.endAt ? ` – ${format(new Date(a.endAt), 'HH:mm')}` : ''}
              </div>
              <div className="flex items-center gap-1">
                <ConfirmBanner appointment={a} compact />
                <EscStatusBadge status={a.status} />
              </div>
            </div>

            <div className="mt-1 text-sm font-medium">{a.title}</div>

            {(a.customerName || a.location || a.address) && (
              <div className="mt-1 space-y-0.5 text-[12px] text-muted-foreground">
                {a.customerName && (
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" /> {a.customerName}
                  </div>
                )}
                {(a.location || a.address) && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {a.location || a.address}
                  </div>
                )}
              </div>
            )}

            <div className="mt-2">
              <DepartmentBadge dept={deptOf(a.departmentId)} />
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}

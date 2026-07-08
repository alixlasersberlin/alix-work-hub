import { useMemo } from 'react';
import type { EscAppointment } from '@/lib/esc/types';
import { addDays, differenceInMinutes } from 'date-fns';

interface Row { id: string; label: string; sub?: string; color?: string; }
interface Props {
  rows: Row[];
  appointments: EscAppointment[];
  matcher: (row: Row, apt: EscAppointment) => boolean;
  days?: number;
  start?: Date;
}

const HOUR_WIDTH = 32;

export function ResourceTimeline({ rows, appointments, matcher, days = 3, start }: Props) {
  const startDay = useMemo(() => {
    const d = start ? new Date(start) : new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, [start]);

  const totalHours = days * 24;
  const totalWidth = totalHours * HOUR_WIDTH;

  return (
    <div className="border rounded-lg overflow-x-auto bg-card">
      <div className="min-w-fit">
        <div className="grid" style={{ gridTemplateColumns: `220px ${totalWidth}px` }}>
          {/* header */}
          <div className="border-b border-r bg-muted/30 p-2 text-[11px] uppercase text-muted-foreground">Ressource</div>
          <div className="border-b bg-muted/30 relative h-8">
            {Array.from({ length: days }).map((_, d) => (
              <div key={d} className="absolute top-0 h-full border-r border-border/60 text-[10px] text-muted-foreground px-1"
                   style={{ left: d * 24 * HOUR_WIDTH, width: 24 * HOUR_WIDTH }}>
                {addDays(startDay, d).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}
              </div>
            ))}
          </div>

          {rows.map((row) => {
            const apts = appointments.filter((a) => matcher(row, a));
            return (
              <div key={row.id} className="contents">
                <div className="border-b border-r p-2 text-xs">
                  <div className="font-medium truncate flex items-center gap-2">
                    {row.color && <span className="w-2 h-2 rounded-full" style={{ background: row.color }} />}
                    {row.label}
                  </div>
                  {row.sub && <div className="text-[10px] text-muted-foreground truncate">{row.sub}</div>}
                </div>
                <div className="border-b relative h-12">
                  {Array.from({ length: totalHours }).map((_, h) => (
                    <div key={h} className="absolute top-0 h-full border-r border-border/30"
                         style={{ left: h * HOUR_WIDTH, width: HOUR_WIDTH }} />
                  ))}
                  {apts.map((a) => {
                    const s = new Date(a.startAt);
                    const offsetMin = differenceInMinutes(s, startDay);
                    const durMin = Math.max(15, differenceInMinutes(new Date(a.endAt), s));
                    const left = (offsetMin / 60) * HOUR_WIDTH;
                    const width = (durMin / 60) * HOUR_WIDTH;
                    if (left + width < 0 || left > totalWidth) return null;
                    return (
                      <div key={a.id} title={a.title}
                           className="absolute top-1 bottom-1 rounded bg-primary/70 border border-primary text-[10px] text-primary-foreground px-1 truncate hover:bg-primary transition"
                           style={{ left, width }}>
                        {a.title}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

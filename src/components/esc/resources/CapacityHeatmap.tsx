import { useMemo } from 'react';
import { addDays } from 'date-fns';
import type { EscAppointment } from '@/lib/esc/types';
import type { RmEmployeeExt } from '@/lib/esc/resources/types';
import { computeEmployeeUtilization, utilizationColor, utilizationLabel } from '@/lib/esc/resources/capacity';

export function CapacityHeatmap({ employees, appointments, days = 14, start }: {
  employees: RmEmployeeExt[];
  appointments: EscAppointment[];
  days?: number;
  start?: Date;
}) {
  const startDay = useMemo(() => { const d = start ? new Date(start) : new Date(); d.setHours(0,0,0,0); return d; }, [start]);
  const dayList = useMemo(() => Array.from({ length: days }).map((_, i) => addDays(startDay, i)), [startDay, days]);

  return (
    <div className="overflow-x-auto border rounded-lg bg-card">
      <table className="text-xs">
        <thead>
          <tr>
            <th className="px-3 py-2 text-left sticky left-0 bg-card border-r text-[10px] uppercase text-muted-foreground">Mitarbeiter</th>
            {dayList.map((d) => (
              <th key={d.toISOString()} className="px-2 py-2 text-[10px] uppercase text-muted-foreground border-b">
                {d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit' })}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {employees.map((emp) => {
            const cells = computeEmployeeUtilization(emp, appointments, dayList);
            return (
              <tr key={emp.id}>
                <td className="px-3 py-1.5 sticky left-0 bg-card border-r whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    {emp.color && <span className="w-2 h-2 rounded-full" style={{ background: emp.color }} />}
                    <span className="font-medium">{emp.name}</span>
                    {emp.locationId && <span className="text-[10px] text-muted-foreground">· {emp.locationId}</span>}
                  </div>
                </td>
                {cells.map((c) => (
                  <td key={c.key} title={`${emp.name} · ${c.label} · ${utilizationLabel(c.utilization)} (${Math.round(c.utilization * 100)} %)`}
                      className="w-10 h-7 border-b border-r text-center align-middle"
                      style={{ background: utilizationColor(c.utilization) }}>
                    <span className="text-[9px] text-foreground/70">{Math.round(c.utilization * 100)}</span>
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="flex items-center gap-3 p-2 text-[10px] text-muted-foreground border-t">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: utilizationColor(0.2) }} />frei</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: utilizationColor(0.6) }} />moderat</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: utilizationColor(0.9) }} />hoch</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: utilizationColor(1.2) }} />überlastet</span>
      </div>
    </div>
  );
}

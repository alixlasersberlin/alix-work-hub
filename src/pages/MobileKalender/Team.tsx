import { useKalenderEvents } from '@/hooks/useKalenderEvents';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Users } from 'lucide-react';
import { useMemo } from 'react';

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d: Date) { const x = new Date(d); x.setHours(23,59,59,999); return x; }

export default function KalenderTeam() {
  const now = new Date();
  const { events, loading } = useKalenderEvents({ from: startOfDay(now), to: endOfDay(now), onlyMine: false });

  const byDept = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of events) {
      const k = e.department_id || 'ohne';
      map.set(k, (map.get(k) || 0) + 1);
    }
    return Array.from(map.entries());
  }, [events]);

  const byUser = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of events) {
      const k = e.assigned_user_id || 'nicht zugewiesen';
      map.set(k, (map.get(k) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a,b) => b[1] - a[1]);
  }, [events]);

  const unassigned = events.filter(e => !e.assigned_user_id).length;

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold flex items-center gap-2"><Users className="h-5 w-5" /> Team heute</h2>
      {loading ? <Skeleton className="h-40" /> : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Card className="p-3 text-center">
              <div className="text-2xl font-bold">{events.length}</div>
              <div className="text-[10px] text-muted-foreground uppercase">Termine</div>
            </Card>
            <Card className="p-3 text-center">
              <div className="text-2xl font-bold">{byUser.length}</div>
              <div className="text-[10px] text-muted-foreground uppercase">Mitarbeiter</div>
            </Card>
            <Card className={`p-3 text-center ${unassigned > 0 ? 'border-amber-500/40 bg-amber-500/5' : ''}`}>
              <div className="text-2xl font-bold">{unassigned}</div>
              <div className="text-[10px] text-muted-foreground uppercase">Ohne Zuordnung</div>
            </Card>
          </div>

          <Card className="p-3">
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Auslastung pro Abteilung</div>
            {byDept.length === 0 ? <div className="text-xs text-muted-foreground">Keine Daten</div> :
              <ul className="space-y-1">
                {byDept.map(([id, cnt]) => (
                  <li key={id} className="flex items-center justify-between text-sm">
                    <span className="truncate">{id === 'ohne' ? 'Ohne Abteilung' : id.slice(0,8)}</span>
                    <Badge variant="outline">{cnt}</Badge>
                  </li>
                ))}
              </ul>
            }
          </Card>

          <Card className="p-3">
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Termine pro Mitarbeiter</div>
            <ul className="space-y-1">
              {byUser.map(([id, cnt]) => (
                <li key={id} className="flex items-center justify-between text-sm">
                  <span className="truncate">{id === 'nicht zugewiesen' ? 'Nicht zugewiesen' : id.slice(0,8)}</span>
                  <Badge variant="outline">{cnt}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}

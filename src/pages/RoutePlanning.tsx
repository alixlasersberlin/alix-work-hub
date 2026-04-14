import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Search, MapPin } from 'lucide-react';

export default function RoutePlanning() {
  const [plans, setPlans] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('route_plans')
        .select('*, orders(order_number)')
        .order('planned_date', { ascending: false })
        .limit(100);
      setPlans(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = plans.filter(p =>
    p.orders?.order_number?.toLowerCase().includes(search.toLowerCase()) ||
    p.assigned_employee?.toLowerCase().includes(search.toLowerCase()) ||
    p.planning_status?.toLowerCase().includes(search.toLowerCase())
  );

  const statusColor = (s: string) => {
    if (s === 'abgeschlossen') return 'bg-success/10 text-success';
    if (s === 'in_bearbeitung') return 'bg-info/10 text-info';
    return 'bg-primary/10 text-primary';
  };

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
          <MapPin className="w-6 h-6 text-primary" />
          Tourenplanung
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{filtered.length} Touren</p>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Suche..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 bg-secondary border-border" />
      </div>

      <div className="rounded-xl border border-border bg-card card-glow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Auftrag</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Datum</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Zeitfenster</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Mitarbeiter</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Team</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Priorität</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Laden...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Keine Touren gefunden.</td></tr>
              ) : (
                filtered.map(p => (
                  <tr key={p.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{p.orders?.order_number || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.planned_date ? new Date(p.planned_date).toLocaleDateString('de-DE') : '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {p.time_window_start && p.time_window_end ? `${p.time_window_start} – ${p.time_window_end}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{p.assigned_employee || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.assigned_team || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">{p.priority || 'normal'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor(p.planning_status)}`}>
                        {p.planning_status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

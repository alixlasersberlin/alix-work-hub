import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { MapPin, Clock, ChevronRight, Loader2 } from 'lucide-react';

interface Tour {
  id: string;
  planned_date: string | null;
  time_window: string | null;
  contact_name: string | null;
  address_line: string | null;
  city: string | null;
  zip: string | null;
  planning_status: string | null;
  tour_type: string | null;
  priority: string | null;
}

export default function MobileHome() {
  const { user, isAdmin } = useAuth();
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!user) return;
      let q = supabase.from('route_plans')
        .select('id, planned_date, time_window, contact_name, address_line, city, zip, planning_status, tour_type, priority')
        .order('planned_date', { ascending: true })
        .limit(50);
      if (!isAdmin) q = q.eq('technician_user_id', user.id);
      const { data } = await q as any;
      setTours((data || []) as Tour[]);
      setLoading(false);
    })();
  }, [user?.id, isAdmin]);

  return (
    <div className="p-4 space-y-3">
      <h1 className="text-xl font-bold">Meine Einsätze</h1>
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> lädt…</div>
      ) : tours.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">Keine Einsätze geplant.</Card>
      ) : tours.map(t => (
        <Link key={t.id} to={`/m/einsatz/${t.id}`}>
          <Card className="p-4 hover:bg-accent/5 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>{t.planned_date ? new Date(t.planned_date).toLocaleDateString('de-DE') : 'offen'}</span>
                  {t.time_window && <span>· {t.time_window}</span>}
                  {t.tour_type && <span className="px-1.5 py-0.5 rounded bg-secondary text-foreground">{t.tour_type}</span>}
                </div>
                <div className="font-semibold mt-1 truncate">{t.contact_name || '—'}</div>
                <div className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3" />
                  <span className="truncate">{[t.address_line, t.zip, t.city].filter(Boolean).join(', ') || '—'}</span>
                </div>
                {t.planning_status && (
                  <span className="inline-block mt-2 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    {t.planning_status}
                  </span>
                )}
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-1" />
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}

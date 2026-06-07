import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Loader2 } from 'lucide-react';

type Ctx = { customerId: string };
type Item = { id: string; type: string; date: string; title: string; meta?: string };

export default function CustomerPortalAppointments() {
  const ctx = useOutletContext<Ctx>();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [m, l] = await Promise.all([
        supabase.from('device_maintenance')
          .select('id, device_name, serial_number, next_maintenance_date, maintenance_status')
          .eq('customer_id', ctx.customerId)
          .gte('next_maintenance_date', today)
          .order('next_maintenance_date', { ascending: true }),
        supabase.from('device_lifecycle')
          .select('id, event_type, event_date, description, device_name')
          .eq('customer_id', ctx.customerId)
          .in('event_type', ['Lieferung', 'Wartung', 'Reparatur'])
          .gte('event_date', today)
          .order('event_date', { ascending: true }),
      ]);
      const list: Item[] = [];
      (m.data ?? []).forEach((r: any) => list.push({
        id: `m-${r.id}`, type: 'Wartung',
        date: r.next_maintenance_date, title: r.device_name ?? 'Wartung',
        meta: r.serial_number ?? undefined,
      }));
      (l.data ?? []).forEach((r: any) => list.push({
        id: `l-${r.id}`, type: r.event_type,
        date: r.event_date, title: r.description ?? r.device_name ?? r.event_type,
      }));
      list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setItems(list);
      setLoading(false);
    })();
  }, [ctx.customerId]);

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Calendar className="w-5 h-5" /> Termine</CardTitle></CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : items.length === 0 ? (
          <p className="text-center py-10 text-muted-foreground">Keine anstehenden Termine.</p>
        ) : (
          <div className="space-y-2">
            {items.map((i) => (
              <div key={i.id} className="flex items-center justify-between p-3 border border-border rounded-md">
                <div>
                  <p className="font-medium">{i.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(i.date).toLocaleDateString('de-DE')} {i.meta && <span className="font-mono ml-2">{i.meta}</span>}
                  </p>
                </div>
                <Badge variant="outline">{i.type}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

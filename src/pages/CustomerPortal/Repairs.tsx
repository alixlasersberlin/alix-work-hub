import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wrench, Loader2 } from 'lucide-react';

type Ctx = { customerId: string };

const statusOrder = ['Eingegangen', 'In Bearbeitung', 'Warten auf Teile', 'Fertig', 'Versand vorbereitet', 'Versendet'];

function StatusTimeline({ current }: { current: string | null }) {
  const idx = current ? statusOrder.findIndex((s) => s.toLowerCase() === current.toLowerCase()) : -1;
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {statusOrder.map((s, i) => (
        <Badge key={s} variant={i <= idx ? 'default' : 'outline'} className="text-[10px]">
          {s}
        </Badge>
      ))}
    </div>
  );
}

export default function CustomerPortalRepairs() {
  const ctx = useOutletContext<Ctx>();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('repair_orders')
        .select('*')
        .eq('customer_id', ctx.customerId)
        .order('created_at', { ascending: false });
      setRows(data ?? []);
      setLoading(false);
    })();
  }, [ctx.customerId]);

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Wrench className="w-5 h-5" /> Reparaturen</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <p className="text-center py-10 text-muted-foreground">Keine Reparaturen vorhanden.</p>
        ) : rows.map((r) => (
          <div key={r.id} className="p-4 border border-border rounded-md">
            <div className="flex items-start justify-between flex-wrap gap-2">
              <div>
                <p className="font-semibold">{(r as any).repair_number ?? r.id.slice(0, 8)}</p>
                <p className="text-xs text-muted-foreground">
                  Eingang: {new Date(r.created_at).toLocaleDateString('de-DE')}
                </p>
              </div>
              <Badge>{r.repair_status ?? 'Eingegangen'}</Badge>
            </div>
            <StatusTimeline current={r.repair_status} />
            {(r as any).problem_description && (
              <p className="text-sm mt-3"><span className="text-muted-foreground">Fehlerbeschreibung: </span>{(r as any).problem_description}</p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

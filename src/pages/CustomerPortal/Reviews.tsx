import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star, Loader2 } from 'lucide-react';

type Ctx = { customerId: string };

function Stars({ n }: { n: number | null }) {
  if (n == null) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <div className="flex">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`w-3.5 h-3.5 ${i < n ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
      ))}
    </div>
  );
}

export default function CustomerPortalReviews() {
  const ctx = useOutletContext<Ctx>();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('reviews')
        .select('*')
        .eq('customer_id', ctx.customerId)
        .order('created_at', { ascending: false });
      setRows(data ?? []);
      setLoading(false);
    })();
  }, [ctx.customerId]);

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Star className="w-5 h-5" /> Ihre Bewertungen</CardTitle></CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <p className="text-center py-10 text-muted-foreground">
            Noch keine Bewertungen. Nach Lieferung oder Schulung erhalten Sie automatisch eine Einladung.
          </p>
        ) : (
          <div className="space-y-3">
            {rows.map((r: any) => (
              <div key={r.id} className="p-3 border border-border rounded-md">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="font-medium">Auftrag {r.order_number ?? '—'}</p>
                  <Badge variant="outline">{r.status ?? '—'}</Badge>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2 text-xs">
                  <div><p className="text-muted-foreground">Lieferung</p><Stars n={r.rating_delivery ?? r.rating ?? null} /></div>
                  <div><p className="text-muted-foreground">Schulung</p><Stars n={r.rating_training ?? null} /></div>
                  <div><p className="text-muted-foreground">Service</p><Stars n={r.rating_service ?? null} /></div>
                  <div><p className="text-muted-foreground">Gerät</p><Stars n={r.rating_device ?? null} /></div>
                </div>
                {r.comment && <p className="text-sm mt-2 text-muted-foreground italic">"{r.comment}"</p>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

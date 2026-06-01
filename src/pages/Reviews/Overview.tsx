import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Star, Loader2, MessageSquare, Send, CheckCircle2 } from 'lucide-react';

type Row = {
  status: string;
  invitation_sent_at: string | null;
  submitted_at: string | null;
  rating_delivery: number | null;
  rating_driver_friendliness: number | null;
};

export default function ReviewsOverview() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from('reviews')
        .select('status, invitation_sent_at, submitted_at, rating_delivery, rating_driver_friendliness')
        .limit(5000);
      setRows((data ?? []) as Row[]);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const submitted = rows.filter(r => !!r.submitted_at);
  const sent = rows.filter(r => !!r.invitation_sent_at);
  const pending = rows.filter(r => !r.invitation_sent_at);

  // Distribution: combined average of both ratings, fallback to delivery rating
  const buckets: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  submitted.forEach(r => {
    const vals = [r.rating_delivery, r.rating_driver_friendliness].filter((v): v is number => !!v);
    if (!vals.length) return;
    const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    if (avg >= 1 && avg <= 5) buckets[avg] = (buckets[avg] || 0) + 1;
  });

  const avgDelivery =
    submitted.length > 0
      ? submitted.reduce((s, r) => s + (r.rating_delivery || 0), 0) / submitted.filter(r => r.rating_delivery).length
      : 0;
  const avgDriver =
    submitted.length > 0
      ? submitted.reduce((s, r) => s + (r.rating_driver_friendliness || 0), 0) /
        submitted.filter(r => r.rating_driver_friendliness).length
      : 0;

  const maxBucket = Math.max(1, ...Object.values(buckets));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi icon={<MessageSquare className="h-5 w-5" />} label="Bewertungen gesamt" value={submitted.length} />
        <Kpi icon={<Send className="h-5 w-5" />} label="Einladungen versendet" value={sent.length} />
        <Kpi icon={<CheckCircle2 className="h-5 w-5" />} label="Noch nicht versendet" value={pending.length} />
        <Kpi
          icon={<Star className="h-5 w-5 text-amber-400" />}
          label="Ø Lieferung / Fahrer"
          value={`${avgDelivery ? avgDelivery.toFixed(1) : '–'} / ${avgDriver ? avgDriver.toFixed(1) : '–'}`}
        />
      </div>

      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">Sterne-Verteilung</h2>
        <div className="space-y-3">
          {[5, 4, 3, 2, 1].map(stars => {
            const count = buckets[stars] || 0;
            const pct = (count / maxBucket) * 100;
            return (
              <div key={stars} className="flex items-center gap-3">
                <div className="flex items-center gap-0.5 w-32 shrink-0">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={i < stars ? 'h-4 w-4 fill-amber-400 text-amber-400' : 'h-4 w-4 text-muted-foreground/30'}
                    />
                  ))}
                </div>
                <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-amber-400 transition-all" style={{ width: `${pct}%` }} />
                </div>
                <div className="w-20 text-right text-sm tabular-nums">
                  <span className="font-semibold">{count}</span>
                  <span className="text-muted-foreground"> Bew.</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold mt-2">{value}</div>
    </div>
  );
}

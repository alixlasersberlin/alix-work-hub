// Kunden-360: zeigt Feedback (NPS, Score, kritische Antworten) zu einem Kunden/Auftrag.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, AlertTriangle } from 'lucide-react';

type Props = { customerId?: string | null; orderNumber?: string | null };

export default function CustomerFeedbackCard({ customerId, orderNumber }: Props) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!customerId && !orderNumber) { setLoading(false); return; }
      const sb = supabase as any;
      let q = sb.from('survey_responses')
        .select('id, nps_score, score_total, is_critical, status, completed_at, created_at, survey_id, order_number')
        .order('created_at', { ascending: false }).limit(5);
      q = customerId ? q.eq('customer_id', customerId) : q.eq('order_number', orderNumber);
      const { data } = await q;
      if (!alive) return;
      setRows(data ?? []); setLoading(false);
    })();
    return () => { alive = false; };
  }, [customerId, orderNumber]);

  if (loading || rows.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-6 card-glow">
      <h2 className="text-base font-display font-bold text-foreground flex items-center gap-2 mb-4">
        <MessageSquare className="w-4 h-4 text-primary" /> Kundenfeedback
      </h2>
      <div className="space-y-2">
        {rows.map(r => (
          <div key={r.id} className="flex items-center justify-between gap-3 text-sm border-b border-border/60 pb-2 last:border-0">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">
                {new Date(r.completed_at ?? r.created_at).toLocaleDateString('de-DE')}
              </span>
              {r.is_critical && (
                <Badge variant="outline" className="border-destructive/40 text-destructive gap-1">
                  <AlertTriangle className="w-3 h-3" /> kritisch
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3">
              {typeof r.nps_score === 'number' && (
                <span className={r.nps_score >= 9 ? 'text-emerald-400' : r.nps_score <= 6 ? 'text-destructive' : 'text-amber-400'}>
                  NPS {r.nps_score}
                </span>
              )}
              {typeof r.score_total === 'number' && <span className="text-muted-foreground">Score {r.score_total}</span>}
              <Link to="/umfragen/antworten" className="text-primary hover:underline">Details →</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

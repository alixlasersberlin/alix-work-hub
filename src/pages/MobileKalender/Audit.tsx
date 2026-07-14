import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, CheckCircle2, XCircle, Clock, Send } from 'lucide-react';

interface Reminder {
  id: string;
  event_id: string;
  channel: string;
  scheduled_at: string;
  processed_at: string | null;
  delivered_at: string | null;
  status: string;
  error_message: string | null;
}

const statusMeta: Record<string, { label: string; color: string; icon: any }> = {
  planned: { label: 'Geplant', color: 'bg-muted text-muted-foreground', icon: Clock },
  sent: { label: 'Gesendet', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30', icon: Send },
  delivered: { label: 'Zugestellt', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', icon: CheckCircle2 },
  opened: { label: 'Geöffnet', color: 'bg-primary/15 text-primary border-primary/30', icon: CheckCircle2 },
  failed: { label: 'Fehler', color: 'bg-destructive/15 text-destructive border-destructive/30', icon: XCircle },
  cancelled: { label: 'Abgebrochen', color: 'bg-muted text-muted-foreground', icon: XCircle },
};

export default function KalenderAudit() {
  const { user } = useAuth();
  const [items, setItems] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from('appointment_reminders')
        .select('id,event_id,channel,scheduled_at,processed_at,delivered_at,status,error_message')
        .eq('user_id', user.id)
        .order('scheduled_at', { ascending: false })
        .limit(100);
      setItems((data as any) || []);
      setLoading(false);
    })();
  }, [user?.id]);

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-lg font-semibold">Audit · Benachrichtigungen</h1>
        <p className="text-xs text-muted-foreground">Nachvollziehbarer Verlauf aller Erinnerungen.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Noch keine Benachrichtigungen versendet.
        </Card>
      ) : (
        items.map((r) => {
          const meta = statusMeta[r.status] || statusMeta.planned;
          const Icon = meta.icon;
          return (
            <Card key={r.id} className="p-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={meta.color}>{meta.label}</Badge>
                    <Badge variant="outline" className="text-[10px] uppercase">{r.channel}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Geplant: {new Date(r.scheduled_at).toLocaleString('de-DE')}
                  </div>
                  {r.delivered_at && (
                    <div className="text-xs text-muted-foreground">
                      Zugestellt: {new Date(r.delivered_at).toLocaleString('de-DE')}
                    </div>
                  )}
                  {r.error_message && (
                    <div className="text-xs text-destructive mt-1">{r.error_message}</div>
                  )}
                </div>
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}

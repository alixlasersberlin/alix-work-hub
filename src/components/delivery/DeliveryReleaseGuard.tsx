import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';
import { STAGES } from '@/lib/delivery-approval/config';

const db = supabase as any;

/** Sperrt Aktionen (Lieferschein, Übergabe, Abschluss) bis alle 3 Freigaben erteilt sind. */
export function useDeliveryRelease(orderId?: string | null) {
  const [loading, setLoading] = useState(true);
  const [released, setReleased] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    if (!orderId) { setLoading(false); return; }
    (async () => {
      const { data } = await db.from('delivery_approvals').select('*').eq('order_id', orderId).maybeSingle();
      if (!active) return;
      if (!data) {
        setReleased(false);
        setMissing(STAGES.map((s) => s.title));
      } else {
        setReleased(['released', 'delivered', 'completed'].includes(data.overall_status));
        setMissing(STAGES.filter((s) => data[`${s.stage}_status`] !== 'approved').map((s) => s.title));
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [orderId]);

  return { loading, released, missing };
}

export function DeliveryReleaseGuard({
  missing, onOpenApprovals,
}: { missing: string[]; onOpenApprovals?: () => void }) {
  return (
    <Card className="p-6 border-destructive/40">
      <div className="flex items-start gap-3">
        <Lock className="h-5 w-5 text-destructive mt-0.5" />
        <div className="space-y-2">
          <div className="font-medium">Dieser Auftrag besitzt noch keine vollständige Freigabe.</div>
          <div className="text-sm text-muted-foreground">
            Fehlende Freigaben:
            <ul className="list-disc pl-5 mt-1">
              {missing.map((m) => <li key={m}>{m}</li>)}
            </ul>
          </div>
          {onOpenApprovals && (
            <Button size="sm" variant="outline" onClick={onOpenApprovals}>Zu den Freigaben</Button>
          )}
        </div>
      </div>
    </Card>
  );
}

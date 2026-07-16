import { useEffect, useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, Loader2, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import { logPortalAudit } from '@/lib/portal/audit';

type Ctx = { customerId: string; refreshBadges: () => void };

export default function CustomerPortalNotifications() {
  const ctx = useOutletContext<Ctx>();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('customer_portal_notifications')
      .select('*').eq('customer_id', ctx.customerId).order('created_at', { ascending: false }).limit(200);
    setRows(data ?? []); setLoading(false);
  };
  useEffect(() => { void load(); }, [ctx.customerId]);

  const markRead = async (id?: string) => {
    const q = supabase.from('customer_portal_notifications').update({ read_at: new Date().toISOString() });
    const { error } = id ? await q.eq('id', id) : await q.eq('customer_id', ctx.customerId).is('read_at', null);
    if (error) return toast.error(error.message);
    if (!id) toast.success('Alle als gelesen markiert.');
    void logPortalAudit({ action: 'invoice_opened', customerId: ctx.customerId, objectType: 'notification', objectId: id });
    await load(); ctx.refreshBadges?.();
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2"><Bell className="w-5 h-5" /> Benachrichtigungen</CardTitle>
          <Button size="sm" variant="outline" onClick={() => markRead()}><CheckCheck className="w-4 h-4 mr-1" />Alle als gelesen</Button>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-center py-10 text-muted-foreground text-sm">Keine Benachrichtigungen.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((n) => (
              <li key={n.id} className={`py-3 flex items-start justify-between gap-3 ${n.read_at ? '' : 'bg-primary/5 -mx-6 px-6'}`}>
                <div className="min-w-0">
                  <p className="text-sm font-medium flex items-center gap-2">
                    {!n.read_at && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                    {n.title}
                    {n.priority === 'critical' && <Badge>Kritisch</Badge>}
                    {n.priority === 'high' && <Badge variant="secondary">Hoch</Badge>}
                  </p>
                  {n.body && <p className="text-xs text-muted-foreground mt-1">{n.body}</p>}
                  <p className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString('de-DE')}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {n.target_route && <Button asChild size="sm" variant="ghost"><Link to={n.target_route} onClick={() => markRead(n.id)}>Öffnen</Link></Button>}
                  {!n.read_at && <Button size="sm" variant="outline" onClick={() => markRead(n.id)}>Gelesen</Button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

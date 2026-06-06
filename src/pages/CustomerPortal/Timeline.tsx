import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { History, Loader2, Mail, FileText, ShoppingCart, Wrench, MessageSquare } from 'lucide-react';

type Ctx = { customerId: string };

type Item = { id: string; type: string; date: string; title: string; meta?: string; icon: any };

const ICONS: Record<string, any> = { mail: Mail, doc: FileText, order: ShoppingCart, repair: Wrench, ticket: MessageSquare };

export default function CustomerPortalTimeline() {
  const ctx = useOutletContext<Ctx>();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [mail, docs, orders, repairs, tickets] = await Promise.all([
        supabase.from('mail_messages').select('id, subject, sent_at, created_at, direction').eq('customer_id', ctx.customerId).order('created_at', { ascending: false }).limit(50),
        supabase.from('mail_attachments').select('id, document_type, file_name, created_at').eq('customer_id', ctx.customerId).order('created_at', { ascending: false }).limit(50),
        supabase.from('orders').select('id, order_number, order_status, created_at').eq('customer_id', ctx.customerId).order('created_at', { ascending: false }).limit(50),
        supabase.from('repair_orders').select('id, repair_status, created_at').eq('customer_id', ctx.customerId).order('created_at', { ascending: false }).limit(50),
        supabase.from('customer_portal_tickets').select('id, subject, status, created_at').eq('customer_id', ctx.customerId).order('created_at', { ascending: false }).limit(50),
      ]);
      const list: Item[] = [];
      (mail.data ?? []).forEach((r: any) => list.push({ id: `m-${r.id}`, type: 'mail', date: r.sent_at ?? r.created_at, title: r.subject ?? '(ohne Betreff)', meta: r.direction === 'inbound' ? 'Eingang' : 'Ausgang', icon: ICONS.mail }));
      (docs.data ?? []).forEach((r: any) => list.push({ id: `d-${r.id}`, type: 'doc', date: r.created_at, title: r.file_name, meta: r.document_type, icon: ICONS.doc }));
      (orders.data ?? []).forEach((r: any) => list.push({ id: `o-${r.id}`, type: 'order', date: r.created_at, title: `Auftrag ${r.order_number}`, meta: r.order_status ?? '', icon: ICONS.order }));
      (repairs.data ?? []).forEach((r: any) => list.push({ id: `r-${r.id}`, type: 'repair', date: r.created_at, title: 'Reparatur', meta: r.repair_status ?? '', icon: ICONS.repair }));
      (tickets.data ?? []).forEach((r: any) => list.push({ id: `t-${r.id}`, type: 'ticket', date: r.created_at, title: r.subject, meta: r.status, icon: ICONS.ticket }));
      list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setItems(list);
      setLoading(false);
    })();
  }, [ctx.customerId]);

  const grouped = useMemo(() => {
    const g: Record<string, Item[]> = {};
    items.forEach((i) => {
      const key = new Date(i.date).toLocaleDateString('de-DE', { year: 'numeric', month: 'long' });
      (g[key] ||= []).push(i);
    });
    return g;
  }, [items]);

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><History className="w-5 h-5" /> Verlauf</CardTitle></CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : items.length === 0 ? (
          <p className="text-center py-10 text-muted-foreground">Noch keine Aktivität.</p>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([month, list]) => (
              <div key={month}>
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">{month}</p>
                <div className="space-y-2 border-l border-border pl-4">
                  {list.map((i) => {
                    const Icon = i.icon;
                    return (
                      <div key={i.id} className="flex items-start gap-3 relative">
                        <div className="absolute -left-[1.4rem] w-3 h-3 rounded-full bg-primary mt-1.5" />
                        <Icon className="w-4 h-4 mt-1 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{i.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(i.date).toLocaleString('de-DE')} {i.meta && <Badge variant="outline" className="ml-2 text-[10px]">{i.meta}</Badge>}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

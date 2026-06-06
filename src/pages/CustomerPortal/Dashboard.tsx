import { useEffect, useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Mail, FileText, Receipt, FileCheck2, Wrench, ArrowRight } from 'lucide-react';

type Ctx = { customerId: string; companyName: string | null; email: string | null };

export default function CustomerPortalDashboard() {
  const ctx = useOutletContext<Ctx>();
  const [stats, setStats] = useState({ messages: 0, documents: 0, invoices: 0, quotes: 0, repairs: 0 });

  useEffect(() => {
    (async () => {
      const [msg, doc, inv, qt, rep] = await Promise.all([
        supabase.from('mail_messages').select('id', { count: 'exact', head: true })
          .eq('customer_id', ctx.customerId).eq('is_read', false),
        supabase.from('mail_attachments').select('id', { count: 'exact', head: true })
          .eq('customer_id', ctx.customerId),
        supabase.from('mail_attachments').select('id', { count: 'exact', head: true })
          .eq('customer_id', ctx.customerId).eq('document_type', 'Rechnung'),
        supabase.from('orders').select('id', { count: 'exact', head: true })
          .eq('customer_id', ctx.customerId),
        supabase.from('repair_orders').select('id', { count: 'exact', head: true })
          .eq('customer_id', ctx.customerId).not('repair_status', 'in', '("Abgeschlossen","Geliefert")'),
      ]);
      setStats({
        messages: msg.count ?? 0,
        documents: doc.count ?? 0,
        invoices: inv.count ?? 0,
        quotes: qt.count ?? 0,
        repairs: rep.count ?? 0,
      });
    })();
  }, [ctx.customerId]);

  const tiles = [
    { to: '/kunde/nachrichten', label: 'Neue Nachrichten', value: stats.messages, icon: Mail },
    { to: '/kunde/dokumente', label: 'Dokumente', value: stats.documents, icon: FileText },
    { to: '/kunde/rechnungen', label: 'Rechnungen', value: stats.invoices, icon: Receipt },
    { to: '/kunde/angebote', label: 'Aufträge / Angebote', value: stats.quotes, icon: FileCheck2 },
    { to: '/kunde/reparaturen', label: 'Aktive Reparaturen', value: stats.repairs, icon: Wrench },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold">Willkommen{ctx.companyName ? `, ${ctx.companyName}` : ''}.</h2>
        <p className="text-muted-foreground text-sm">Ihre zentrale Übersicht bei Alix Lasers.</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <Link key={t.to} to={t.to}>
              <Card className="hover:border-primary transition-colors cursor-pointer h-full">
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-center justify-between">
                    <Icon className="w-5 h-5 text-primary" />
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <p className="text-3xl font-bold mt-3">{t.value}</p>
                  <p className="text-xs text-muted-foreground">{t.label}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Mail, FileText, Receipt, FileCheck2, Wrench, ArrowRight, Cpu, ShieldCheck, MessageSquare, Calendar } from 'lucide-react';

type Ctx = { customerId: string; companyName: string | null; email: string | null };

export default function CustomerPortalDashboard() {
  const ctx = useOutletContext<Ctx>();
  const [stats, setStats] = useState({
    messages: 0, documents: 0, invoices: 0, quotes: 0, repairs: 0,
    devices: 0, warranties: 0, tickets: 0, nextMaintenance: '' as string,
  });

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [msg, doc, inv, qt, rep, war, tic, ord, nextM] = await Promise.all([
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
        supabase.from('warranty_records').select('id', { count: 'exact', head: true })
          .eq('customer_id', ctx.customerId).eq('warranty_status', 'Aktiv'),
        supabase.from('customer_portal_tickets').select('id', { count: 'exact', head: true })
          .eq('customer_id', ctx.customerId).eq('status', 'offen'),
        supabase.from('orders').select('id').eq('customer_id', ctx.customerId),
        supabase.from('device_maintenance').select('next_maintenance_date')
          .eq('customer_id', ctx.customerId).gte('next_maintenance_date', today)
          .order('next_maintenance_date', { ascending: true }).limit(1),
      ]);

      let devices = 0;
      const ids = (ord.data ?? []).map((o: any) => o.id);
      if (ids.length > 0) {
        const { count } = await supabase.from('lager_devices').select('id', { count: 'exact', head: true }).in('reserved_order_id', ids);
        devices = count ?? 0;
      }

      const nextDate = (nextM.data ?? [])[0]?.next_maintenance_date as string | undefined;

      setStats({
        messages: msg.count ?? 0,
        documents: doc.count ?? 0,
        invoices: inv.count ?? 0,
        quotes: qt.count ?? 0,
        repairs: rep.count ?? 0,
        devices,
        warranties: war.count ?? 0,
        tickets: tic.count ?? 0,
        nextMaintenance: nextDate ? new Date(nextDate).toLocaleDateString('de-DE') : '—',
      });
    })();
  }, [ctx.customerId]);

  const tiles = [
    { to: '/kunde/geraete', label: 'Geräte', value: stats.devices, icon: Cpu },
    { to: '/kunde/garantien', label: 'Aktive Garantien', value: stats.warranties, icon: ShieldCheck },
    { to: '/kunde/tickets', label: 'Offene Tickets', value: stats.tickets, icon: MessageSquare },
    { to: '/kunde/reparaturen', label: 'Laufende Reparaturen', value: stats.repairs, icon: Wrench },
    { to: '/kunde/wartungen', label: 'Nächste Wartung', value: stats.nextMaintenance, icon: Calendar },
    { to: '/kunde/nachrichten', label: 'Neue Nachrichten', value: stats.messages, icon: Mail },
    { to: '/kunde/dokumente', label: 'Dokumente', value: stats.documents, icon: FileText },
    { to: '/kunde/rechnungen', label: 'Rechnungen', value: stats.invoices, icon: Receipt },
    { to: '/kunde/angebote', label: 'Aufträge / Angebote', value: stats.quotes, icon: FileCheck2 },
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

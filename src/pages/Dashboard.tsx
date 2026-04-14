import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ClipboardList, Users, MapPin, Banknote, TrendingUp, Clock } from 'lucide-react';

interface Stats {
  orders: number;
  customers: number;
  routes: number;
  openFinance: number;
}

export default function Dashboard() {
  const { profile, roles } = useAuth();
  const [stats, setStats] = useState<Stats>({ orders: 0, customers: 0, routes: 0, openFinance: 0 });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [ordersRes, customersRes, routesRes, financeRes, recentRes] = await Promise.all([
        supabase.from('orders').select('id', { count: 'exact', head: true }),
        supabase.from('customers').select('id', { count: 'exact', head: true }),
        supabase.from('route_plans').select('id', { count: 'exact', head: true }),
        supabase.from('finance_records').select('id', { count: 'exact', head: true }).eq('payment_status', 'offen'),
        supabase.from('orders').select('id, order_number, order_status, order_date, total_amount, currency').order('created_at', { ascending: false }).limit(5),
      ]);
      setStats({
        orders: ordersRes.count ?? 0,
        customers: customersRes.count ?? 0,
        routes: routesRes.count ?? 0,
        openFinance: financeRes.count ?? 0,
      });
      setRecentOrders(recentRes.data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const cards = [
    { label: 'Aufträge', value: stats.orders, icon: ClipboardList, color: 'text-primary' },
    { label: 'Kunden', value: stats.customers, icon: Users, color: 'text-info' },
    { label: 'Touren geplant', value: stats.routes, icon: MapPin, color: 'text-success' },
    { label: 'Offene Zahlungen', value: stats.openFinance, icon: Banknote, color: 'text-warning' },
  ];

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-display font-bold text-foreground">
          Willkommen zurück, <span className="gold-text">{profile?.full_name || 'Benutzer'}</span>
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Ihre aktuelle Übersicht</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map(card => (
          <div key={card.label} className="rounded-xl border border-border bg-card p-5 card-glow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">{card.label}</span>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </div>
            <p className="text-3xl font-display font-bold text-foreground">
              {loading ? '—' : card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card card-glow">
        <div className="flex items-center gap-2 p-5 border-b border-border">
          <Clock className="w-4 h-4 text-primary" />
          <h2 className="font-display font-semibold text-foreground">Letzte Aufträge</h2>
        </div>
        <div className="divide-y divide-border">
          {loading ? (
            <div className="p-5 text-muted-foreground text-sm">Laden...</div>
          ) : recentOrders.length === 0 ? (
            <div className="p-5 text-muted-foreground text-sm">Keine Aufträge vorhanden.</div>
          ) : (
            recentOrders.map(order => (
              <div key={order.id} className="flex items-center justify-between p-4 hover:bg-secondary/50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-foreground">{order.order_number}</p>
                  <p className="text-xs text-muted-foreground">
                    {order.order_date ? new Date(order.order_date).toLocaleDateString('de-DE') : '—'}
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                    {order.order_status || 'offen'}
                  </span>
                  {order.total_amount != null && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {Number(order.total_amount).toLocaleString('de-DE', { style: 'currency', currency: order.currency || 'EUR' })}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { Card } from '@/components/ui/card';
import { Building2, TrendingUp, Wrench, Boxes, Ticket, Loader2 } from 'lucide-react';

interface TenantStats {
  code: string; name: string; flag: string;
  orders: number; openTickets: number; openRepairs: number; lagerDevices: number;
}

export default function KonzernDashboard() {
  const { tenants, allowedTenants } = useTenant();
  const [stats, setStats] = useState<TenantStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const list = allowedTenants.length ? allowedTenants : tenants;
      const out: TenantStats[] = [];
      for (const t of list) {
        const src = t.zoho_source_system;
        let orders = 0, tickets = 0, repairs = 0, lager = 0;
        if (src) {
          const [{ count: oc }, { count: lc }] = await Promise.all([
            supabase.from('orders').select('id', { count: 'exact', head: true }).eq('source_system', src),
            supabase.from('lager_devices').select('id', { count: 'exact', head: true }).eq('source_system', src),
          ]);
          orders = oc || 0; lager = lc || 0;
        }
        const [{ count: tc }, { count: rc }] = await Promise.all([
          supabase.from('tickets').select('id', { count: 'exact', head: true }).neq('status', 'geschlossen'),
          supabase.from('repair_orders').select('id', { count: 'exact', head: true }).neq('repair_status', 'Abgeschlossen'),
        ]);
        // Tickets/Repairs ohne source_system-Mandantenmapping → nur Konzernsumme
        tickets = src ? 0 : (tc || 0);
        repairs = src ? 0 : (rc || 0);
        out.push({
          code: t.code, name: t.name, flag: t.flag_emoji || '🏢',
          orders, openTickets: tickets, openRepairs: repairs, lagerDevices: lager,
        });
      }
      setStats(out);
      setLoading(false);
    })();
  }, [tenants, allowedTenants]);

  const total = stats.reduce((acc, s) => ({
    orders: acc.orders + s.orders, openTickets: acc.openTickets + s.openTickets,
    openRepairs: acc.openRepairs + s.openRepairs, lagerDevices: acc.lagerDevices + s.lagerDevices,
  }), { orders: 0, openTickets: 0, openRepairs: 0, lagerDevices: 0 });

  return (
    <div className="container max-w-7xl py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Building2 className="w-7 h-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Konzern-Dashboard</h1>
          <p className="text-sm text-muted-foreground">Aggregierte KPIs aller Mandanten.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> lädt…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Kpi icon={TrendingUp} label="Aufträge gesamt" value={total.orders} />
            <Kpi icon={Ticket} label="Offene Tickets" value={total.openTickets} />
            <Kpi icon={Wrench} label="Offene Reparaturen" value={total.openRepairs} />
            <Kpi icon={Boxes} label="Lagergeräte" value={total.lagerDevices} />
          </div>

          <Card className="p-4">
            <div className="text-sm font-semibold mb-3">Pro Mandant</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-muted-foreground">
                  <tr className="text-left">
                    <th className="py-2">Mandant</th>
                    <th className="py-2 text-right">Aufträge</th>
                    <th className="py-2 text-right">Lagergeräte</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map(s => (
                    <tr key={s.code} className="border-t border-border">
                      <td className="py-2"><span className="mr-2">{s.flag}</span>{s.name}</td>
                      <td className="py-2 text-right">{s.orders}</td>
                      <td className="py-2 text-right">{s.lagerDevices}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <Card className="p-4 card-glow">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase text-muted-foreground tracking-wider">{label}</div>
          <div className="text-2xl font-bold mt-1">{value.toLocaleString('de-DE')}</div>
        </div>
        <Icon className="w-8 h-8 text-primary opacity-70" />
      </div>
    </Card>
  );
}

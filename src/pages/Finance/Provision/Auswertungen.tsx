import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { DataCard } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { BarChart3, Download } from 'lucide-react';
import { fmtMoney, STATUS_LABELS } from '@/lib/commission/constants';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line } from 'recharts';

export default function ProvisionAuswertungen() {
  const [entries, setEntries] = useState<any[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const [{ data: e }, { data: p }] = await Promise.all([
        supabase.from('commission_entries').select('*').limit(5000),
        supabase.from('user_profiles').select('id, full_name, email'),
      ]);
      setEntries(e ?? []);
      const map: Record<string, string> = {};
      (p ?? []).forEach((x: any) => { map[x.id] = x.full_name || x.email || x.id; });
      setNames(map);
    })();
  }, []);

  const perEmployee = useMemo(() => {
    const m = new Map<string, { name: string; total: number; paid: number; open: number; count: number }>();
    entries.forEach((e) => {
      const k = e.employee_id;
      const cur = m.get(k) ?? { name: names[k] ?? '–', total: 0, paid: 0, open: 0, count: 0 };
      cur.total += Number(e.commission_amount ?? 0);
      cur.paid += Number(e.paid_amount ?? 0);
      cur.open += Number(e.open_amount ?? 0);
      cur.count += 1;
      m.set(k, cur);
    });
    return [...m.values()].sort((a, b) => b.total - a.total);
  }, [entries, names]);

  const perMonth = useMemo(() => {
    const m = new Map<string, number>();
    entries.forEach((e) => {
      const k = String(e.order_date ?? e.created_at ?? '').slice(0, 7);
      if (!k) return;
      m.set(k, (m.get(k) ?? 0) + Number(e.commission_amount ?? 0));
    });
    return [...m.entries()].sort().map(([month, amount]) => ({ month, amount: Math.round(amount) }));
  }, [entries]);

  const perStatus = useMemo(() => {
    const m = new Map<string, number>();
    entries.forEach((e) => m.set(e.status, (m.get(e.status) ?? 0) + Number(e.commission_amount ?? 0)));
    return [...m.entries()].map(([status, amount]) => ({ status: STATUS_LABELS[status as keyof typeof STATUS_LABELS] ?? status, amount: Math.round(amount) }));
  }, [entries]);

  const exportCsv = () => {
    const head = ['Mitarbeiter', 'Anzahl', 'Provision gesamt', 'Ausgezahlt', 'Offen'];
    const lines = perEmployee.map((r) => [r.name, r.count, r.total.toFixed(2), r.paid.toFixed(2), r.open.toFixed(2)].join(';'));
    const blob = new Blob([[head.join(';'), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `provision-auswertung-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="p-6 lg:p-8 animate-fade-in space-y-6">
      <PageHeader
        title="Provisionsauswertungen"
        subtitle="Provisionen je Mitarbeiter, Monat und Status"
        icon={BarChart3}
        actions={<Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-2" />CSV Export</Button>}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <DataCard title="Provision je Monat">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={perMonth}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(v: any) => fmtMoney(Number(v))} />
                <Line type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </DataCard>

        <DataCard title="Provision je Status">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perStatus}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="status" fontSize={10} interval={0} angle={-20} textAnchor="end" height={60} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(v: any) => fmtMoney(Number(v))} />
                <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DataCard>
      </div>

      <DataCard title="Provision je Mitarbeiter" className="p-0">
        <div className="p-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Mitarbeiter</th>
                <th className="p-3 text-right">Posten</th>
                <th className="p-3 text-right">Provision gesamt</th>
                <th className="p-3 text-right">Ausgezahlt</th>
                <th className="p-3 text-right">Offen</th>
              </tr>
            </thead>
            <tbody>
              {perEmployee.map((r) => (
                <tr key={r.name} className="border-t border-border">
                  <td className="p-3">{r.name}</td>
                  <td className="p-3 text-right">{r.count}</td>
                  <td className="p-3 text-right font-medium">{fmtMoney(r.total)}</td>
                  <td className="p-3 text-right">{fmtMoney(r.paid)}</td>
                  <td className="p-3 text-right">{fmtMoney(r.open)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataCard>
    </div>
  );
}

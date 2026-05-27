import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Warehouse, PackageCheck, Truck, Factory, Package, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/PageShell';
import { supabase } from '@/integrations/supabase/client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts';

interface Row { notes: string | null; reserved_order_id: string | null }

function getStatus(n: string | null | undefined) {
  const m = /\[Status:\s*([^\]]+)\]/.exec(n ?? '');
  return (m?.[1] ?? '').trim();
}
function isLeih(n: string | null | undefined) {
  return (n ?? '').includes('[Typ: Leihgerät]') || (n ?? '').includes('[Leihgerät]');
}

const COLORS = {
  Leihgeräte: 'hsl(217 91% 60%)',
  Lagergeräte: 'hsl(142 71% 45%)',
  Unterwegs: 'hsl(0 84% 60%)',
  Produktion: 'hsl(38 92% 50%)',
} as const;

export default function Lager() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('lager_devices').select('notes, reserved_order_id');
      setRows((data as Row[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const counts = useMemo(() => {
    let leih = 0, lager = 0, transfer = 0, produktion = 0;
    for (const r of rows) {
      // Reservierte Geräte zählen nicht mehr als verfügbarer Lagerbestand
      if (r.reserved_order_id) continue;
      const s = getStatus(r.notes);
      if (s === 'Transfer') { transfer++; continue; }
      if (s === 'Produktion') { produktion++; continue; }
      if (isLeih(r.notes)) leih++; else lager++;
    }
    return { leih, lager, transfer, produktion, total: leih + lager + transfer + produktion };
  }, [rows]);

  const chartData = [
    { key: 'Leihgeräte', name: 'Leihgeräte', value: counts.leih, color: COLORS.Leihgeräte, path: '/lager/leihgeraete', icon: PackageCheck },
    { key: 'Lagergeräte', name: 'Lagergeräte', value: counts.lager, color: COLORS.Lagergeräte, path: '/lager/lagergeraete', icon: Warehouse },
    { key: 'Unterwegs', name: 'Unterwegs', value: counts.transfer, color: COLORS.Unterwegs, path: '/lager/equipment-area/unterwegs', icon: Truck },
    { key: 'Produktion', name: 'Produktion', value: counts.produktion, color: COLORS.Produktion, path: '/lager/equipment-area/produktion', icon: Factory },
  ];

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <PageHeader
        icon={<Warehouse className="w-6 h-6 text-primary" />}
        title="Lagerbestand"
        subtitle={`Übersicht aller Abteilungen · ${counts.total} Geräte gesamt`}
      />

      {loading ? (
        <div className="rounded-lg border border-border bg-card p-12 flex items-center justify-center text-muted-foreground">
          <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Lade Bestand…
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {chartData.map((c) => {
              const Icon = c.icon;
              return (
                <Link
                  key={c.key}
                  to={c.path}
                  className="rounded-lg border border-border bg-card p-4 hover:border-primary/50 hover:shadow-md transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-md flex items-center justify-center"
                      style={{ backgroundColor: `${c.color}20` }}
                    >
                      <Icon className="w-5 h-5" style={{ color: c.color }} />
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                        {c.name}
                      </div>
                      <div className="text-2xl font-display font-bold" style={{ color: c.color }}>
                        {c.value}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bar Chart */}
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                Geräte je Abteilung
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                    }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {chartData.map((c, i) => (
                      <Cell key={i} fill={c.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Pie Chart */}
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                Verteilung
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    innerRadius={55}
                    paddingAngle={2}
                    label={(e: { name: string; value: number }) => `${e.name}: ${e.value}`}
                  >
                    {chartData.map((c, i) => (
                      <Cell key={i} fill={c.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

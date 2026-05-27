import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Warehouse, PackageCheck, Truck, Factory, Package, Loader2, Search, X } from 'lucide-react';
import { PageHeader } from '@/components/PageShell';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts';

type SearchHit = {
  id: string;
  serial_number: string;
  model_name: string;
  status: string;
  area: { label: string; path: string; color: string };
  order_number?: string | null;
  customer_name?: string | null;
};


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
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);

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

  function areaFor(notes: string | null, leih: boolean): { label: string; path: string; color: string } {
    const s = getStatus(notes);
    if (s === 'Transfer') return { label: 'Unterwegs', path: '/lager/equipment-area/unterwegs', color: COLORS.Unterwegs };
    if (s === 'Produktion') return { label: 'Produktion', path: '/lager/equipment-area/produktion', color: COLORS.Produktion };
    if (s === 'Ausgeliefert') return { label: 'Ausgeliefert', path: '/lager/equipment-area/ausgeliefert', color: 'hsl(217 91% 60%)' };
    if (s === 'Hold' || s === 'Sperre BOSS') return { label: 'Hold', path: '/lager/equipment-area/hold', color: 'hsl(0 84% 60%)' };
    if (/warehouse/i.test(s)) return { label: 'Warehouse', path: '/lager/equipment-area/warehouse', color: 'hsl(0 0% 100%)' };
    if (leih) return { label: 'Leihgeräte', path: '/lager/leihgeraete', color: COLORS.Leihgeräte };
    return { label: 'Lagergeräte', path: '/lager/lagergeraete', color: COLORS.Lagergeräte };
  }

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      const like = `%${q}%`;
      const { data: direct } = await supabase
        .from('lager_devices')
        .select('id, serial_number, model_name, notes, reserved_order_id')
        .or(`serial_number.ilike.${like},model_name.ilike.${like}`)
        .limit(50);

      const { data: ordsNum } = await supabase
        .from('orders')
        .select('id, order_number, customers(company_name, contact_name)')
        .ilike('order_number', like)
        .limit(50);

      const { data: custs } = await supabase
        .from('customers')
        .select('id')
        .or(`company_name.ilike.${like},contact_name.ilike.${like}`)
        .limit(50);
      const custIds = (custs ?? []).map((c: any) => c.id);
      let ordsCust: any[] = [];
      if (custIds.length > 0) {
        const { data } = await supabase
          .from('orders')
          .select('id, order_number, customers(company_name, contact_name)')
          .in('customer_id', custIds)
          .limit(100);
        ordsCust = data ?? [];
      }
      const orders = [...(ordsNum ?? []), ...ordsCust];
      const orderIds = Array.from(new Set(orders.map((o: any) => o.id)));
      let byOrder: any[] = [];
      if (orderIds.length > 0) {
        const { data: dvs } = await supabase
          .from('lager_devices')
          .select('id, serial_number, model_name, notes, reserved_order_id')
          .in('reserved_order_id', orderIds)
          .limit(100);
        byOrder = dvs ?? [];
      }

      const merged = new Map<string, any>();
      [...(direct ?? []), ...byOrder].forEach((d) => merged.set(d.id, d));

      const orderMap: Record<string, { order_number: string; customer_name: string | null }> = {};
      orders.forEach((o: any) => {
        orderMap[o.id] = {
          order_number: o.order_number,
          customer_name: o.customers?.company_name || o.customers?.contact_name || null,
        };
      });
      const allOrderIds = Array.from(new Set(Array.from(merged.values()).map((d) => d.reserved_order_id).filter(Boolean)));
      const missing = allOrderIds.filter((id) => !orderMap[id]);
      if (missing.length > 0) {
        const { data: more } = await supabase
          .from('orders')
          .select('id, order_number, customers(company_name, contact_name)')
          .in('id', missing);
        (more ?? []).forEach((o: any) => {
          orderMap[o.id] = {
            order_number: o.order_number,
            customer_name: o.customers?.company_name || o.customers?.contact_name || null,
          };
        });
      }

      const hits: SearchHit[] = Array.from(merged.values()).map((d) => {
        const area = areaFor(d.notes, isLeih(d.notes));
        const info = d.reserved_order_id ? orderMap[d.reserved_order_id] : null;
        return {
          id: d.id,
          serial_number: d.serial_number,
          model_name: d.model_name,
          status: getStatus(d.notes) || (isLeih(d.notes) ? 'Leihgerät' : 'Bestand'),
          area,
          order_number: info?.order_number ?? null,
          customer_name: info?.customer_name ?? null,
        };
      });
      setResults(hits.slice(0, 100));
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

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

      {/* Suche */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Suche nach Modell, Seriennummer, Auftragsnummer oder Kundenname…"
            className="pl-9 pr-9"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted text-muted-foreground"
              aria-label="Suche leeren"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {query.trim().length >= 2 && (
          <div className="mt-4">
            {searching ? (
              <div className="flex items-center text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Suche läuft…
              </div>
            ) : results.length === 0 ? (
              <div className="text-sm text-muted-foreground">Keine Treffer.</div>
            ) : (
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground mb-2">{results.length} Treffer</div>
                <div className="divide-y divide-border rounded-md border border-border overflow-hidden">
                  {results.map((r) => (
                    <Link
                      key={r.id}
                      to={r.area.path}
                      className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-muted/50 transition-colors text-sm"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{r.model_name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          SN {r.serial_number}
                          {r.order_number ? ` · Auftrag ${r.order_number}` : ''}
                          {r.customer_name ? ` · ${r.customer_name}` : ''}
                        </div>
                      </div>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full border whitespace-nowrap"
                        style={{ color: r.area.color, borderColor: `${r.area.color}55`, backgroundColor: `${r.area.color}15` }}
                      >
                        {r.area.label}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>


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

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { KpiTile } from '@/components/infinity/KpiTile';
import { SkeletonKpiGrid } from '@/components/infinity/Skeleton';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  ShoppingCart, CheckCircle2, Clock, Factory, AlertTriangle, ListOrdered, Search,
} from 'lucide-react';

interface Row {
  id: string;
  order_number: string | null;
  internal_number: string | null;
  source_system: string | null;
  order_status: string | null;
  total_amount: number | null;
  order_date: string | null;
  deposit_ok: boolean | null;
  deposit_amount: number | null;
  customers?: { customer_name: string | null } | null;
  production_orders?: { id: string; status: string | null; sent_at: string | null; approval_status: string | null }[];
}

type Filter = 'all' | 'deposit_open' | 'deposit_ok_no_order' | 'ordered';

export default function BestellungenDashboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from('orders')
        .select('id, order_number, internal_number, source_system, order_status, total_amount, order_date, deposit_ok, deposit_amount, customers(customer_name), production_orders(id, status, sent_at, approval_status)')
        .order('order_date', { ascending: false })
        .limit(1000);
      setRows((data ?? []) as Row[]);
      setLoading(false);
    })();
  }, []);

  const enriched = useMemo(() => rows.map(r => {
    const pos = r.production_orders ?? [];
    const ordered = pos.some(p => !!p.sent_at || (p.status && !['Entwurf', 'draft'].includes(p.status)));
    const hasPo = pos.length > 0;
    const depositOk = !!r.deposit_ok;
    return { ...r, _ordered: ordered, _hasPo: hasPo, _depositOk: depositOk };
  }), [rows]);

  const kpis = useMemo(() => {
    const total = enriched.length;
    const depositOk = enriched.filter(r => r._depositOk).length;
    const depositOpen = total - depositOk;
    const ordered = enriched.filter(r => r._ordered).length;
    const canOrder = enriched.filter(r => r._depositOk && !r._ordered).length;
    return { total, depositOk, depositOpen, ordered, canOrder };
  }, [enriched]);

  const visible = useMemo(() => {
    let list = [...enriched];
    if (filter === 'deposit_open') list = list.filter(r => !r._depositOk);
    if (filter === 'deposit_ok_no_order') list = list.filter(r => r._depositOk && !r._ordered);
    if (filter === 'ordered') list = list.filter(r => r._ordered);
    if (q.trim()) {
      const s = q.toLowerCase();
      list = list.filter(r =>
        (r.order_number ?? '').toLowerCase().includes(s) ||
        (r.internal_number ?? '').toLowerCase().includes(s) ||
        (r.customers?.customer_name ?? '').toLowerCase().includes(s));
    }
    // Sortierung: Anzahlung OK + noch nicht bestellt zuerst, dann Anzahlung OK bestellt, dann offen
    list.sort((a, b) => {
      const score = (r: any) => r._depositOk && !r._ordered ? 0 : r._depositOk && r._ordered ? 1 : 2;
      const s = score(a) - score(b);
      if (s !== 0) return s;
      return (b.order_date ?? '').localeCompare(a.order_date ?? '');
    });
    return list;
  }, [enriched, filter, q]);

  const fmt = (n: number | null | undefined) =>
    (Number(n ?? 0)).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

  return (
    <div className="p-6 lg:p-8 animate-fade-in space-y-6">
      <PageHeader
        icon={ShoppingCart}
        title="Bestellungen"
        subtitle="Übersicht aller Aufträge und Bestellstatus – sortiert nach Anzahlung"
        noBreadcrumbs
      />

      {loading ? (
        <SkeletonKpiGrid count={5} />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <button onClick={() => setFilter('all')} className="text-left">
            <KpiTile label="Aufträge gesamt" value={kpis.total} icon={ListOrdered} accent="sky" />
          </button>
          <button onClick={() => setFilter('deposit_open')} className="text-left">
            <KpiTile label="Anzahlung offen" value={kpis.depositOpen} icon={Clock} accent="rose" />
          </button>
          <button onClick={() => setFilter('deposit_ok_no_order')} className="text-left">
            <KpiTile label="Anzahlung OK · offen" value={kpis.canOrder} icon={CheckCircle2} accent="gold" />
          </button>
          <button onClick={() => setFilter('ordered')} className="text-left">
            <KpiTile label="Bestellt" value={kpis.ordered} icon={Factory} accent="emerald" />
          </button>
          <KpiTile label="Anzahlung OK gesamt" value={kpis.depositOk} icon={CheckCircle2} accent="violet" />
        </div>
      )}

      <Card className="p-4">
        <div className="flex items-center gap-3 flex-wrap mb-4">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Auftrag oder Kunde suchen…" className="pl-9" />
          </div>
          <div className="text-sm text-muted-foreground">
            {visible.length} Aufträge · Filter: <b>{
              filter === 'all' ? 'Alle' :
              filter === 'deposit_open' ? 'Anzahlung offen' :
              filter === 'deposit_ok_no_order' ? 'Anzahlung OK, noch nicht bestellt' : 'Bereits bestellt'
            }</b>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left py-2 px-2">Auftrag</th>
                <th className="text-left py-2 px-2">Kunde</th>
                <th className="text-right py-2 px-2">Betrag</th>
                <th className="text-center py-2 px-2">Anzahlung</th>
                <th className="text-center py-2 px-2">Bestellung</th>
                <th className="text-left py-2 px-2">Status</th>
                <th className="py-2 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {visible.map(r => (
                <tr key={r.id} className="border-b border-border/40 hover:bg-muted/30">
                  <td className="py-2 px-2 font-medium">
                    {r.order_number || r.internal_number || r.id.slice(0, 8)}
                  </td>
                  <td className="py-2 px-2 truncate max-w-[260px]">{r.customers?.customer_name ?? '—'}</td>
                  <td className="py-2 px-2 text-right">{fmt(r.total_amount)}</td>
                  <td className="py-2 px-2 text-center">
                    {r._depositOk ? (
                      <Badge variant="outline" className="border-emerald-500/50 text-emerald-500">OK</Badge>
                    ) : (
                      <Badge variant="outline" className="border-rose-500/50 text-rose-500">offen</Badge>
                    )}
                  </td>
                  <td className="py-2 px-2 text-center">
                    {r._ordered ? (
                      <Badge variant="outline" className="border-emerald-500/50 text-emerald-500">bestellt</Badge>
                    ) : r._depositOk ? (
                      <Badge variant="outline" className="border-amber-500/50 text-amber-500">bereit</Badge>
                    ) : (
                      <Badge variant="outline" className="border-muted-foreground/40 text-muted-foreground">wartet</Badge>
                    )}
                  </td>
                  <td className="py-2 px-2 text-muted-foreground">{r.order_status ?? '—'}</td>
                  <td className="py-2 px-2 text-right">
                    <Link to={`/order/${r.id}`} className="text-amber-400 hover:underline text-xs">Öffnen</Link>
                  </td>
                </tr>
              ))}
              {!loading && visible.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">Keine Aufträge gefunden</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

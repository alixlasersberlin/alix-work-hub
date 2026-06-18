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
  ShoppingCart, CheckCircle2, Clock, Factory, ListOrdered, Search, Crown,
} from 'lucide-react';

interface ProdOrder {
  id: string;
  production_order_number: string | null;
  status: string | null;
  sent_at: string | null;
  approval_status: string | null;
  pdf_path: string | null;
  modellname: string | null;
  farbe: string | null;
  liefertermin: string | null;
  is_reclamation: boolean | null;
  supplier?: { name: string | null } | null;
}

interface Row {
  id: string;
  order_number: string | null;
  internal_number: string | null;
  source_system: string | null;
  order_status: string | null;
  total_amount: number | null;
  order_date: string | null;
  expected_shipment_date: string | null;
  salesperson_name: string | null;
  deposit_ok: boolean | null;
  deposit_ok_at: string | null;
  deposit_amount: number | null;
  deposit_additional: number | null;
  deposit_booking_date: string | null;
  is_vip: boolean | null;
  finance_paid_amount: number | null;
  finance_open_amount: number | null;
  finance_payment_status: string | null;
  customers?: { company_name: string | null; contact_name: string | null; is_vip: boolean | null } | null;
  production_orders?: ProdOrder[];
}

type Filter = 'all' | 'deposit_open' | 'deposit_ok_no_order' | 'ordered' | 'vip';

const AT = (s?: string | null) => s === 'zoho_eu_2';

export default function BestellungenDashboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');

  useEffect(() => {
    (async () => {
      const { data: ordersData, error: oErr } = await (supabase as any)
        .from('orders')
        .select(`
          id, order_number, internal_number, source_system, order_status, total_amount,
          order_date, expected_shipment_date, salesperson_name,
          deposit_ok, deposit_ok_at, deposit_amount, deposit_additional, deposit_booking_date, is_vip,
          finance_paid_amount, finance_open_amount, finance_payment_status,
          customers(company_name, contact_name, is_vip)
        `)
        .order('order_date', { ascending: false })
        .not('order_status', 'ilike', 'geliefert')
        .limit(2000);
      if (oErr) console.error('orders error', oErr);

      const orderIds = (ordersData ?? []).map((r: any) => r.id);
      let poByOrder: Record<string, ProdOrder[]> = {};
      if (orderIds.length) {
        const { data: poData, error: pErr } = await (supabase as any)
          .from('production_orders')
          .select('id, order_id, production_order_number, status, sent_at, approval_status, pdf_path, modellname, farbe, liefertermin, is_reclamation, supplier:suppliers(name)')
          .in('order_id', orderIds);
        if (pErr) console.error('production_orders error', pErr);
        (poData ?? []).forEach((p: any) => {
          if (!p.order_id) return;
          (poByOrder[p.order_id] ||= []).push(p);
        });
      }

      const merged = (ordersData ?? []).map((r: any) => ({ ...r, production_orders: poByOrder[r.id] ?? [] }));
      setRows(merged as Row[]);
      setLoading(false);
    })();
  }, []);

  const enriched = useMemo(() => rows.map(r => {
    const pos = r.production_orders ?? [];
    const ordered = pos.some(p => !!p.sent_at || (p.status && !['Entwurf', 'draft'].includes(p.status)));
    return { ...r, _ordered: ordered, _hasPo: pos.length > 0, _depositOk: !!r.deposit_ok, _vip: !!(r.is_vip || r.customers?.is_vip) };
  }), [rows]);

  const kpis = useMemo(() => {
    const total = enriched.length;
    const depositOk = enriched.filter(r => r._depositOk).length;
    const depositOpen = total - depositOk;
    const ordered = enriched.filter(r => r._ordered).length;
    const canOrder = enriched.filter(r => r._depositOk && !r._ordered).length;
    const vip = enriched.filter(r => r._vip).length;
    return { total, depositOk, depositOpen, ordered, canOrder, vip };
  }, [enriched]);

  const visible = useMemo(() => {
    let list = [...enriched];
    if (filter === 'deposit_open') list = list.filter(r => !r._depositOk);
    if (filter === 'deposit_ok_no_order') list = list.filter(r => r._depositOk && !r._ordered);
    if (filter === 'ordered') list = list.filter(r => r._ordered);
    if (filter === 'vip') list = list.filter(r => r._vip);
    if (q.trim()) {
      const s = q.toLowerCase();
      list = list.filter(r =>
        (r.order_number ?? '').toLowerCase().includes(s) ||
        (r.internal_number ?? '').toLowerCase().includes(s) ||
        (r.customers?.company_name ?? '').toLowerCase().includes(s) ||
        (r.customers?.contact_name ?? '').toLowerCase().includes(s) ||
        (r.salesperson_name ?? '').toLowerCase().includes(s));
    }
    list.sort((a, b) => {
      if (a._vip !== b._vip) return a._vip ? -1 : 1;
      const score = (r: any) => r._depositOk && !r._ordered ? 0 : r._depositOk && r._ordered ? 1 : 2;
      const s = score(a) - score(b);
      if (s !== 0) return s;
      return (b.order_date ?? '').localeCompare(a.order_date ?? '');
    });
    return list;
  }, [enriched, filter, q]);

  const fmt = (n: number | null | undefined) =>
    (Number(n ?? 0)).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
  const fmtDate = (s: string | null | undefined) => s ? new Date(s).toLocaleDateString('de-DE') : '—';
  const num = (s: string | null | undefined, src?: string | null) =>
    s ? (AT(src) ? `${s}-AT` : s) : '—';
  const customerName = (r: Row) =>
    r.customers?.company_name || r.customers?.contact_name || '—';

  return (
    <div className="p-6 lg:p-8 animate-fade-in space-y-6">
      <PageHeader
        icon={ShoppingCart}
        title="Bestellungen"
        subtitle="Übersicht aller Aufträge mit Anzahlungs- und Bestellstatus"
        noBreadcrumbs
      />

      {loading ? (
        <SkeletonKpiGrid count={6} />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <button onClick={() => setFilter('all')} className="text-left"><KpiTile label="Aufträge gesamt" value={kpis.total} icon={ListOrdered} accent="sky" /></button>
          <button onClick={() => setFilter('deposit_open')} className="text-left"><KpiTile label="Anzahlung offen" value={kpis.depositOpen} icon={Clock} accent="rose" /></button>
          <button onClick={() => setFilter('deposit_ok_no_order')} className="text-left"><KpiTile label="Anzahlung OK · offen" value={kpis.canOrder} icon={CheckCircle2} accent="gold" /></button>
          <button onClick={() => setFilter('ordered')} className="text-left"><KpiTile label="Bestellt" value={kpis.ordered} icon={Factory} accent="emerald" /></button>
          <KpiTile label="Anzahlung OK gesamt" value={kpis.depositOk} icon={CheckCircle2} accent="violet" />
          <button onClick={() => setFilter('vip')} className="text-left"><KpiTile label="VIP" value={kpis.vip} icon={Crown} accent="gold" /></button>
        </div>
      )}

      <Card className="p-4">
        <div className="flex items-center gap-3 flex-wrap mb-4">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Auftrag, Kunde, Verkäufer…" className="pl-9" />
          </div>
          <div className="text-sm text-muted-foreground">
            {visible.length} Aufträge
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-[11px] text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left py-2 px-2">Auftrag</th>
                <th className="text-left py-2 px-2">Kunde</th>
                <th className="text-left py-2 px-2">Verkäufer</th>
                <th className="text-left py-2 px-2">Datum</th>
                <th className="text-left py-2 px-2">Lieferdatum</th>
                <th className="text-right py-2 px-2">Betrag</th>
                <th className="text-right py-2 px-2">Anzahlung €</th>
                <th className="text-left py-2 px-2">Anz.-Datum</th>
                <th className="text-center py-2 px-2">Anzahlung</th>
                <th className="text-left py-2 px-2">Modell / Farbe</th>
                <th className="text-left py-2 px-2">Lieferant</th>
                <th className="text-left py-2 px-2">PO-Status</th>
                <th className="text-left py-2 px-2">Freigabe</th>
                <th className="text-center py-2 px-2">Bestellung</th>
                <th className="text-left py-2 px-2">Zahlung</th>
                <th className="py-2 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {visible.map(r => {
                const po = (r.production_orders ?? [])[0];
                const depTotal = Number(r.deposit_amount || 0) + Number(r.deposit_additional || 0);
                return (
                  <tr key={r.id} className="border-b border-border/40 hover:bg-muted/30">
                    <td className="py-2 px-2 font-medium whitespace-nowrap">
                      {r._vip && <Crown className="inline w-3 h-3 text-amber-400 mr-1" />}
                      {num(r.order_number || r.internal_number, r.source_system)}
                    </td>
                    <td className="py-2 px-2 truncate max-w-[200px]">{customerName(r)}</td>
                    <td className="py-2 px-2 truncate max-w-[140px]">{r.salesperson_name ?? '—'}</td>
                    <td className="py-2 px-2 whitespace-nowrap">{fmtDate(r.order_date)}</td>
                    <td className="py-2 px-2 whitespace-nowrap">{fmtDate(r.expected_shipment_date)}</td>
                    <td className="py-2 px-2 text-right whitespace-nowrap">{fmt(r.total_amount)}</td>
                    <td className="py-2 px-2 text-right whitespace-nowrap">{fmt(depTotal)}</td>
                    <td className="py-2 px-2 whitespace-nowrap">{fmtDate(r.deposit_booking_date)}</td>
                    <td className="py-2 px-2 text-center">
                      {r._depositOk
                        ? <Badge variant="outline" className="border-emerald-500/50 text-emerald-500">OK</Badge>
                        : <Badge variant="outline" className="border-rose-500/50 text-rose-500">offen</Badge>}
                    </td>
                    <td className="py-2 px-2 truncate max-w-[160px]">
                      {po ? `${po.modellname ?? '—'}${po.farbe ? ' · ' + po.farbe : ''}` : '—'}
                    </td>
                    <td className="py-2 px-2 truncate max-w-[140px]">{po?.supplier?.name ?? '—'}</td>
                    <td className="py-2 px-2">{po?.status ?? '—'}</td>
                    <td className="py-2 px-2">{po?.approval_status ?? '—'}</td>
                    <td className="py-2 px-2 text-center">
                      {r._ordered
                        ? <Badge variant="outline" className="border-emerald-500/50 text-emerald-500">bestellt</Badge>
                        : r._depositOk
                          ? <Badge variant="outline" className="border-amber-500/50 text-amber-500">bereit</Badge>
                          : <Badge variant="outline" className="border-muted-foreground/40 text-muted-foreground">wartet</Badge>}
                    </td>
                    <td className="py-2 px-2">{r.finance_payment_status ?? '—'}</td>
                    <td className="py-2 px-2 text-right">
                      <Link to={`/order/${r.id}`} className="text-amber-400 hover:underline">Öffnen</Link>
                    </td>
                  </tr>
                );
              })}
              {!loading && visible.length === 0 && (
                <tr><td colSpan={16} className="py-8 text-center text-muted-foreground">Keine Aufträge gefunden</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronRight, ShieldCheck } from 'lucide-react';
import { STAGES, STATUS_UI, OVERALL_UI, type ApprovalStage, type OverallStatus } from '@/lib/delivery-approval/config';
import DeliveryApprovalPanel from '@/components/delivery/DeliveryApprovalPanel';

interface Row {
  id: string;
  order_id: string;
  overall_status: OverallStatus;
  warehouse_status: string;
  accounting_status: string;
  dispatch_status: string;
  order_number: string | null;
  customer_name: string | null;
}

export default function FreigabenMobile() {
  const { user, loading: authLoading, hasAnyRole } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [openOrder, setOpenOrder] = useState<Row | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('delivery_approvals')
      .select('id, order_id, overall_status, warehouse_status, accounting_status, dispatch_status')
      .not('overall_status', 'in', '("delivered","completed")')
      .order('updated_at', { ascending: false })
      .limit(200);

    const list = (data ?? []) as any[];
    const ids = list.map((r) => r.order_id);
    let meta: Record<string, { order_number: string | null; customer_name: string | null }> = {};
    if (ids.length) {
      const { data: orders } = await (supabase as any)
        .from('orders')
        .select('id, order_number, customer_name')
        .in('id', ids);
      meta = Object.fromEntries(((orders ?? []) as any[]).map((o) => [o.id, o]));
    }
    setRows(list.map((r) => ({
      ...r,
      order_number: meta[r.order_id]?.order_number ?? null,
      customer_name: meta[r.order_id]?.customer_name ?? null,
    })));
    setLoading(false);
  };

  useEffect(() => { if (user) void load(); }, [user]);

  const myStages = useMemo(
    () => STAGES.filter((s) => hasAnyRole(s.roles)).map((s) => s.stage as ApprovalStage),
    [hasAnyRole],
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const base = s
      ? rows.filter((r) => `${r.order_number ?? ''} ${r.customer_name ?? ''}`.toLowerCase().includes(s))
      : rows;
    // Vorgänge, bei denen eine meiner Stufen offen ist, zuerst
    const mine = (r: Row) => myStages.some((st) => (r as any)[`${st}_status`] !== 'approved');
    return [...base].sort((a, b) => Number(mine(b)) - Number(mine(a)));
  }, [rows, q, myStages]);

  if (authLoading) return <div className="p-4"><Skeleton className="h-24 w-full" /></div>;
  if (!user) return <Navigate to="/auth" replace />;

  if (openOrder) {
    return (
      <div className="min-h-screen bg-background pb-16">
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 p-3 backdrop-blur">
          <button className="text-sm text-muted-foreground" onClick={() => { setOpenOrder(null); void load(); }}>
            ← Zurück
          </button>
          <div className="font-semibold">{openOrder.order_number ?? openOrder.order_id.slice(0, 8)}</div>
        </div>
        <div className="p-3">
          <DeliveryApprovalPanel orderId={openOrder.order_id} orderNumber={openOrder.order_number ?? undefined} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="sticky top-0 z-10 space-y-3 border-b border-border bg-background/95 p-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">Auslieferungsfreigabe</h1>
          <Link to="/m" className="ml-auto text-xs text-muted-foreground">Mobile</Link>
        </div>
        <Input placeholder="Auftrag oder Kunde suchen…" value={q} onChange={(e) => setQ(e.target.value)} />
      </header>

      <div className="space-y-2 p-3">
        {loading && [1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}

        {!loading && filtered.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">Keine offenen Freigaben.</div>
        )}

        {!loading && filtered.map((r) => {
          const ui = OVERALL_UI[r.overall_status] ?? OVERALL_UI.waiting;
          return (
            <Card key={r.id} className="p-3 active:opacity-80" onClick={() => setOpenOrder(r)}>
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${ui.dot}`} />
                <div className="font-semibold">{r.order_number ?? r.order_id.slice(0, 8)}</div>
                <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-0.5 truncate text-sm text-muted-foreground">{r.customer_name ?? '—'}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {STAGES.map((s) => {
                  const st = ((r as any)[`${s.stage}_status`] ?? 'open') as keyof typeof STATUS_UI;
                  return (
                    <Badge key={s.stage} variant="outline" className={`text-[11px] ${STATUS_UI[st].text}`}>
                      <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${STATUS_UI[st].dot}`} />
                      {s.title}
                    </Badge>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

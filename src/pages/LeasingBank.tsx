import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Landmark, Search, Loader2, Inbox, Eye, Check } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { PageSizeSelector, usePagination, PaginationControls } from '@/components/PageSizeSelector';

export default function LeasingBank() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [requestedOrderIds, setRequestedOrderIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data, error: err }, { data: reqs }] = await Promise.all([
        supabase
          .from('orders')
          .select('id, order_number, order_date, total_amount, currency, order_status, customers(company_name, contact_name)')
          .in('order_status', ['open', 'hold', 'Hold', 'HOLD', 'on_hold', 'On Hold', 'overdue', 'Overdue', 'überfällig', 'Überfällig'])
          .order('order_date', { ascending: false, nullsFirst: false })
          .limit(1000),
        supabase.from('bank_financing_requests').select('order_id'),
      ]);
      if (err) setError(err.message);
      setOrders(data ?? []);
      setRequestedOrderIds(new Set((reqs ?? []).map((r: any) => r.order_id)));
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) => {
      const name = o.customers?.company_name || o.customers?.contact_name || '';
      return (
        (o.order_number || '').toLowerCase().includes(q) ||
        name.toLowerCase().includes(q)
      );
    });
  }, [orders, search]);

  const { pageSize, setPageSize, page, setPage, totalPages, paged, total } = usePagination(filtered, 20);

  const fmtMoney = (v: number | null, c?: string | null) =>
    v == null ? '—' : new Intl.NumberFormat('de-DE', { style: 'currency', currency: c || 'EUR' }).format(Number(v));
  const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('de-DE') : '—');

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Landmark className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Verfügbare Aufträge</h1>
          <p className="text-muted-foreground text-sm">
            Aufträge mit Status <span className="font-medium">OPEN</span>, <span className="font-medium">HOLD</span> oder <span className="font-medium">OVERDUE</span>.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
          <CardTitle>Übersicht ({filtered.length})</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Suche Auftrag / Kunde…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <PageSizeSelector value={pageSize} onChange={setPageSize} />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-destructive text-sm py-10 text-center">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Inbox className="h-8 w-8 mb-2" />
              <p className="text-sm">Keine offenen Aufträge gefunden.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Auftragsnr.</TableHead>
                    <TableHead>Kunde</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead className="text-right">Betrag</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((o) => (
                    <TableRow key={o.id} className="cursor-pointer" onClick={() => navigate(`/auftraege/${o.id}`)}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {requestedOrderIds.has(o.id) && (
                            <span
                              title="Anfrage gestellt"
                              className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-yellow-400/20 text-yellow-500 ring-1 ring-yellow-500/40"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </span>
                          )}
                          <span>{o.order_number || '—'}</span>
                        </div>
                      </TableCell>
                      <TableCell>{o.customers?.company_name || o.customers?.contact_name || '—'}</TableCell>
                      <TableCell>{fmtDate(o.order_date)}</TableCell>
                      <TableCell className="text-right">{fmtMoney(o.total_amount, o.currency)}</TableCell>
                      <TableCell><StatusBadge status={o.order_status} /></TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/auftraege/${o.id}`);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} total={total} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

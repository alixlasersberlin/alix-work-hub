import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Receipt, Search, ExternalLink, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { withAt } from '@/lib/atSuffix';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

type Row = {
  id: string;
  order_number: string | null;
  order_status: string | null;
  order_date: string | null;
  deposit_ok_at: string | null;
  deposit_amount: number | null;
  total_amount: number | null;
  source_system: string | null;
  salesperson_name: string | null;
  customer_id: string | null;
};

type CustomerLite = { id: string; company_name: string | null; contact_name: string | null };

const fmtMoney = (n: number | null | undefined) =>
  n == null ? '–' : new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(Number(n));
const fmtDate = (d: string | null | undefined) =>
  !d ? '–' : new Date(d).toLocaleDateString('de-DE');

export default function Anzahlungsrechnung() {
  const [rows, setRows] = useState<Row[]>([]);
  const [customers, setCustomers] = useState<Record<string, CustomerLite>>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  const load = async () => {
    setLoading(true);
    // 1) Open/offen orders with confirmed deposit
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, order_number, order_status, order_date, deposit_ok_at, deposit_amount, total_amount, source_system, salesperson_name, customer_id')
      .in('order_status', ['open', 'offen'])
      .eq('deposit_ok', true)
      .neq('source_system', 'zoho_eu_2')
      .order('order_date', { ascending: false });

    if (error) {
      console.error(error);
      setRows([]);
      setLoading(false);
      return;
    }

    // 2) Exclude orders that already have a production order
    const orderIds = (orders ?? []).map(o => o.id);
    let withProd = new Set<string>();
    if (orderIds.length) {
      const { data: prod } = await supabase
        .from('production_orders')
        .select('order_id')
        .in('order_id', orderIds);
      withProd = new Set((prod ?? []).map((p: any) => p.order_id).filter(Boolean));
    }
    const filtered = (orders ?? []).filter(o => !withProd.has(o.id)) as Row[];

    // 3) Load customer names
    const custIds = Array.from(new Set(filtered.map(o => o.customer_id).filter(Boolean) as string[]));
    if (custIds.length) {
      const { data: custs } = await supabase
        .from('customers')
        .select('id, company_name, contact_name')
        .in('id', custIds);
      const map: Record<string, CustomerLite> = {};
      (custs ?? []).forEach((c: any) => { map[c.id] = c; });
      setCustomers(map);
    } else {
      setCustomers({});
    }

    setRows(filtered);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(r => {
      const cust = r.customer_id ? customers[r.customer_id] : undefined;
      const custName = (cust?.company_name || cust?.contact_name || '').toLowerCase();
      const num = withAt(r.order_number, r.source_system).toLowerCase();
      return custName.includes(term) || num.includes(term);
    });
  }, [rows, customers, q]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, r) => {
        acc.deposit += Number(r.deposit_amount || 0);
        acc.total += Number(r.total_amount || 0);
        return acc;
      },
      { deposit: 0, total: 0 },
    );
  }, [filtered]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Receipt className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Neue Anzahlungen</h1>
            <p className="text-muted-foreground text-sm">
              Aufträge mit bestätigter Anzahlung (Status offen / open) ohne bereits ausgelöste Bestellung.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Aktualisieren
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Aufträge</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{filtered.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Summe Anzahlungen</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{fmtMoney(totals.deposit)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Summe Aufträge</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{fmtMoney(totals.total)}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Übersicht</CardTitle>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Suche Kunde / Auftragsnr."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 text-center text-muted-foreground text-sm">Lade …</div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">Keine Aufträge gefunden.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Auftragsnr.</TableHead>
                    <TableHead>Kunde</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Auftragsdatum</TableHead>
                    <TableHead>Anz. bestätigt</TableHead>
                    <TableHead className="text-right">Anzahlung</TableHead>
                    <TableHead className="text-right">Auftragssumme</TableHead>
                    <TableHead>Verkäufer</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const cust = r.customer_id ? customers[r.customer_id] : undefined;
                    const custName = cust?.company_name || cust?.contact_name || '–';
                    const isAt = r.source_system === 'zoho_eu_2';
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {withAt(r.order_number, r.source_system) || '–'}
                            {isAt && <Badge variant="outline" className="text-[10px]">AT 🇦🇹</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>{custName}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">{r.order_status}</Badge>
                        </TableCell>
                        <TableCell>{fmtDate(r.order_date)}</TableCell>
                        <TableCell>{fmtDate(r.deposit_ok_at)}</TableCell>
                        <TableCell className="text-right">{fmtMoney(r.deposit_amount)}</TableCell>
                        <TableCell className="text-right">{fmtMoney(r.total_amount)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.salesperson_name || '–'}</TableCell>
                        <TableCell>
                          <Button asChild size="sm" className="gold-gradient text-primary-foreground">
                            <Link to={`/auftraege/${r.id}`}>
                              <ExternalLink className="h-4 w-4 mr-2" />
                              BEARBEITUNG
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

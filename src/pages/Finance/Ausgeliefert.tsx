import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Truck, Search, CheckCircle2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DataCard, PageEmpty } from '@/components/PageShell';
import { PageHeader } from '@/components/infinity/PageHeader';
import { SkeletonTable } from '@/components/infinity/Skeleton';
import { InfinityStatusBadge } from '@/components/infinity/StatusBadge';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const eur = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n || 0);
const dfmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString('de-DE') : '–');

const DELIVERED_STATUSES = ['geliefert', 'teilgeliefert', 'versendet'];

type Row = {
  id: string;
  order_number: string | null;
  order_status: string | null;
  order_date: string | null;
  expected_shipment_date: string | null;
  total_amount: number | null;
  finance_total_amount: number | null;
  finance_paid_amount: number | null;
  finance_open_amount: number | null;
  finance_payment_status: string | null;
  invoiced_flag: boolean | null;
  salesperson_name: string | null;
  source_system: string | null;
  customer_id: string | null;
  customer_name?: string;
};

export default function AusgeliefertePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [invoiceFilter, setInvoiceFilter] = useState<'all' | 'invoiced' | 'open'>('all');
  const [systemFilter, setSystemFilter] = useState<'all' | 'de' | 'at'>('all');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, order_status, order_date, expected_shipment_date, total_amount, finance_total_amount, finance_paid_amount, finance_open_amount, finance_payment_status, invoiced_flag, salesperson_name, source_system, customer_id')
        .in('order_status', DELIVERED_STATUSES)
        .order('expected_shipment_date', { ascending: false, nullsFirst: false })
        .limit(1000);
      if (error) { console.error(error); setLoading(false); return; }
      const list = (data ?? []) as Row[];
      const ids = Array.from(new Set(list.map(r => r.customer_id).filter(Boolean))) as string[];
      if (ids.length) {
        const { data: cust } = await supabase.from('customers').select('id, name').in('id', ids);
        const map = new Map((cust ?? []).map((c: any) => [c.id, c.name]));
        list.forEach(r => { r.customer_name = r.customer_id ? (map.get(r.customer_id) ?? '') : ''; });
      }
      setRows(list);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter(r => {
      if (systemFilter === 'de' && r.source_system !== 'zoho_eu_1') return false;
      if (systemFilter === 'at' && r.source_system !== 'zoho_eu_2') return false;
      if (invoiceFilter === 'invoiced' && !r.invoiced_flag) return false;
      if (invoiceFilter === 'open' && r.invoiced_flag) return false;
      if (!term) return true;
      return (
        (r.order_number ?? '').toLowerCase().includes(term) ||
        (r.customer_name ?? '').toLowerCase().includes(term) ||
        (r.salesperson_name ?? '').toLowerCase().includes(term)
      );
    });
  }, [rows, q, invoiceFilter, systemFilter]);

  const stats = useMemo(() => {
    const invoiced = filtered.filter(r => r.invoiced_flag).length;
    const open = filtered.length - invoiced;
    const openValue = filtered.filter(r => !r.invoiced_flag).reduce((s, r) => s + Number(r.total_amount || r.finance_total_amount || 0), 0);
    return { total: filtered.length, invoiced, open, openValue };
  }, [filtered]);

  const suffix = (src: string | null) => (src === 'zoho_eu_2' ? '-AT' : '');

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <PageHeader
        icon={Truck}
        title="Ausgeliefert · Faktura-Kontrolle"
        subtitle="Alle ausgelieferten Aufträge – Kontrolle, ob eine Ausgangsrechnung existiert"
        noBreadcrumbs
        meta={<InfinityStatusBadge kind={loading ? 'progress' : 'done'} label={loading ? 'Lädt' : `${filtered.length} Aufträge`} pulse={loading} />}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <DataCard>
          <div className="p-4">
            <div className="text-xs text-muted-foreground">Ausgeliefert gesamt</div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </div>
        </DataCard>
        <DataCard>
          <div className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" />Fakturiert</div>
            <div className="text-2xl font-bold text-emerald-500">{stats.invoiced}</div>
          </div>
        </DataCard>
        <DataCard>
          <div className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-amber-500" />Ohne Rechnung</div>
            <div className="text-2xl font-bold text-amber-500">{stats.open}</div>
          </div>
        </DataCard>
        <DataCard>
          <div className="p-4">
            <div className="text-xs text-muted-foreground">Offener Fakturawert</div>
            <div className="text-2xl font-bold">{eur(stats.openValue)}</div>
          </div>
        </DataCard>
      </div>

      <DataCard>
        <div className="p-3 flex flex-col md:flex-row gap-2 md:items-center border-b border-border/40">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Auftragsnr., Kunde, Verkäufer …" className="pl-8 h-9" />
          </div>
          <Select value={invoiceFilter} onValueChange={(v: any) => setInvoiceFilter(v)}>
            <SelectTrigger className="w-52 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Rechnungsstände</SelectItem>
              <SelectItem value="open">Nur ohne Rechnung</SelectItem>
              <SelectItem value="invoiced">Nur fakturiert</SelectItem>
            </SelectContent>
          </Select>
          <Select value={systemFilter} onValueChange={(v: any) => setSystemFilter(v)}>
            <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Mandanten</SelectItem>
              <SelectItem value="de">🇩🇪 Alix Deutschland</SelectItem>
              <SelectItem value="at">🇦🇹 Alix Austria</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <SkeletonTable rows={10} cols={8} />
        ) : filtered.length === 0 ? (
          <PageEmpty message="Keine ausgelieferten Aufträge im Filter." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/40 text-muted-foreground text-xs uppercase">
                <tr>
                  <th className="text-left p-3">Auftrag</th>
                  <th className="text-left p-3">Kunde</th>
                  <th className="text-left p-3">Verkäufer</th>
                  <th className="text-left p-3">Lieferdatum</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-center p-3">Rechnung</th>
                  <th className="text-right p-3">Betrag</th>
                  <th className="text-right p-3">Offen</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-b border-border/20 hover:bg-muted/30">
                    <td className="p-3 font-medium">
                      <Link to={`/orders/${r.id}`} className="text-primary hover:underline">
                        {r.order_number}{suffix(r.source_system)}
                      </Link>
                    </td>
                    <td className="p-3">{r.customer_name || '–'}</td>
                    <td className="p-3 text-xs text-muted-foreground">{r.salesperson_name || '–'}</td>
                    <td className="p-3">{dfmt(r.expected_shipment_date || r.order_date)}</td>
                    <td className="p-3">
                      <Badge variant="outline" className="capitalize">{r.order_status}</Badge>
                    </td>
                    <td className="p-3 text-center">
                      {r.invoiced_flag ? (
                        <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">Fakturiert</Badge>
                      ) : (
                        <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30">RE FEHLT</Badge>
                      )}
                    </td>
                    <td className="p-3 text-right tabular-nums">{eur(Number(r.total_amount || r.finance_total_amount || 0))}</td>
                    <td className="p-3 text-right tabular-nums text-destructive">{eur(Number(r.finance_open_amount || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataCard>
    </div>
  );
}

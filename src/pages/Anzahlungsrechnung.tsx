import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Receipt, Search, ExternalLink, RefreshCw, FileText, Wallet, Banknote, MessageSquare, Mail, Loader2, ChevronDown, Settings } from 'lucide-react';
import { EmptyState } from '@/components/infinity/EmptyState';
import { supabase } from '@/integrations/supabase/client';
import { withAt } from '@/lib/atSuffix';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { PageHeader } from '@/components/infinity/PageHeader';
import { KpiTile } from '@/components/infinity/KpiTile';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

type Stage = { id: string; name: string; days_after_due: number; enabled: boolean };

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
  const { roles } = useAuth();
  const isSuperAdmin = (roles ?? []).some((r: any) => (typeof r === 'string' ? r : r?.name) === 'Super Admin');
  const [rows, setRows] = useState<Row[]>([]);
  const [customers, setCustomers] = useState<Record<string, CustomerLite>>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<Record<string, 'sms' | 'email' | null>>({});
  const [stages, setStages] = useState<Stage[]>([]);

  const sendMahnung = async (orderId: string, channel: 'sms' | 'email', stage: Stage) => {
    if (!confirm(
      `${channel === 'sms' ? 'SMS' : 'E-Mail'}-Mahnung „${stage.name}" an den Kunden senden?`
    )) return;
    setBusy((b) => ({ ...b, [orderId]: channel }));
    try {
      const { data, error } = await supabase.functions.invoke('send-anzahlung-mahnung', {
        body: { order_id: orderId, channel, stage_id: stage.id },
      });
      if (error || (data as any)?.error) {
        throw new Error((data as any)?.error || error?.message || 'Unbekannter Fehler');
      }
      toast.success(`${channel === 'sms' ? 'SMS' : 'E-Mail'}-Mahnung „${stage.name}" gesendet`);
    } catch (e: any) {
      toast.error(e.message ?? 'Versand fehlgeschlagen');
    } finally {
      setBusy((b) => ({ ...b, [orderId]: null }));
    }
  };

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

    // 2) Exclude orders that already have a production order OR a reserved/delivered device OR a route plan
    const orderIds = (orders ?? []).map(o => o.id);
    const excluded = new Set<string>();
    if (orderIds.length) {
      const [prodRes, resRes, delRes, rpRes] = await Promise.all([
        supabase.from('production_orders').select('order_id').in('order_id', orderIds),
        supabase.from('lager_devices').select('reserved_order_id').in('reserved_order_id', orderIds),
        supabase.from('lager_devices').select('delivered_order_id').in('delivered_order_id', orderIds),
        supabase.from('route_plans').select('order_id').in('order_id', orderIds),
      ]);
      (prodRes.data ?? []).forEach((p: any) => p.order_id && excluded.add(p.order_id));
      (resRes.data ?? []).forEach((p: any) => p.reserved_order_id && excluded.add(p.reserved_order_id));
      (delRes.data ?? []).forEach((p: any) => p.delivered_order_id && excluded.add(p.delivered_order_id));
      (rpRes.data ?? []).forEach((p: any) => p.order_id && excluded.add(p.order_id));
    }
    const filtered = (orders ?? []).filter(o => !excluded.has(o.id)) as Row[];

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

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('app_settings').select('value').eq('key', 'anzahlung_mahnung_config').maybeSingle();
      if (data?.value) {
        try {
          const cfg = JSON.parse(data.value);
          const s = (cfg.stages ?? []).filter((x: Stage) => x.enabled);
          setStages(s);
        } catch { /* ignore */ }
      }
    })();
  }, []);

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
      <PageHeader
        icon={Receipt}
        title="Neue Anzahlungen"
        subtitle="Aufträge mit bestätigter Anzahlung (Status offen / open) ohne bereits ausgelöste Bestellung."
        noBreadcrumbs
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Aktualisieren
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <KpiTile label="Aufträge" value={filtered.length} icon={FileText} accent="sky" />
        <KpiTile label="Summe Anzahlungen" value={fmtMoney(totals.deposit)} icon={Wallet} accent="gold" />
        <KpiTile label="Summe Aufträge" value={fmtMoney(totals.total)} icon={Banknote} accent="emerald" />
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
            <div className="py-6"><EmptyState icon={Receipt} title="Keine Aufträge gefunden" description="Es gibt aktuell keine passenden Aufträge für die gewählten Filter." compact /></div>
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
                          <div className="flex items-center gap-1.5 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              title="SMS-Mahnung an den Kunden senden"
                              disabled={busy[r.id] === 'sms'}
                              onClick={() => sendMahnung(r.id, 'sms')}
                            >
                              {busy[r.id] === 'sms'
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <MessageSquare className="h-4 w-4" />}
                              <span className="hidden lg:inline ml-1.5">SMS&nbsp;Mahnung</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              title="E-Mail-Mahnung an den Kunden senden"
                              disabled={busy[r.id] === 'email'}
                              onClick={() => sendMahnung(r.id, 'email')}
                            >
                              {busy[r.id] === 'email'
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <Mail className="h-4 w-4" />}
                              <span className="hidden lg:inline ml-1.5">E-Mail&nbsp;Mahnung</span>
                            </Button>
                            <Button asChild size="sm" className="gold-gradient text-primary-foreground">
                              <Link to={`/auftraege/${r.id}`}>
                                <ExternalLink className="h-4 w-4 mr-1" />
                                <span className="hidden md:inline">BEARBEITUNG</span>
                              </Link>
                            </Button>
                          </div>
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

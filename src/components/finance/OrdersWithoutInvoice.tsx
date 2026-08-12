import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { ExternalLink, RefreshCw, Scale, SlidersHorizontal, Loader2 } from 'lucide-react';
import { ListToolbar } from '@/components/finance/ListToolbar';
import { matchesQuery, paginate, type PageSize } from '@/lib/finance/list-filter';
import CreateInvoiceDialog from '@/components/CreateInvoiceDialog';

const STATUS_OPTIONS = [
  'offen', 'bestätigt', 'in Bearbeitung', 'versendet', 'teilgeliefert', 'geliefert',
  'abgeschlossen', 'storniert', 'zurückgestellt', 'Hold', 'Anwalt',
];
const LAWYER_REASONS = ['Zahlungsverzug', 'Auftragserfüllung', 'Stornierung', 'Keine Anzahlung'];

const fmtMoney = (n: number | null, c?: string | null) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: c || 'EUR' }).format(Number(n ?? 0));

async function fetchAllPages<T>(build: (from: number, to: number) => any): Promise<T[]> {
  const out: T[] = [];
  const size = 1000;
  for (let page = 0; page < 30; page++) {
    const { data, error } = await build(page * size, page * size + size - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < size) break;
  }
  return out;
}

export default function OrdersWithoutInvoice() {
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [statusFilter, setStatusFilter] = useState<string>('alle');
  const [statusOrder, setStatusOrder] = useState<any | null>(null);
  const [newStatus, setNewStatus] = useState('offen');
  const [lawyerReason, setLawyerReason] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [orders, invoices] = await Promise.all([
        fetchAllPages<any>((from, to) =>
          supabase
            .from('orders')
            .select('id, order_number, internal_number, case_number, order_status, order_date, total_amount, currency, source_system, accounting_region, salesperson_name, lawyer_reason, invoiced_flag, billing_address, customer_id, customers(company_name, contact_name, email, city, billing_address)')
            .order('order_date', { ascending: false, nullsFirst: false })
            .range(from, to),
        ),
        fetchAllPages<any>((from, to) =>
          supabase.from('zoho_invoices').select('reference_number').range(from, to),
        ),
      ]);
      const invoiced = new Set(
        invoices.map((i) => String(i.reference_number ?? '').trim()).filter(Boolean),
      );
      setRows(
        orders.filter(
          (o) => !o.invoiced_flag && !invoiced.has(String(o.order_number ?? '').trim()),
        ),
      );
    } catch (e: any) {
      toast({ title: 'Fehler', description: e?.message ?? 'Laden fehlgeschlagen', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(
    () =>
      rows
        .filter((o) => statusFilter === 'alle' || o.order_status === statusFilter)
        .filter((o) =>
          matchesQuery(
            {
              ...o,
              invoice_number: o.order_number,
              reference_number: o.internal_number,
              customer_name: o.customers?.company_name || o.customers?.contact_name,
              total: o.total_amount,
            },
            search,
          ),
        ),
    [rows, search, statusFilter],
  );
  const visible = useMemo(() => paginate(filtered, pageSize), [filtered, pageSize]);
  const sum = useMemo(() => filtered.reduce((s, o) => s + Number(o.total_amount || 0), 0), [filtered]);

  const openStatus = (o: any) => {
    setStatusOrder(o);
    setNewStatus(o.order_status || 'offen');
    setLawyerReason(o.lawyer_reason || '');
  };

  const saveStatus = async (status?: string, reason?: string) => {
    if (!statusOrder) return;
    const finalStatus = status ?? newStatus;
    const finalReason = finalStatus === 'Anwalt' ? (reason ?? lawyerReason) || null : null;
    setSaving(true);
    const { error } = await supabase
      .from('orders')
      .update({ order_status: finalStatus, lawyer_reason: finalReason })
      .eq('id', statusOrder.id);
    setSaving(false);
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Status aktualisiert', description: `${statusOrder.order_number} → ${finalStatus}` });
    setRows((prev) => prev.map((r) => (r.id === statusOrder.id ? { ...r, order_status: finalStatus, lawyer_reason: finalReason } : r)));
    setStatusOrder(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          <b className="text-foreground">{filtered.length}</b> Aufträge ohne Rechnung · Volumen{' '}
          <b className="text-foreground">{fmtMoney(sum, 'EUR')}</b>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle Status</SelectItem>
              {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Aktualisieren
          </Button>
        </div>
      </div>

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        total={filtered.length}
        visible={visible.length}
      />

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Lade Aufträge…
          </div>
        ) : visible.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Alle Aufträge sind abgerechnet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Auftrag</th>
                  <th className="px-3 py-2 text-left">Datum</th>
                  <th className="px-3 py-2 text-left">Kunde</th>
                  <th className="px-3 py-2 text-left">Verkäufer</th>
                  <th className="px-3 py-2 text-right">Betrag</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((o) => (
                  <tr key={o.id} className="border-t border-border/50 hover:bg-muted/20">
                    <td className="px-3 py-2 font-mono">
                      <Link to={`/orders/${o.id}`} className="text-primary hover:underline inline-flex items-center gap-1">
                        {o.order_number || '–'} <ExternalLink className="w-3 h-3" />
                      </Link>
                      {o.internal_number && <div className="text-[11px] text-muted-foreground">{o.internal_number}</div>}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {o.order_date ? new Date(o.order_date).toLocaleDateString('de-DE') : '–'}
                    </td>
                    <td className="px-3 py-2">
                      <div>{o.customers?.company_name || o.customers?.contact_name || '–'}</div>
                      {(o.customers?.billing_address as any)?.city && (
                        <div className="text-xs text-muted-foreground">{(o.customers.billing_address as any).city}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{o.salesperson_name || '–'}</td>
                    <td className="px-3 py-2 text-right font-semibold">{fmtMoney(o.total_amount, o.currency)}</td>
                    <td className="px-3 py-2">
                      <Badge variant={o.order_status === 'Anwalt' ? 'destructive' : 'secondary'}>
                        {o.order_status || 'offen'}
                      </Badge>
                      {o.lawyer_reason && <div className="text-[11px] text-muted-foreground mt-1">{o.lawyer_reason}</div>}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1 justify-end items-center">
                        <CreateInvoiceDialog order={o} customer={o.customers} />
                        <Button size="sm" variant="outline" onClick={() => openStatus(o)}>
                          <SlidersHorizontal className="w-3 h-3 mr-1" /> STATUS
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={!!statusOrder} onOpenChange={(v) => !v && setStatusOrder(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Status ändern · {statusOrder?.order_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Auftragsstatus</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {newStatus === 'Anwalt' && (
              <div>
                <Label className="text-xs text-muted-foreground">Anwalt-Grund</Label>
                <Select value={lawyerReason} onValueChange={setLawyerReason}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Grund auswählen…" /></SelectTrigger>
                  <SelectContent>
                    {LAWYER_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button
              variant="outline"
              className="w-full border-rose-500/40 text-rose-300"
              disabled={saving}
              onClick={() => { setNewStatus('Anwalt'); saveStatus('Anwalt', lawyerReason || 'Zahlungsverzug'); }}
            >
              <Scale className="w-4 h-4 mr-2" /> Direkt zum Anwalt übergeben
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setStatusOrder(null)}>Abbrechen</Button>
            <Button onClick={() => saveStatus()} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

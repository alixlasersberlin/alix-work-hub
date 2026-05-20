import { useEffect, useMemo, useState } from 'react';
import { FileSignature, Search, Loader2, Inbox, Eye, X, User, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StatusBadge } from '@/components/StatusBadge';
import { supabase } from '@/integrations/supabase/client';
import BankFinancingTab from '@/components/BankFinancingTab';

type AvailableOrder = {
  id: string;
  order_number: string | null;
  order_date: string | null;
  total_amount: number | null;
  currency: string | null;
  order_status: string | null;
  customers?: { company_name: string | null; contact_name: string | null } | null;
};

type FullCustomer = {
  id: string;
  company_name: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  billing_address: any | null;
  shipping_address: any | null;
  iban: string | null;
  bic: string | null;
  bank_name: string | null;
};

type OrderItem = {
  id: string;
  item_name: string | null;
  description: string | null;
  sku: string | null;
  quantity: number | null;
  unit: string | null;
  rate: number | null;
  amount: number | null;
};

function formatAddress(addr: any): string {
  if (!addr || typeof addr !== 'object') return '—';
  const parts = [
    addr.street || addr.address,
    [addr.zip || addr.postal_code, addr.city].filter(Boolean).join(' '),
    addr.country,
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : '—';
}

export default function FinanzierungBeantragen() {
  const [showOrderDialog, setShowOrderDialog] = useState(false);
  const [orders, setOrders] = useState<AvailableOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<AvailableOrder | null>(null);

  const [detailLoading, setDetailLoading] = useState(false);
  const [customer, setCustomer] = useState<FullCustomer | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [orderFull, setOrderFull] = useState<any>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error: err } = await supabase
        .from('orders')
        .select('id, order_number, order_date, total_amount, currency, order_status, customers(company_name, contact_name)')
        .in('order_status', ['open', 'hold', 'Hold', 'HOLD', 'on_hold', 'On Hold', 'overdue', 'Overdue', 'überfällig', 'Überfällig'])
        .order('order_date', { ascending: false, nullsFirst: false })
        .limit(1000);
      if (err) setError(err.message);
      setOrders((data ?? []) as any);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!selected) {
      setCustomer(null);
      setItems([]);
      setOrderFull(null);
      return;
    }
    (async () => {
      setDetailLoading(true);
      const [{ data: ord }, { data: its }] = await Promise.all([
        supabase
          .from('orders')
          .select('id, order_number, order_date, total_amount, currency, order_status, billing_address, shipping_address, salesperson_name, customer_id, customers(*)')
          .eq('id', selected.id)
          .maybeSingle(),
        supabase
          .from('order_items')
          .select('id, item_name, description, sku, quantity, unit, rate, amount')
          .eq('order_id', selected.id)
          .order('item_order', { ascending: true }),
      ]);
      setOrderFull(ord);
      setCustomer((ord?.customers ?? null) as FullCustomer | null);
      setItems((its ?? []) as OrderItem[]);
      setDetailLoading(false);
    })();
  }, [selected]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [] as AvailableOrder[];
    return orders.filter((o) => {
      const name = o.customers?.company_name || o.customers?.contact_name || '';
      return (
        (o.order_number || '').toLowerCase().includes(q) ||
        name.toLowerCase().includes(q)
      );
    }).slice(0, 50);
  }, [orders, search]);

  const fmtMoney = (v: number | null | undefined, c?: string | null) =>
    v == null ? '—' : new Intl.NumberFormat('de-DE', { style: 'currency', currency: c || 'EUR' }).format(Number(v));
  const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('de-DE') : '—');

  const itemsTotal = useMemo(
    () => items.reduce((s, i) => s + Number(i.amount ?? 0), 0),
    [items]
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <FileSignature className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Finanzierung beantragen</h1>
          <p className="text-muted-foreground text-sm">
            Wähle einen Auftrag aus den verfügbaren Aufträgen, um eine Finanzierung zu beantragen.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Auftrag suchen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Auftragsnummer oder Kunde suchen…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelected(null);
              }}
              className="pl-8"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-destructive text-sm py-6 text-center">{error}</div>
          ) : selected ? null : search.trim() === '' ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Search className="h-7 w-7 mb-2" />
              <p className="text-sm">Beginne zu tippen, um einen Auftrag zu finden.</p>
              <p className="text-xs mt-1">{orders.length} verfügbare Aufträge im Bestand.</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Inbox className="h-7 w-7 mb-2" />
              <p className="text-sm">Keine passenden Aufträge gefunden.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Auftragsnr.</TableHead>
                    <TableHead>Kunde</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead className="text-right">Betrag</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[120px] text-right">Aktion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((o) => (
                    <TableRow key={o.id} className="cursor-pointer" onClick={() => setSelected(o)}>
                      <TableCell className="font-medium">{o.order_number || '—'}</TableCell>
                      <TableCell>{o.customers?.company_name || o.customers?.contact_name || '—'}</TableCell>
                      <TableCell>{fmtDate(o.order_date)}</TableCell>
                      <TableCell className="text-right">{fmtMoney(o.total_amount, o.currency)}</TableCell>
                      <TableCell><StatusBadge status={o.order_status} /></TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); setSelected(o); }}>
                          Auswählen
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {selected && (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Ausgewählter Auftrag</CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowOrderDialog(true)}>
                  <Eye className="h-4 w-4 mr-1" /> Auftrag öffnen
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                  <X className="h-4 w-4 mr-1" /> Zurücksetzen
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Auftragsnr.</p>
                  <p className="font-medium">{selected.order_number || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Datum</p>
                  <p className="font-medium">{fmtDate(selected.order_date)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Betrag</p>
                  <p className="font-medium">{fmtMoney(selected.total_amount, selected.currency)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <StatusBadge status={selected.order_status} />
                </div>
              </div>
            </CardContent>
          </Card>

          {detailLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" /> Kundendaten
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!customer ? (
                    <p className="text-sm text-muted-foreground">Keine Kundendaten verfügbar.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Firma</p>
                        <p className="font-medium">{customer.company_name || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Ansprechpartner</p>
                        <p className="font-medium">{customer.contact_name || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">E-Mail</p>
                        <p className="font-medium break-all">{customer.email || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Telefon</p>
                        <p className="font-medium">{customer.phone || '—'}</p>
                      </div>
                      <div className="md:col-span-2">
                        <p className="text-xs text-muted-foreground">Rechnungsadresse</p>
                        <p className="font-medium">{formatAddress(orderFull?.billing_address || customer.billing_address)}</p>
                      </div>
                      <div className="md:col-span-2">
                        <p className="text-xs text-muted-foreground">Lieferadresse</p>
                        <p className="font-medium">{formatAddress(orderFull?.shipping_address || customer.shipping_address)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Bank</p>
                        <p className="font-medium">{customer.bank_name || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">IBAN / BIC</p>
                        <p className="font-medium">{customer.iban || '—'} {customer.bic ? `· ${customer.bic}` : ''}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" /> Artikel ({items.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Keine Artikel im Auftrag.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-md border border-border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Artikel</TableHead>
                            <TableHead>SKU</TableHead>
                            <TableHead className="text-right">Menge</TableHead>
                            <TableHead className="text-right">Einzelpreis</TableHead>
                            <TableHead className="text-right">Summe</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map((it) => (
                            <TableRow key={it.id}>
                              <TableCell>
                                <div className="font-medium">{it.item_name || '—'}</div>
                                {it.description && (
                                  <div className="text-xs text-muted-foreground line-clamp-2">{it.description}</div>
                                )}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">{it.sku || '—'}</TableCell>
                              <TableCell className="text-right">
                                {it.quantity ?? '—'}{it.unit ? ` ${it.unit}` : ''}
                              </TableCell>
                              <TableCell className="text-right">{fmtMoney(it.rate, selected.currency)}</TableCell>
                              <TableCell className="text-right font-medium">{fmtMoney(it.amount, selected.currency)}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow>
                            <TableCell colSpan={4} className="text-right font-semibold">Zwischensumme Artikel</TableCell>
                            <TableCell className="text-right font-semibold">{fmtMoney(itemsTotal, selected.currency)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell colSpan={4} className="text-right text-muted-foreground">Auftragssumme</TableCell>
                            <TableCell className="text-right font-semibold">{fmtMoney(selected.total_amount, selected.currency)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <BankFinancingTab orderId={selected.id} />
            </>
          )}
        </>
      )}

      <Dialog open={showOrderDialog} onOpenChange={setShowOrderDialog}>
        <DialogContent className="max-w-6xl w-[95vw] h-[90vh] p-0 flex flex-col overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b border-border">
            <DialogTitle>
              Auftrag {selected?.order_number || ''}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {selected && (
              <iframe
                src={`/auftraege/${selected.id}`}
                title="Auftrag Details"
                className="w-full h-full border-0"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileSignature, Search, Loader2, Inbox, Eye, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/StatusBadge';
import { supabase } from '@/integrations/supabase/client';

type AvailableOrder = {
  id: string;
  order_number: string | null;
  order_date: string | null;
  total_amount: number | null;
  currency: string | null;
  order_status: string | null;
  customers?: { company_name: string | null; contact_name: string | null } | null;
};

export default function FinanzierungBeantragen() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<AvailableOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<AvailableOrder | null>(null);

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

  const fmtMoney = (v: number | null, c?: string | null) =>
    v == null ? '—' : new Intl.NumberFormat('de-DE', { style: 'currency', currency: c || 'EUR' }).format(Number(v));
  const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('de-DE') : '—');

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
                    <TableRow
                      key={o.id}
                      className="cursor-pointer"
                      onClick={() => setSelected(o)}
                    >
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Ausgewählter Auftrag</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
              <X className="h-4 w-4 mr-1" /> Auswahl zurücksetzen
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Auftragsnr.</p>
                <p className="font-medium">{selected.order_number || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Kunde</p>
                <p className="font-medium">{selected.customers?.company_name || selected.customers?.contact_name || '—'}</p>
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

            <div className="flex flex-wrap gap-2 pt-2">
              <Button variant="outline" onClick={() => navigate(`/auftraege/${selected.id}`)}>
                <Eye className="h-4 w-4 mr-1" /> Auftrag öffnen
              </Button>
              <Button disabled>
                Finanzierungsanfrage erstellen (in Vorbereitung)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Ban, Loader2, RefreshCw } from 'lucide-react';

type Row = {
  id: string;
  invoice_number: string | null;
  reference_number: string | null;
  customer_name: string | null;
  invoice_date: string | null;
  total: number | null;
  currency: string | null;
  status: string | null;
  payment_status: string | null;
  raw_data: any;
};

const money = (v: number | null | undefined, c = 'EUR') =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: c || 'EUR' }).format(Number(v ?? 0));

export default function FinanceStornos() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('zoho_invoices')
      .select('id, invoice_number, reference_number, customer_name, invoice_date, total, currency, status, payment_status, raw_data')
      .or('status.eq.void,status.eq.storniert,payment_status.eq.Storniert')
      .order('invoice_date', { ascending: false })
      .limit(2000);
    setRows((data ?? []) as unknown as Row[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      const d = String(r.invoice_date ?? '').slice(0, 10);
      if (from && d && d < from) return false;
      if (to && d && d > to) return false;
      if (!needle) return true;
      return [r.invoice_number, r.reference_number, r.customer_name]
        .some((v) => String(v ?? '').toLowerCase().includes(needle));
    });
  }, [rows, q, from, to]);

  const sum = filtered.reduce((s, r) => s + Number(r.raw_data?.storno_amount ?? r.total ?? 0), 0);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="Stornos"
        subtitle="Alle stornierten Rechnungen – offener Betrag wurde ausgebucht"
        icon={Ban}
        actions={
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="mr-2 h-4 w-4" /> Aktualisieren
          </Button>
        }
      />

      <Card className="p-4 space-y-4">
        <div className="grid gap-2 md:grid-cols-4">
          <Input placeholder="Rechnungsnr., Auftragsnr., Kunde …" value={q} onChange={(e) => setQ(e.target.value)} />
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Von" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Bis" />
          <div className="flex items-center justify-end text-sm">
            <span className="text-muted-foreground mr-2">Storno-Volumen:</span>
            <span className="font-semibold">{money(sum)}</span>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-muted-foreground">Keine stornierten Rechnungen gefunden.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rechnung</TableHead>
                  <TableHead>Auftrag</TableHead>
                  <TableHead>Kunde</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead className="text-right">Betrag</TableHead>
                  <TableHead className="text-right">Ausgebucht</TableHead>
                  <TableHead>Storniert am</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.invoice_number ?? '–'}</TableCell>
                    <TableCell className="font-mono text-xs">{r.reference_number ?? '–'}</TableCell>
                    <TableCell className="text-sm">{r.customer_name ?? '–'}</TableCell>
                    <TableCell className="text-xs">{r.invoice_date ? new Date(r.invoice_date).toLocaleDateString('de-DE') : '–'}</TableCell>
                    <TableCell className="text-right text-sm">{money(r.total, r.currency ?? 'EUR')}</TableCell>
                    <TableCell className="text-right text-sm">
                      {r.raw_data?.storno_amount != null ? money(Number(r.raw_data.storno_amount), r.currency ?? 'EUR') : '–'}
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.raw_data?.storno_at ? new Date(r.raw_data.storno_at).toLocaleDateString('de-DE') : '–'}
                    </TableCell>
                    <TableCell><Badge variant="destructive">Storniert</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}

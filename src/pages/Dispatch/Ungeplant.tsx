import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PackageSearch, Search, CalendarPlus, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreateAppointmentDialog, AppointmentOrderSeed } from '@/components/dispatch/CreateAppointmentDialog';
import { READINESS_LABELS, readinessClass } from './constants';

const PAGE_SIZE = 25;
const EXCLUDED_STATUS = ['void', 'cancelled', 'canceled', 'storniert', 'draft'];

function addr(o: any) {
  const a = o.shipping_address || o.billing_address || {};
  return {
    street: a.address ?? a.street ?? null,
    zip: a.zip ?? a.zip_code ?? a.postal_code ?? null,
    city: a.city ?? null,
    country: a.country ?? null,
    phone: a.phone ?? null,
  };
}

export default function DispatchUngeplant() {
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState('alle');
  const [page, setPage] = useState(0);
  const [seed, setSeed] = useState<AppointmentOrderSeed | null>(null);
  const [checks, setChecks] = useState<Record<string, { readiness: string; issues: { label: string; level: string }[] }>>({});
  const [checking, setChecking] = useState(false);

  const { data: plannedIds } = useQuery({
    queryKey: ['dispatch', 'planned-order-ids'],
    queryFn: async () => {
      const { data, error } = await supabase.from('delivery_appointments').select('order_id').limit(5000);
      if (error) throw error;
      return new Set((data ?? []).map(r => r.order_id).filter(Boolean) as string[]);
    },
    staleTime: 30_000,
  });

  const { data, isPending, refetch } = useQuery({
    queryKey: ['dispatch', 'unplanned-orders', region, page],
    queryFn: async () => {
      let q = supabase
        .from('orders')
        .select('id, customer_id, order_number, order_status, order_date, expected_shipment_date, salesperson_name, is_vip, shipping_address, billing_address, source_system, finance_open_amount, deposit_ok, customers(company_name, contact_name, email, phone)')
        .not('order_status', 'in', `(${EXCLUDED_STATUS.join(',')})`)
        .order('order_date', { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (region !== 'alle') q = q.eq('source_system', region);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

  const term = search.trim().toLowerCase();
  const rows = useMemo(() => (data ?? [])
    .filter(o => !plannedIds?.has(o.id))
    .filter(o => {
      if (!term) return true;
      const c: any = o.customers;
      return [o.order_number, c?.company_name, c?.contact_name, addr(o).city, addr(o).zip]
        .some(v => (v ?? '').toString().toLowerCase().includes(term));
    }), [data, plannedIds, term]);

  async function checkAll() {
    setChecking(true);
    try {
      const results = await Promise.all(rows.map(async o => {
        const { data } = await supabase.rpc('check_delivery_readiness', { _order_id: o.id });
        return [o.id, data as any] as const;
      }));
      setChecks(prev => ({ ...prev, ...Object.fromEntries(results) }));
    } finally {
      setChecking(false);
    }
  }

  function openDialog(o: any) {
    const a = addr(o);
    const c: any = o.customers;
    setSeed({
      order_id: o.id,
      customer_id: o.customer_id,
      order_number: o.order_number,
      customer_name: c?.contact_name ?? null,
      company_name: c?.company_name ?? null,
      contact_phone: a.phone ?? c?.phone ?? null,
      contact_email: c?.email ?? null,
      delivery_street: a.street,
      delivery_zip: a.zip,
      delivery_city: a.city,
      delivery_country: a.country,
      salesperson_name: o.salesperson_name,
      is_vip: o.is_vip,
    });
  }

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <PageHeader
        title="Ungeplante Auslieferungen"
        subtitle="Aufträge ohne Liefertermin – mit automatischer Lieferbereitschafts-Prüfung"
        icon={PackageSearch}
        actions={
          <Button variant="outline" onClick={checkAll} disabled={checking || rows.length === 0}>
            <RefreshCw className={`h-4 w-4 mr-2 ${checking ? 'animate-spin' : ''}`} /> Ampel prüfen
          </Button>
        }
      />

      <Card className="p-4 mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Auftrag, Kunde, Ort, PLZ…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={region} onValueChange={v => { setRegion(v); setPage(0); }}>
          <SelectTrigger className="md:w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle Mandanten</SelectItem>
            <SelectItem value="zoho_eu_1">🇩🇪 Alix Deutschland</SelectItem>
            <SelectItem value="zoho_eu_2">🇦🇹 Alix Austria</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Auftrag</TableHead>
              <TableHead>Kunde</TableHead>
              <TableHead>Lieferort</TableHead>
              <TableHead>Auftragsdatum</TableHead>
              <TableHead>Ampel</TableHead>
              <TableHead className="text-right">Aktion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Lädt…</TableCell></TableRow>}
            {!isPending && rows.length === 0 && (
              <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Keine ungeplanten Aufträge auf dieser Seite.</TableCell></TableRow>
            )}
            {rows.map(o => {
              const a = addr(o);
              const c: any = o.customers;
              const chk = checks[o.id];
              return (
                <TableRow key={o.id}>
                  <TableCell className="font-medium whitespace-nowrap">
                    {o.is_vip && <span className="mr-1">👑</span>}
                    {o.order_number ?? '—'}
                    {o.source_system === 'zoho_eu_2' && <span className="text-muted-foreground">-AT</span>}
                  </TableCell>
                  <TableCell>{c?.company_name || c?.contact_name || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{[a.zip, a.city].filter(Boolean).join(' ') || '—'}</TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {o.order_date ? format(new Date(o.order_date), 'dd.MM.yyyy') : '—'}
                  </TableCell>
                  <TableCell>
                    {chk ? (
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${readinessClass(chk.readiness)}`} title={(chk.issues ?? []).map(i => i.label).join('\n')}>
                        {READINESS_LABELS[chk.readiness] ?? chk.readiness}
                        {chk.issues?.length ? ` · ${chk.issues.length}` : ''}
                      </span>
                    ) : <span className="text-xs text-muted-foreground">nicht geprüft</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" onClick={() => openDialog(o)}>
                      <CalendarPlus className="h-4 w-4 mr-2" /> Liefertermin
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <div className="flex items-center justify-between mt-4">
        <span className="text-sm text-muted-foreground">Seite {page + 1}</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>Zurück</Button>
          <Button variant="outline" size="sm" disabled={(data?.length ?? 0) < PAGE_SIZE} onClick={() => setPage(p => p + 1)}>Weiter</Button>
        </div>
      </div>

      <CreateAppointmentDialog
        open={!!seed}
        onOpenChange={v => { if (!v) setSeed(null); }}
        seed={seed}
        onCreated={() => refetch()}
      />
    </div>
  );
}

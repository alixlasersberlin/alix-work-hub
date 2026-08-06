import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Euro, Plus, FileDown, Loader2, Trash2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { toast } from 'sonner';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { exportCsv, exportXlsx, costPdf } from '@/lib/dispatch/exports';

const COST_TYPES: Record<string, string> = {
  km_pauschale: 'km-Pauschale',
  kraftstoff: 'Kraftstoff',
  maut: 'Maut',
  parken: 'Parken',
  spesen: 'Spesen',
  uebernachtung: 'Übernachtung',
  arbeitszeit: 'Arbeitszeit',
  fremdleistung: 'Fremdleistung',
  sonstiges: 'Sonstiges',
};

export default function DispatchKosten() {
  const qc = useQueryClient();
  const [from, setFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ tour_id: '', cost_type: 'km_pauschale', amount: '', quantity: '', unit: '', cost_center: '', note: '' });

  const { data: tours } = useQuery({
    queryKey: ['dispatch', 'cost-tours', from, to],
    queryFn: async () => {
      const { data, error } = await supabase.from('delivery_tours')
        .select('id, tour_number, tour_date').gte('tour_date', from).lte('tour_date', to).order('tour_date', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: costs, isPending } = useQuery({
    queryKey: ['dispatch', 'costs', from, to],
    queryFn: async () => {
      const { data, error } = await supabase.from('delivery_costs')
        .select('*, delivery_tours:tour_id(tour_number, tour_date)')
        .order('created_at', { ascending: false }).limit(1000);
      if (error) throw error;
      return (data ?? []).filter((c: any) => {
        const d = c.delivery_tours?.tour_date ?? String(c.created_at).slice(0, 10);
        return d >= from && d <= to;
      });
    },
  });

  const { data: mileage } = useQuery({
    queryKey: ['dispatch', 'mileage', from, to],
    queryFn: async () => {
      const { data, error } = await supabase.from('mileage_logs')
        .select('id, log_date, planned_km, actual_km, delivery_tours:tour_id(tour_number), vehicles:vehicle_id(license_plate)')
        .gte('log_date', from).lte('log_date', to).order('log_date', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from('delivery_costs').insert({
        tour_id: form.tour_id || null,
        cost_type: form.cost_type,
        amount: Number(form.amount || 0),
        quantity: form.quantity ? Number(form.quantity) : null,
        unit: form.unit || null,
        cost_center: form.cost_center || null,
        note: form.note || null,
        created_by: u.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Kosten erfasst');
      setOpen(false);
      setForm({ tour_id: '', cost_type: 'km_pauschale', amount: '', quantity: '', unit: '', cost_center: '', note: '' });
      qc.invalidateQueries({ queryKey: ['dispatch', 'costs'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('delivery_costs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Position gelöscht'); qc.invalidateQueries({ queryKey: ['dispatch', 'costs'] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const total = useMemo(() => (costs ?? []).reduce((s: number, c: any) => s + Number(c.amount || 0), 0), [costs]);
  const byType = useMemo(() => {
    const m: Record<string, number> = {};
    (costs ?? []).forEach((c: any) => { m[c.cost_type] = (m[c.cost_type] ?? 0) + Number(c.amount || 0); });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [costs]);
  const kmTotal = useMemo(() => (mileage ?? []).reduce((s: number, m: any) => s + Number(m.actual_km ?? m.planned_km ?? 0), 0), [mileage]);

  const rows = () => (costs ?? []).map((c: any) => ({
    datum: c.delivery_tours?.tour_date ?? String(c.created_at).slice(0, 10),
    tour: c.delivery_tours?.tour_number ?? '—',
    kostenart: COST_TYPES[c.cost_type] ?? c.cost_type,
    kostenstelle: c.cost_center ?? '',
    menge: c.quantity ? `${c.quantity} ${c.unit ?? ''}` : '',
    betrag: Number(c.amount || 0),
  }));

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <PageHeader
        title="Kosten & Kilometer"
        subtitle="Kostenerfassung je Tour, Auftrag und Kostenstelle"
        icon={Euro}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-[150px]" />
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-[150px]" />
            <Button variant="outline" size="sm" onClick={() => costPdf(rows(), from, to, total)}><FileDown className="h-4 w-4 mr-1" />PDF</Button>
            <Button variant="outline" size="sm" onClick={() => exportXlsx(rows(), `Kosten_${from}_${to}`, 'Kosten')}><FileDown className="h-4 w-4 mr-1" />Excel</Button>
            <Button variant="outline" size="sm" onClick={() => exportCsv(rows(), `Kosten_${from}_${to}`)}><FileDown className="h-4 w-4 mr-1" />CSV</Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Kosten erfassen</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Kostenposition erfassen</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Tour</Label>
                    <Select value={form.tour_id} onValueChange={v => setForm({ ...form, tour_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Tour wählen (optional)" /></SelectTrigger>
                      <SelectContent>
                        {(tours ?? []).map((t: any) => (
                          <SelectItem key={t.id} value={t.id}>{t.tour_number} · {format(new Date(t.tour_date), 'dd.MM.yyyy')}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Kostenart</Label>
                      <Select value={form.cost_type} onValueChange={v => setForm({ ...form, cost_type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(COST_TYPES).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Betrag (€)</Label>
                      <Input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
                    </div>
                    <div>
                      <Label>Menge</Label>
                      <Input type="number" step="0.01" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} />
                    </div>
                    <div>
                      <Label>Einheit</Label>
                      <Input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="km, Std., Stk." />
                    </div>
                  </div>
                  <div>
                    <Label>Kostenstelle</Label>
                    <Input value={form.cost_center} onChange={e => setForm({ ...form, cost_center: e.target.value })} />
                  </div>
                  <div>
                    <Label>Notiz</Label>
                    <Textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} rows={2} />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => add.mutate()} disabled={add.isPending || !form.amount}>
                    {add.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Speichern
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-4">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Kosten gesamt</div><div className="text-2xl font-semibold">{total.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Kilometer im Zeitraum</div><div className="text-2xl font-semibold">{kmTotal.toLocaleString('de-DE')} km</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Kosten je km</div><div className="text-2xl font-semibold">{kmTotal ? (total / kmTotal).toFixed(2) : '0.00'} €</div></Card>
      </div>

      {byType.length > 0 && (
        <Card className="p-4 mb-4">
          <div className="text-sm font-semibold mb-2">Verteilung nach Kostenart</div>
          <div className="space-y-2">
            {byType.map(([k, v]) => (
              <div key={k}>
                <div className="flex justify-between text-xs mb-1"><span>{COST_TYPES[k] ?? k}</span><span>{v.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</span></div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${total ? (v / total) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Datum</TableHead>
              <TableHead>Tour</TableHead>
              <TableHead>Kostenart</TableHead>
              <TableHead>Kostenstelle</TableHead>
              <TableHead>Menge</TableHead>
              <TableHead className="text-right">Betrag</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Lädt…</TableCell></TableRow>}
            {!isPending && (costs ?? []).length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Keine Kosten im Zeitraum erfasst.</TableCell></TableRow>
            )}
            {(costs ?? []).map((c: any) => (
              <TableRow key={c.id}>
                <TableCell>{c.delivery_tours?.tour_date ? format(new Date(c.delivery_tours.tour_date), 'dd.MM.yyyy') : format(new Date(c.created_at), 'dd.MM.yyyy')}</TableCell>
                <TableCell>{c.delivery_tours?.tour_number ?? '—'}</TableCell>
                <TableCell>{COST_TYPES[c.cost_type] ?? c.cost_type}</TableCell>
                <TableCell>{c.cost_center ?? '—'}</TableCell>
                <TableCell>{c.quantity ? `${c.quantity} ${c.unit ?? ''}` : '—'}</TableCell>
                <TableCell className="text-right font-medium">{Number(c.amount || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => del.mutate(c.id)}><Trash2 className="h-4 w-4 text-rose-400" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

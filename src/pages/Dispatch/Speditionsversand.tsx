import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Ship, Plus, Loader2, Search, FileDown, Mail, Send } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { downloadCarrierOrderPdf } from '@/lib/dispatch/carrier-order-pdf';

const STATUSES: Record<string, string> = {
  angefragt: 'Angefragt',
  beauftragt: 'Beauftragt',
  abholung_geplant: 'Abholung geplant',
  abgeholt: 'Abgeholt',
  unterwegs: 'Unterwegs',
  zugestellt: 'Zugestellt',
  storniert: 'Storniert',
};

function statusClass(s?: string | null) {
  if (s === 'zugestellt') return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  if (s === 'storniert') return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
  if (s === 'unterwegs' || s === 'abgeholt') return 'bg-sky-500/15 text-sky-400 border-sky-500/30';
  return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
}

const EMPTY = {
  carrier_id: '',
  appointment_id: '',
  status: 'angefragt',
  assigned_date: '',
  agreed_price: '',
  currency: 'EUR',
  tracking_number: '',
  notes: '',
};

export default function DispatchSpeditionsversand() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('alle');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });

  const { data: rows, isPending } = useQuery({
    queryKey: ['dispatch', 'carrier-assignments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_carrier_assignments')
        .select('*, carrier:carrier_id(name, contact_name, street, zip, city, country, phone, email), appointment:appointment_id(order_number, customer_name, company_name, device_name, serial_number, contact_name, contact_phone, contact_email, planned_date, delivery_street, delivery_zip, delivery_city, delivery_country)')
        .order('created_at', { ascending: false })
        .limit(300);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

  const { data: carriers } = useQuery({
    queryKey: ['dispatch', 'carriers', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_carriers')
        .select('id, name, is_active')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });

  const { data: appointments } = useQuery({
    queryKey: ['dispatch', 'appointments', 'for-carrier'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_appointments')
        .select('id, order_number, customer_name, company_name, device_name, delivery_zip, delivery_city, planned_date')
        .order('created_at', { ascending: false })
        .limit(300);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (rows ?? []).filter((r: any) => {
      if (statusFilter !== 'alle' && r.status !== statusFilter) return false;
      if (!s) return true;
      return [r.tracking_number, r.carrier?.name, r.appointment?.order_number, r.appointment?.customer_name, r.appointment?.company_name, r.appointment?.serial_number]
        .some(v => String(v ?? '').toLowerCase().includes(s));
    });
  }, [rows, search, statusFilter]);

  const create = useMutation({
    mutationFn: async () => {
      if (!form.carrier_id) throw new Error('Bitte Spedition wählen');
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from('delivery_carrier_assignments').insert({
        carrier_id: form.carrier_id,
        appointment_id: form.appointment_id || null,
        status: form.status,
        assigned_date: form.assigned_date || null,
        agreed_price: form.agreed_price ? Number(form.agreed_price) : null,
        currency: form.currency || 'EUR',
        tracking_number: form.tracking_number || null,
        notes: form.notes || null,
        created_by: u.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Speditionsversand angelegt');
      setOpen(false);
      setForm({ ...EMPTY });
      qc.invalidateQueries({ queryKey: ['dispatch', 'carrier-assignments'] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Speichern fehlgeschlagen'),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: { status?: string; tracking_number?: string | null } }) => {
      const { error } = await supabase.from('delivery_carrier_assignments').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dispatch', 'carrier-assignments'] }),
    onError: (e: any) => toast.error(e.message ?? 'Aktualisierung fehlgeschlagen'),
  });

  const [sending, setSending] = useState<string | null>(null);
  async function sendMail(row: any, mode: 'carrier' | 'customer') {
    setSending(`${row.id}:${mode}`);
    try {
      const { data, error } = await supabase.functions.invoke('carrier-shipment-send', {
        body: { assignment_id: row.id, mode },
      });
      if (error) throw new Error((data as any)?.error ?? error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(mode === 'carrier' ? `Frachtauftrag an ${(data as any)?.recipient} gesendet` : `Versandavis an ${(data as any)?.recipient} gesendet`);
    } catch (e: any) {
      toast.error(e.message ?? 'Versand fehlgeschlagen');
    } finally {
      setSending(null);
    }
  }

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <PageHeader
        title="Speditionsversand"
        subtitle="Geräte per Spedition abholen lassen und an den Kunden versenden"
        icon={Ship}
        actions={
          <Button onClick={() => setOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Neuer Speditionsversand
          </Button>
        }
      />

      <Card className="p-4 mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Suche nach Auftrag, Kunde, Spedition, Sendungsnummer…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="alle">Alle Status</option>
          {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Auftrag</TableHead>
              <TableHead>Kunde</TableHead>
              <TableHead>Gerät</TableHead>
              <TableHead>Lieferadresse</TableHead>
              <TableHead>Spedition</TableHead>
              <TableHead>Abholung</TableHead>
              <TableHead>Sendungsnr.</TableHead>
              <TableHead>Preis</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending && <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Lädt…</TableCell></TableRow>}
            {!isPending && filtered.length === 0 && (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Noch kein Speditionsversand erfasst.</TableCell></TableRow>
            )}
            {filtered.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.appointment?.order_number ?? '—'}</TableCell>
                <TableCell>{r.appointment?.company_name || r.appointment?.customer_name || '—'}</TableCell>
                <TableCell>{[r.appointment?.device_name, r.appointment?.serial_number].filter(Boolean).join(' · ') || '—'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {[r.appointment?.delivery_street, [r.appointment?.delivery_zip, r.appointment?.delivery_city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || '—'}
                </TableCell>
                <TableCell>{r.carrier?.name ?? '—'}</TableCell>
                <TableCell>{r.assigned_date ? format(new Date(r.assigned_date), 'dd.MM.yyyy') : '—'}</TableCell>
                <TableCell>
                  <Input
                    className="h-8 w-40"
                    defaultValue={r.tracking_number ?? ''}
                    placeholder="—"
                    onBlur={e => {
                      const v = e.target.value.trim();
                      if (v !== (r.tracking_number ?? '')) update.mutate({ id: r.id, patch: { tracking_number: v || null } });
                    }}
                  />
                </TableCell>
                <TableCell>{r.agreed_price != null ? `${Number(r.agreed_price).toFixed(2)} ${r.currency ?? 'EUR'}` : '—'}</TableCell>
                <TableCell>
                  <select
                    className={`rounded-full border px-2 py-1 text-xs bg-transparent ${statusClass(r.status)}`}
                    value={r.status ?? 'angefragt'}
                    onChange={e => update.mutate({ id: r.id, patch: { status: e.target.value } })}
                  >
                    {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k} className="bg-background text-foreground">{v}</option>)}
                  </select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Neuer Speditionsversand</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Auftrag / Liefertermin</Label>
              <select
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.appointment_id}
                onChange={e => setForm(f => ({ ...f, appointment_id: e.target.value }))}
              >
                <option value="">— ohne Auftragsbezug —</option>
                {(appointments ?? []).map((a: any) => (
                  <option key={a.id} value={a.id}>
                    {[a.order_number, a.company_name || a.customer_name, a.device_name, [a.delivery_zip, a.delivery_city].filter(Boolean).join(' ')].filter(Boolean).join(' · ')}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <Label>Spedition *</Label>
              <select
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.carrier_id}
                onChange={e => setForm(f => ({ ...f, carrier_id: e.target.value }))}
              >
                <option value="">Spedition wählen…</option>
                {(carriers ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {(carriers ?? []).length === 0 && (
                <p className="mt-1 text-xs text-muted-foreground">Keine aktive Spedition vorhanden – bitte zuerst unter „Spediteure“ anlegen.</p>
              )}
            </div>
            <div>
              <Label>Abholdatum</Label>
              <Input type="date" value={form.assigned_date} onChange={e => setForm(f => ({ ...f, assigned_date: e.target.value }))} />
            </div>
            <div>
              <Label>Status</Label>
              <select
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              >
                {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <Label>Vereinbarter Preis</Label>
              <Input type="number" step="0.01" value={form.agreed_price} onChange={e => setForm(f => ({ ...f, agreed_price: e.target.value }))} />
            </div>
            <div>
              <Label>Währung</Label>
              <Input value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <Label>Sendungsnummer</Label>
              <Input value={form.tracking_number} onChange={e => setForm(f => ({ ...f, tracking_number: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <Label>Notizen (Abholort, Verpackung, Avis)</Label>
              <Textarea rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending} className="gap-2">
              {create.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

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
import { Ship, Plus, Loader2, Search, FileDown, Mail, Send, ChevronDown } from 'lucide-react';
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
  route_plan_id: '',
  status: 'angefragt',
  assigned_date: '',
  agreed_price: '',
  currency: 'EUR',
  tracking_number: '',
  notes: '',
};

function addrOf(a: any): string {
  if (!a) return '';
  if (typeof a === 'string') return a;
  return [a.street || a.strasse, [a.zip || a.plz, a.city || a.ort].filter(Boolean).join(' '), a.country || a.land]
    .filter(Boolean).join(', ');
}

function planOrderNo(p: any): string | null {
  return p?.order?.order_number ?? (p?.order_id ? `Auftrag ${String(p.order_id).slice(0, 8)}` : null);
}

function planCustomer(p: any): string | null {
  return p?.order?.customer?.company_name || p?.order?.customer?.contact_name || p?.contact_name || null;
}

function planContact(p: any): string | null {
  const c = p?.order?.customer;
  return [p?.contact_name || c?.contact_name, p?.contact_email || c?.email, p?.contact_phone || c?.phone].filter(Boolean).join(' · ') || null;
}

function planLabel(p: any): string {
  return [planOrderNo(p), planCustomer(p), p.device_model, p.device_serial_number, addrOf(p.location_address), p.planned_date ? format(new Date(p.planned_date), 'dd.MM.yyyy') : null]
    .filter(Boolean).join(' · ');
}

export default function DispatchSpeditionsversand() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [apptSearch, setApptSearch] = useState('');

  const [statusFilter, setStatusFilter] = useState('alle');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });

  const { data: rows, isPending } = useQuery({
    queryKey: ['dispatch', 'carrier-assignments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_carrier_assignments')
        .select('*, carrier:carrier_id(name, contact_name, street, zip, city, country, phone, email), appointment:appointment_id(order_number, customer_name, company_name, device_name, serial_number, contact_name, contact_phone, contact_email, planned_date, delivery_street, delivery_zip, delivery_city, delivery_country), route_plan:route_plan_id(id, order_id, planned_date, planning_status, contact_name, contact_email, contact_phone, device_model, device_serial_number, location_address, tour_type, order:order_id(order_number, customer:customer_id(company_name, contact_name, email, phone)))')
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

  const { data: routePlans } = useQuery({
    queryKey: ['dispatch', 'route-plans', 'for-carrier'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('route_plans')
        .select('id, order_id, planned_date, requested_date, planning_status, tour_type, contact_name, contact_email, contact_phone, device_model, device_serial_number, location_address, planning_note, order:order_id(order_number, customer:customer_id(company_name, contact_name, email, phone))')
        .order('planned_date', { ascending: false, nullsFirst: false })
        .limit(300);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });

  const assignedPlanIds = useMemo(
    () => new Set((rows ?? []).map((r: any) => r.route_plan_id).filter(Boolean)),
    [rows],
  );

  const openPlans = useMemo(
    () => (routePlans ?? []).filter((p: any) => !assignedPlanIds.has(p.id) && p.planning_status !== 'abgeschlossen' && p.planning_status !== 'storniert'),
    [routePlans, assignedPlanIds],
  );

  const filteredAppointments = useMemo(() => {
    const s = apptSearch.trim().toLowerCase();
    const list = appointments ?? [];
    if (!s) return list;
    return list.filter((a: any) =>
      [a.order_number, a.customer_name, a.company_name, a.device_name, a.delivery_city, a.delivery_zip]
        .some(v => String(v ?? '').toLowerCase().includes(s)),
    );
  }, [appointments, apptSearch]);

  const filtered = useMemo(() => {

    const s = search.trim().toLowerCase();
    return (rows ?? []).filter((r: any) => {
      if (statusFilter !== 'alle' && r.status !== statusFilter) return false;
      if (!s) return true;
      return [r.tracking_number, r.carrier?.name, r.appointment?.order_number, r.appointment?.customer_name, r.appointment?.company_name, r.appointment?.serial_number,
        r.route_plan?.contact_name, r.route_plan?.device_serial_number, r.route_plan?.device_model, planOrderNo(r.route_plan), planCustomer(r.route_plan)]
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
        route_plan_id: form.route_plan_id || null,
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

  const customerEmailOf = (r: any) =>
    r.appointment?.contact_email || r.route_plan?.contact_email || r.route_plan?.order?.customer?.email || null;

  // Statuswechsel: sobald "abgeholt" gesetzt wird, automatisch Versandavis an den Kunden (CC K.trinh).
  async function changeStatus(row: any, next: string) {
    const prev = row.status ?? 'angefragt';
    await update.mutateAsync({ id: row.id, patch: { status: next } });
    if (next === 'abgeholt' && prev !== 'abgeholt') {
      if (!customerEmailOf(row)) {
        toast.warning('Als abgeholt markiert – keine Kunden-E-Mail hinterlegt, kein Versandavis gesendet.');
        return;
      }
      await sendMail(row, 'customer');
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

      <Card className="p-4 mb-4">
        <button
          type="button"
          className="w-full flex items-center justify-between gap-3 mb-3 text-left"
          onClick={() => setPlansOpen(o => !o)}
        >
          <div>
            <h2 className="font-semibold">Offene Termine aus der Tourenplanung</h2>
            <p className="text-sm text-muted-foreground">Einträge aus <span className="font-mono">route_plans</span>, für die noch keine Spedition beauftragt wurde.</p>
          </div>
          <span className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
            {openPlans.length} offen
            <ChevronDown className={`w-4 h-4 transition-transform ${plansOpen ? 'rotate-180' : ''}`} />
          </span>
        </button>
        {!plansOpen ? null : openPlans.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine offenen Tourenplan-Einträge.</p>
        ) : (
          <div className="max-h-72 overflow-y-auto divide-y divide-border">

            {openPlans.slice(0, 50).map((p: any) => (
              <div key={p.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    <span className="font-mono text-primary">{planOrderNo(p) ?? 'Ohne Auftrag'}</span>
                    {' · '}{planCustomer(p) || 'Ohne Kunde'}
                    {p.device_model ? ` · ${p.device_model}` : ''}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {planContact(p) || 'Kein Kontakt hinterlegt'}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {[addrOf(p.location_address), p.device_serial_number, p.planning_status, p.planned_date ? format(new Date(p.planned_date), 'dd.MM.yyyy') : null].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <Button
                  size="sm" variant="outline" className="h-8 gap-1 shrink-0"
                  onClick={() => {
                    setForm({
                      ...EMPTY,
                      route_plan_id: p.id,
                      assigned_date: p.planned_date ? String(p.planned_date).slice(0, 10) : '',
                      notes: [p.planning_note, addrOf(p.location_address)].filter(Boolean).join('\n'),
                    });
                    setOpen(true);
                  }}
                >
                  <Ship className="w-3.5 h-3.5" /> Spedition beauftragen
                </Button>
              </div>
            ))}
          </div>
        )}
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
                <TableCell className="font-medium">
                  {r.appointment?.order_number ?? planOrderNo(r.route_plan) ?? '—'}
                  {r.route_plan_id && <div className="text-[10px] uppercase tracking-wide text-muted-foreground">aus Tourenplanung</div>}
                </TableCell>
                <TableCell>{r.appointment?.company_name || r.appointment?.customer_name || planCustomer(r.route_plan) || '—'}</TableCell>
                <TableCell>{[r.appointment?.device_name || r.route_plan?.device_model, r.appointment?.serial_number || r.route_plan?.device_serial_number].filter(Boolean).join(' · ') || '—'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {[r.appointment?.delivery_street, [r.appointment?.delivery_zip, r.appointment?.delivery_city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || addrOf(r.route_plan?.location_address) || '—'}
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
                    onChange={e => changeStatus(r, e.target.value)}
                  >
                    {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k} className="bg-background text-foreground">{v}</option>)}
                  </select>
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <div className="inline-flex gap-1">
                    <Button size="sm" variant="outline" className="h-8 gap-1" title="Frachtauftrag als PDF" onClick={() => downloadCarrierOrderPdf(r)}>
                      <FileDown className="w-3.5 h-3.5" /> PDF
                    </Button>
                    <Button
                      size="sm" variant="outline" className="h-8 gap-1"
                      title={r.carrier?.email ? `Frachtauftrag an ${r.carrier.email}` : 'Keine E-Mail bei der Spedition hinterlegt'}
                      disabled={!r.carrier?.email || sending === `${r.id}:carrier`}
                      onClick={() => sendMail(r, 'carrier')}
                    >
                      {sending === `${r.id}:carrier` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Spedition
                    </Button>
                    <Button
                      size="sm" variant="outline" className="h-8 gap-1"
                      title={customerEmailOf(r) ? `Versandavis an ${customerEmailOf(r)} (CC K.trinh@alix-operation.de)` : 'Keine Kunden-E-Mail hinterlegt'}
                      disabled={!customerEmailOf(r) || sending === `${r.id}:customer`}
                      onClick={() => sendMail(r, 'customer')}
                    >
                      {sending === `${r.id}:customer` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />} Kunde
                    </Button>
                  </div>
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
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Suche nach Auftragsnummer oder Name…"
                  value={apptSearch}
                  onChange={e => setApptSearch(e.target.value)}
                />
              </div>
              <select
                className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.appointment_id}
                onChange={e => setForm(f => ({ ...f, appointment_id: e.target.value }))}
              >
                <option value="">— ohne Auftragsbezug —</option>
                {filteredAppointments.map((a: any) => (
                  <option key={a.id} value={a.id}>
                    {[a.order_number, a.company_name || a.customer_name, a.device_name, [a.delivery_zip, a.delivery_city].filter(Boolean).join(' ')].filter(Boolean).join(' · ')}
                  </option>
                ))}
              </select>
              {apptSearch.trim() && (
                <p className="mt-1 text-xs text-muted-foreground">{filteredAppointments.length} Treffer</p>
              )}
            </div>

            <div className="sm:col-span-2">
              <Label>Tourenplanung (route_plans)</Label>
              <select
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.route_plan_id}
                onChange={e => {
                  const id = e.target.value;
                  const p = (routePlans ?? []).find((x: any) => x.id === id);
                  setForm(f => ({
                    ...f,
                    route_plan_id: id,
                    assigned_date: f.assigned_date || (p?.planned_date ? String(p.planned_date).slice(0, 10) : ''),
                  }));
                }}
              >
                <option value="">— ohne Tourenbezug —</option>
                {(routePlans ?? []).map((p: any) => (
                  <option key={p.id} value={p.id}>{planLabel(p)}</option>
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

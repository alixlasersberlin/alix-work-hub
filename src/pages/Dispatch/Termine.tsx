import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenantFilter } from '@/hooks/useTenantFilter';
import { toast } from 'sonner';
import { CalendarClock, Search, PackageSearch, History, Send, FlaskConical, CalendarPlus, Loader2, Route as RouteIcon } from 'lucide-react';
import { format } from 'date-fns';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { OrderQuickViewDialog } from '@/components/dispatch/OrderQuickViewDialog';
import { DELIVERY_STATUS_LABELS, DELIVERY_TYPE_LABELS, READINESS_LABELS, readinessClass, statusClass } from './constants';

export default function DispatchTermine() {
  const { user, profile } = useAuth();
  const { tenantId } = useTenantFilter();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('alle');
  const [readiness, setReadiness] = useState('alle');
  const [historyFor, setHistoryFor] = useState<{ id: string; label: string } | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [orderPreview, setOrderPreview] = useState<string | null>(null);
  const [testRow, setTestRow] = useState<any | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; from: string | null; message: string } | null>(null);
  const [calSyncing, setCalSyncing] = useState(false);

  async function syncCalendar() {
    setCalSyncing(true);
    const { data, error } = await (supabase as any).rpc('dispatch_sync_all_appointments_to_calendar');
    setCalSyncing(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${data ?? 0} Termine in den Teamkalender übernommen`);
    qc.invalidateQueries({ queryKey: ['dispatch'] });
  }


  const { data, isPending } = useQuery({
    queryKey: ['dispatch', 'appointments', status, readiness, tenantId],
    queryFn: async () => {
      let q = supabase
        .from('delivery_appointments')
        .select('id, order_number, customer_name, company_name, contact_email, delivery_zip, delivery_city, appointment_type, status, readiness, planned_date, time_window_start, time_window_end, device_name, is_vip')
        .order('planned_date', { ascending: true, nullsFirst: false })
        .limit(300);
      if (tenantId) q = q.eq('tenant_id', tenantId as never);
      if (status !== 'alle') q = q.eq('status', status as never);
      if (readiness !== 'alle') q = q.eq('readiness', readiness as never);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

  const { data: history } = useQuery({
    queryKey: ['dispatch', 'status-history', historyFor?.id],
    enabled: !!historyFor,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_status_history')
        .select('id, from_status, to_status, changed_by_name, source, note, created_at')
        .eq('appointment_id', historyFor!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function changeStatus(row: any, next: string) {
    const { error } = await supabase
      .from('delivery_appointments')
      .update({ status: next as never, updated_by: user?.id ?? null })
      .eq('id', row.id);
    if (error) { toast.error(error.message); return; }
    await supabase.from('delivery_status_history').insert({
      appointment_id: row.id,
      from_status: row.status,
      to_status: next,
      changed_by: user?.id ?? null,
      changed_by_name: profile?.full_name ?? null,
      source: 'dispatch_ui',
    });
    toast.success(`Status: ${DELIVERY_STATUS_LABELS[next] ?? next}`);
    qc.invalidateQueries({ queryKey: ['dispatch'] });
  }

  async function sendConfirmation(row: any) {
    if (!row.contact_email) { toast.error('Keine Kunden-E-Mail im Termin hinterlegt'); return; }
    if (!row.planned_date) { toast.error('Bitte zuerst ein Lieferdatum setzen'); return; }
    setSendingId(row.id);
    const { data, error } = await supabase.functions.invoke('delivery-appointment-send', {
      body: { appointmentId: row.id, baseUrl: 'https://app.alixwork.de' },
    });
    setSendingId(null);
    if (error || (data as any)?.error) { toast.error((data as any)?.error ?? error?.message ?? 'Versand fehlgeschlagen'); return; }
    toast.success(`Bestätigungslink an ${row.contact_email} versendet`);
    qc.invalidateQueries({ queryKey: ['dispatch'] });
  }

  async function sendTestMail() {
    if (!testRow) return;
    const to = testEmail.trim();
    if (!to.includes('@')) { toast.error('Bitte eine gültige E-Mail-Adresse eingeben'); return; }
    setTestSending(true);
    setTestResult(null);
    const { data, error } = await supabase.functions.invoke('delivery-appointment-send', {
      body: { appointmentId: testRow.id, testMode: true, testTo: to, baseUrl: 'https://app.alixwork.de' },
    });
    setTestSending(false);
    const res = data as any;
    if (error || res?.error) {
      setTestResult({ ok: false, from: res?.from ?? null, message: res?.error ?? error?.message ?? 'Testversand fehlgeschlagen' });
      toast.error(res?.error ?? error?.message ?? 'Testversand fehlgeschlagen');
      return;
    }
    setTestResult({ ok: true, from: res?.from ?? null, message: `Testmail an ${res?.to ?? to} versendet` });
    toast.success(`Testmail an ${res?.to ?? to} versendet`);
  }


  const term = search.trim().toLowerCase();
  const rows = (data ?? []).filter(r =>
    !term ||
    [r.order_number, r.customer_name, r.company_name, r.delivery_city, r.delivery_zip, r.device_name]
      .some(v => (v ?? '').toString().toLowerCase().includes(term))
  );

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <PageHeader
        title="Liefertermine"
        subtitle="Alle geplanten und offenen Liefer- und Servicetermine"
        icon={CalendarClock}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/dispatch/tagesplanung?neu=1"><RouteIcon className="h-4 w-4 mr-2" /> Tour planen</Link>
            </Button>
            <Button onClick={syncCalendar} disabled={calSyncing} variant="outline">
              {calSyncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CalendarPlus className="h-4 w-4 mr-2" />}
              In Teamkalender übernehmen
            </Button>
            <Button asChild variant="outline">
              <Link to="/dispatch/ungeplant"><PackageSearch className="h-4 w-4 mr-2" /> Ungeplante Auslieferungen</Link>
            </Button>
          </div>
        }
      />

      <Card className="p-4 mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Auftrag, Kunde, Ort, Gerät…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="md:w-64"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle Status</SelectItem>
            {Object.entries(DELIVERY_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={readiness} onValueChange={setReadiness}>
          <SelectTrigger className="md:w-48"><SelectValue placeholder="Ampel" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle Ampeln</SelectItem>
            {Object.entries(READINESS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Termin</TableHead>
              <TableHead>Auftrag</TableHead>
              <TableHead>Kunde</TableHead>
              <TableHead>Ort</TableHead>
              <TableHead>Art</TableHead>
              <TableHead>Ampel</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Lädt…</TableCell></TableRow>
            )}
            {!isPending && rows.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Keine Liefertermine gefunden.</TableCell></TableRow>
            )}
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap">
                  {r.planned_date ? format(new Date(r.planned_date), 'dd.MM.yyyy') : <span className="text-muted-foreground">offen</span>}
                  {r.time_window_start && <span className="text-muted-foreground ml-2 text-xs">{r.time_window_start.slice(0, 5)}–{(r.time_window_end ?? '').slice(0, 5)}</span>}
                </TableCell>
                <TableCell className="font-medium">
                  {r.order_number ? (
                    <button
                      type="button"
                      className="text-primary underline underline-offset-2 hover:opacity-80"
                      onClick={() => setOrderPreview(r.order_number)}
                    >
                      {r.order_number}
                    </button>
                  ) : '—'}
                </TableCell>
                <TableCell>
                  {r.is_vip && <span className="mr-1">👑</span>}
                  {r.company_name || r.customer_name || '—'}
                </TableCell>
                <TableCell className="text-muted-foreground">{[r.delivery_zip, r.delivery_city].filter(Boolean).join(' ') || '—'}</TableCell>
                <TableCell>{DELIVERY_TYPE_LABELS[r.appointment_type] ?? r.appointment_type}</TableCell>
                <TableCell>
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${readinessClass(r.readiness)}`}>
                    {READINESS_LABELS[r.readiness] ?? r.readiness}
                  </span>
                </TableCell>
                <TableCell>
                  <Select value={r.status} onValueChange={v => changeStatus(r, v)}>
                    <SelectTrigger className={`h-8 w-56 text-xs ${statusClass(r.status)}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(DELIVERY_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Button
                    variant="outline"
                    size="sm"
                    className="mr-1"
                    disabled={sendingId === r.id}
                    onClick={() => sendConfirmation(r)}
                    title="Terminbestätigung an Kunden senden"
                  >
                    <Send className="h-3.5 w-3.5 mr-1" /> Bestätigung
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Test-Mail mit echten Termindaten senden"
                    onClick={() => {
                      setTestRow(r);
                      setTestEmail(user?.email ?? '');
                      setTestResult(null);
                    }}
                  >
                    <FlaskConical className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setHistoryFor({ id: r.id, label: r.order_number ?? '' })}>
                    <History className="h-4 w-4" />
                  </Button>

                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Sheet open={!!historyFor} onOpenChange={v => { if (!v) setHistoryFor(null); }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Statusverlauf {historyFor?.label}</SheetTitle></SheetHeader>
          <div className="mt-4 space-y-3">
            {(history ?? []).length === 0 && <p className="text-sm text-muted-foreground">Noch kein Verlauf.</p>}
            {(history ?? []).map(h => (
              <div key={h.id} className="rounded-lg border p-3">
                <div className="text-sm">
                  {h.from_status ? `${DELIVERY_STATUS_LABELS[h.from_status] ?? h.from_status} → ` : ''}
                  <span className="font-medium">{DELIVERY_STATUS_LABELS[h.to_status] ?? h.to_status}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {format(new Date(h.created_at), 'dd.MM.yyyy HH:mm')} · {h.changed_by_name || 'System'} · {h.source || '—'}
                </div>
                {h.note && <div className="text-xs mt-1">{h.note}</div>}
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={!!testRow} onOpenChange={v => { if (!v) { setTestRow(null); setTestResult(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Test-Mail Liefertermin</DialogTitle>
            <DialogDescription>
              Sendet die echte Liefertermin-Mail zu {testRow?.order_number || 'diesem Termin'} an eine Testadresse.
              Der Kunde wird nicht benachrichtigt, es wird kein Status geändert und kein gültiger Bestätigungslink erzeugt.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Empfänger</label>
              <Input type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="test@alix-operation.de" />
            </div>
            <div className="rounded-lg border p-3 text-sm">
              <div className="text-muted-foreground text-xs">Absender</div>
              <div className="font-medium">Alix Lasers ® &lt;no-reply@alixwork.de&gt;</div>
            </div>
            {testResult && (
              <div className={`rounded-lg border p-3 text-sm ${testResult.ok ? 'border-emerald-500/40 text-emerald-500' : 'border-destructive/40 text-destructive'}`}>
                <div>{testResult.message}</div>
                {testResult.from && <div className="text-xs mt-1">Bestätigter Absender: {testResult.from}</div>}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestRow(null)}>Schließen</Button>
            <Button onClick={sendTestMail} disabled={testSending}>
              <FlaskConical className="h-4 w-4 mr-2" /> {testSending ? 'Sende…' : 'Test-Mail senden'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OrderQuickViewDialog orderNumber={orderPreview} onOpenChange={v => { if (!v) setOrderPreview(null); }} />

    </div>
  );
}

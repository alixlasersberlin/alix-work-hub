import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wrench, Loader2, Plus, CalendarCheck } from 'lucide-react';
import { toast } from 'sonner';
import { logPortalAudit } from '@/lib/portal/audit';

type Ctx = { customerId: string };

export default function CustomerPortalMaintenance() {
  const ctx = useOutletContext<Ctx>();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [devices, setDevices] = useState<{ serial: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    device_serial: '', preferred_period: '', preferred_weekday: '', preferred_time: '',
    site_address: '', contact_name: '', contact_phone: '',
    issue_description: '', device_operable: 'yes', extra_note: '',
  });

  const load = async () => {
    setLoading(true);
    const [m, r] = await Promise.all([
      supabase.from('device_maintenance').select('id, device_name, serial_number, last_maintenance_date, next_maintenance_date, maintenance_status')
        .eq('customer_id', ctx.customerId).eq('customer_visible', true)
        .order('next_maintenance_date', { ascending: true, nullsFirst: false }),
      supabase.from('customer_portal_maintenance_requests').select('id, device_name, device_serial, status, created_at, preferred_period')
        .eq('customer_id', ctx.customerId).order('created_at', { ascending: false }),
    ]);
    setItems(m.data ?? []);
    setRequests(r.data ?? []);
    // Geräte für Auswahl aus Wartungsplänen + Lager sammeln
    const dev = new Map<string, string>();
    (m.data ?? []).forEach((x: any) => { if (x.serial_number) dev.set(x.serial_number, x.device_name ?? x.serial_number); });
    setDevices(Array.from(dev, ([serial, name]) => ({ serial, name })));
    setLoading(false);
  };
  useEffect(() => { void load(); }, [ctx.customerId]);

  const submit = async () => {
    if (!form.issue_description.trim()) return toast.error('Bitte beschreiben Sie das Anliegen.');
    setBusy(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Nicht angemeldet');
      const dev = devices.find((d) => d.serial === form.device_serial);
      const { error } = await supabase.from('customer_portal_maintenance_requests').insert({
        customer_id: ctx.customerId,
        device_serial: form.device_serial || null,
        device_name: dev?.name ?? null,
        preferred_period: form.preferred_period || null,
        preferred_weekday: form.preferred_weekday || null,
        preferred_time: form.preferred_time || null,
        site_address: form.site_address || null,
        contact_name: form.contact_name || null,
        contact_phone: form.contact_phone || null,
        issue_description: form.issue_description.trim(),
        device_operable: form.device_operable === 'yes',
        extra_note: form.extra_note || null,
        created_by: user.user.id,
      });
      if (error) throw error;
      void logPortalAudit({ action: 'data_change_requested', customerId: ctx.customerId, objectType: 'maintenance_request' });
      toast.success('Anfrage übermittelt. Wir melden uns zeitnah bei Ihnen.');
      setOpen(false); await load();
    } catch (e: any) {
      toast.error(e?.message ?? 'Anfrage fehlgeschlagen');
    } finally { setBusy(false); }
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2"><Wrench className="w-5 h-5" /><h2 className="text-2xl font-semibold">Wartungen</h2></div>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" />Wartungstermin anfragen</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><CalendarCheck className="w-4 h-4" /> Geplante Wartungen</CardTitle></CardHeader>
        <CardContent>
          {items.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">Keine Wartungsdaten für Sie freigegeben.</p> : (
            <ul className="divide-y divide-border">
              {items.map((x) => (
                <li key={x.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{x.device_name ?? '—'}</p>
                    <p className="text-xs text-muted-foreground font-mono">{x.serial_number ?? '—'}</p>
                  </div>
                  <div className="text-right text-xs">
                    <p>Nächste: <b>{x.next_maintenance_date ? new Date(x.next_maintenance_date).toLocaleDateString('de-DE') : '—'}</b></p>
                    {x.last_maintenance_date && <p className="text-muted-foreground">Letzte: {new Date(x.last_maintenance_date).toLocaleDateString('de-DE')}</p>}
                    {x.maintenance_status && <Badge variant="outline" className="mt-1">{x.maintenance_status}</Badge>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Meine Anfragen</CardTitle></CardHeader>
        <CardContent>
          {requests.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">Sie haben noch keine Wartungsanfragen gestellt.</p> : (
            <ul className="divide-y divide-border">
              {requests.map((r) => (
                <li key={r.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{r.device_name ?? 'Gerät'} <span className="text-muted-foreground font-mono text-xs">{r.device_serial ?? ''}</span></p>
                    <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString('de-DE')} · Wunsch: {r.preferred_period ?? '—'}</p>
                  </div>
                  <Badge variant="secondary">{r.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Wartungstermin anfragen</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Gerät</Label>
              <Select value={form.device_serial} onValueChange={(v) => setForm({ ...form, device_serial: v })}>
                <SelectTrigger><SelectValue placeholder="Gerät wählen (optional)" /></SelectTrigger>
                <SelectContent>{devices.map((d) => <SelectItem key={d.serial} value={d.serial}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <div><Label>Zeitraum</Label><Input placeholder="z.B. KW 30" value={form.preferred_period} onChange={(e) => setForm({ ...form, preferred_period: e.target.value })} /></div>
              <div><Label>Wochentag</Label><Input placeholder="Di/Mi" value={form.preferred_weekday} onChange={(e) => setForm({ ...form, preferred_weekday: e.target.value })} /></div>
              <div><Label>Uhrzeit</Label><Input placeholder="vormittags" value={form.preferred_time} onChange={(e) => setForm({ ...form, preferred_time: e.target.value })} /></div>
            </div>
            <div><Label>Einsatzadresse</Label><Input value={form.site_address} onChange={(e) => setForm({ ...form, site_address: e.target.value })} /></div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div><Label>Ansprechpartner</Label><Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} /></div>
              <div><Label>Telefon</Label><Input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} /></div>
            </div>
            <div>
              <Label>Gerät noch nutzbar?</Label>
              <Select value={form.device_operable} onValueChange={(v) => setForm({ ...form, device_operable: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="yes">Ja</SelectItem><SelectItem value="no">Nein</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Anliegen *</Label><Textarea rows={4} value={form.issue_description} onChange={(e) => setForm({ ...form, issue_description: e.target.value })} maxLength={2000} /></div>
            <div><Label>Zusätzliche Nachricht</Label><Textarea rows={2} value={form.extra_note} onChange={(e) => setForm({ ...form, extra_note: e.target.value })} maxLength={500} /></div>
            <p className="text-xs text-muted-foreground">Foto-/Videoupload folgt im nächsten Rollout.</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Abbrechen</Button>
            <Button onClick={submit} disabled={busy}>{busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Anfrage senden</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

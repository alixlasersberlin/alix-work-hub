import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, Truck, Send } from 'lucide-react';
import DeliveryMailTemplatesDialog from './DeliveryMailTemplatesDialog';
import DeliveryBlockersCard from './DeliveryBlockersCard';
import DeliveryOpsCards from './DeliveryOpsCards';

import { toast } from 'sonner';

const db = supabase as any;

const PHASES: { value: string; label: string }[] = [
  { value: 'auto', label: 'Automatisch (aus vorhandenen Daten)' },
  { value: 'order_received', label: 'Auftrag eingegangen' },
  { value: 'order_check', label: 'Auftragsprüfung' },
  { value: 'production_planned', label: 'Produktion geplant' },
  { value: 'in_production', label: 'In Produktion' },
  { value: 'qc', label: 'Qualitätsprüfung' },
  { value: 'provisioning', label: 'Bereitstellung' },
  { value: 'tour_planning', label: 'Tourenplanung' },
  { value: 'out_for_delivery', label: 'Auslieferung' },
  { value: 'delivered', label: 'Geliefert' },
];

const PRODUCTION_STEPS = [
  { key: 'housing', label: 'Gehäusemontage' },
  { key: 'electronics', label: 'Elektronik' },
  { key: 'cooling', label: 'Kühlsystem' },
  { key: 'laser', label: 'Laserquelle' },
  { key: 'handpiece', label: 'Handstück' },
  { key: 'software', label: 'Software / KI' },
  { key: 'assembly', label: 'Endmontage' },
];

const QC_STEPS = [
  { key: 'electric', label: 'Elektrische Prüfung' },
  { key: 'power', label: 'Laserleistungsprüfung' },
  { key: 'cooling', label: 'Kühlsystem' },
  { key: 'software', label: 'Softwareprüfung' },
  { key: 'safety', label: 'Sicherheitsprüfung' },
  { key: 'function', label: 'Funktionsprüfung' },
  { key: 'final', label: 'Endkontrolle' },
];

const STEP_STATES = [
  { value: 'pending', label: 'ausstehend' },
  { value: 'active', label: 'in Arbeit' },
  { value: 'done', label: 'abgeschlossen' },
  { value: 'issue', label: 'Problem' },
];

type StepRow = { key: string; label: string; status: string };

function mergeSteps(defs: { key: string; label: string }[], raw: any): StepRow[] {
  const map = new Map<string, string>();
  (Array.isArray(raw) ? raw : []).forEach((s: any) => s?.key && map.set(String(s.key), String(s.status ?? 'pending')));
  return defs.map((d) => ({ ...d, status: map.get(d.key) ?? 'pending' }));
}

export default function OrderDeliveryStatusPanel({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [row, setRow] = useState<any>({ phase: 'auto', notify_customer: true });
  const [prod, setProd] = useState<StepRow[]>(mergeSteps(PRODUCTION_STEPS, []));
  const [qc, setQc] = useState<StepRow[]>(mergeSteps(QC_STEPS, []));
  const [events, setEvents] = useState<any[]>([]);
  const [notifying, setNotifying] = useState(false);
  const initialPhase = useRef<string>('auto');

  async function load() {
    setLoading(true);
    const [{ data }, { data: ev }] = await Promise.all([
      db.from('order_delivery_status').select('*').eq('order_id', orderId).maybeSingle(),
      db.from('order_delivery_events').select('*').eq('order_id', orderId).order('created_at', { ascending: false }).limit(30),
    ]);
    if (data) {
      setRow(data);
      initialPhase.current = data.phase ?? 'auto';
      setProd(mergeSteps(PRODUCTION_STEPS, data.production_steps));
      setQc(mergeSteps(QC_STEPS, data.qc_steps));
    }
    setEvents(ev ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [orderId]);

  const set = (k: string, v: any) => setRow((r: any) => ({ ...r, [k]: v }));

  async function notify(force = false) {
    setNotifying(true);
    const { data, error } = await supabase.functions.invoke('delivery-notify', {
      body: { order_id: orderId, phase: row.phase && row.phase !== 'auto' ? row.phase : undefined, force },
    });
    setNotifying(false);
    if (error) { toast.error('Versand fehlgeschlagen: ' + error.message); return; }
    if ((data as any)?.skipped) { toast.info('Für diese Phase ist keine Vorlage aktiv.'); return; }
    toast.success('Kunde benachrichtigt: ' + ((data as any)?.to ?? ''));
    load();
  }

  async function save() {
    setSaving(true);
    const phaseChanged = row.phase && row.phase !== 'auto' && row.phase !== initialPhase.current;
    const { data: auth } = await supabase.auth.getUser();
    const payload = {
      order_id: orderId,
      phase: row.phase || 'auto',
      sub_status: row.sub_status || null,
      production_started_at: row.production_started_at || null,
      production_end_planned: row.production_end_planned || null,
      qc_started_at: row.qc_started_at || null,
      qc_completed_at: row.qc_completed_at || null,
      production_steps: prod,
      qc_steps: qc,
      eta_earliest: row.eta_earliest || null,
      eta_planned: row.eta_planned || null,
      eta_latest: row.eta_latest || null,
      eta_confirmed: !!row.eta_confirmed,
      time_window_start: row.time_window_start || null,
      time_window_end: row.time_window_end || null,
      is_delayed: !!row.is_delayed,
      delay_reason_internal: row.delay_reason_internal || null,
      customer_delay_reason: row.customer_delay_reason || null,
      partial_delivery: !!row.partial_delivery,
      customer_note: row.customer_note || null,
      notify_customer: row.notify_customer !== false,
      notify_sms: !!row.notify_sms,
      notify_phone: row.notify_phone || null,
      updated_by: auth?.user?.id ?? null,
    };
    const { error } = await db.from('order_delivery_status').upsert(payload, { onConflict: 'order_id' });
    setSaving(false);
    if (error) { toast.error('Speichern fehlgeschlagen: ' + error.message); return; }
    toast.success('Lieferstatus gespeichert');
    initialPhase.current = row.phase;
    if (phaseChanged && row.notify_customer !== false) await notify(false);
    load();
  }

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  const stepEditor = (rows: StepRow[], setRows: (r: StepRow[]) => void) => (
    <div className="space-y-2">
      {rows.map((s, i) => (
        <div key={s.key} className="flex items-center gap-3">
          <span className="text-sm flex-1">{s.label}</span>
          <Select value={s.status} onValueChange={(v) => setRows(rows.map((r, idx) => idx === i ? { ...r, status: v } : r))}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STEP_STATES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2"><Truck className="w-5 h-5" /> Lieferstatus (Kundenportal)</CardTitle>
          <div className="flex items-center gap-2">
            <DeliveryMailTemplatesDialog />
            <Button onClick={() => notify(true)} disabled={notifying} variant="outline" size="sm">
              {notifying ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />} Kunde benachrichtigen
            </Button>
            <Button onClick={save} disabled={saving} size="sm">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />} Speichern
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Aktuelle Phase</Label>
            <Select value={row.phase ?? 'auto'} onValueChange={(v) => set('phase', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PHASES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Unterstatus (intern)</Label>
            <Input value={row.sub_status ?? ''} onChange={(e) => set('sub_status', e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Produktionsbeginn</Label>
            <Input type="date" value={row.production_started_at ?? ''} onChange={(e) => set('production_started_at', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Geplantes Produktionsende</Label>
            <Input type="date" value={row.production_end_planned ?? ''} onChange={(e) => set('production_end_planned', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Qualitätsprüfung Beginn</Label>
            <Input type="date" value={row.qc_started_at ?? ''} onChange={(e) => set('qc_started_at', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Qualitätsprüfung abgeschlossen</Label>
            <Input type="date" value={row.qc_completed_at ?? ''} onChange={(e) => set('qc_completed_at', e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Frühester Liefertermin</Label>
            <Input type="date" value={row.eta_earliest ?? ''} onChange={(e) => set('eta_earliest', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Geplanter Liefertermin</Label>
            <Input type="date" value={row.eta_planned ?? ''} onChange={(e) => set('eta_planned', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Spätester Liefertermin</Label>
            <Input type="date" value={row.eta_latest ?? ''} onChange={(e) => set('eta_latest', e.target.value)} />
          </div>
          <div className="flex items-center gap-3 pt-6">
            <Switch checked={!!row.eta_confirmed} onCheckedChange={(v) => set('eta_confirmed', v)} />
            <Label>Liefertermin bestätigt</Label>
          </div>

          <div className="space-y-1.5">
            <Label>Lieferzeitfenster von</Label>
            <Input type="time" value={row.time_window_start ?? ''} onChange={(e) => set('time_window_start', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Lieferzeitfenster bis</Label>
            <Input type="time" value={row.time_window_end ?? ''} onChange={(e) => set('time_window_end', e.target.value)} />
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={!!row.is_delayed} onCheckedChange={(v) => set('is_delayed', v)} />
            <Label>Verzögerung</Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={!!row.partial_delivery} onCheckedChange={(v) => set('partial_delivery', v)} />
            <Label>Teillieferung vorgesehen</Label>
          </div>

          <div className="space-y-1.5">
            <Label>Interner Verzögerungsgrund (nicht sichtbar für Kunden)</Label>
            <Textarea rows={3} value={row.delay_reason_internal ?? ''} onChange={(e) => set('delay_reason_internal', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Kundenfreundlicher Verzögerungsgrund</Label>
            <Textarea rows={3} value={row.customer_delay_reason ?? ''} onChange={(e) => set('customer_delay_reason', e.target.value)} />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label>Kundenhinweis (ersetzt den Standardtext im Portal)</Label>
            <Textarea rows={2} value={row.customer_note ?? ''} onChange={(e) => set('customer_note', e.target.value)} />
          </div>

          <div className="flex items-center gap-3 md:col-span-2">
            <Switch checked={row.notify_customer !== false} onCheckedChange={(v) => set('notify_customer', v)} />
            <Label>Kundenbenachrichtigung bei Statusänderung senden</Label>
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={!!row.notify_sms} onCheckedChange={(v) => set('notify_sms', v)} />
            <Label>Zusätzlich per SMS informieren</Label>
          </div>
          <div className="space-y-1.5">
            <Label>Mobilnummer für SMS (Format +49…)</Label>
            <Input value={row.notify_phone ?? ''} onChange={(e) => set('notify_phone', e.target.value)} placeholder="+4917xxxxxxx" />
          </div>

          {row.customer_response && (
            <div className="md:col-span-2 rounded-md border p-3 text-sm">
              <div className="font-medium">
                {row.customer_response === 'confirmed'
                  ? 'Kunde hat den Liefertermin bestätigt'
                  : 'Kunde wünscht einen Alternativtermin'}
                {row.customer_responded_at && (
                  <span className="text-muted-foreground font-normal ml-2">
                    ({new Date(row.customer_responded_at).toLocaleString('de-DE')})
                  </span>
                )}
              </div>
              {row.customer_alternative_date && (
                <div className="text-muted-foreground">
                  Wunschtermin: {new Date(row.customer_alternative_date).toLocaleDateString('de-DE')}
                </div>
              )}
              {row.customer_response_note && (
                <div className="text-muted-foreground">Nachricht: {row.customer_response_note}</div>
              )}
            </div>
          )}

          {row.last_status_change && (
            <p className="text-xs text-muted-foreground md:col-span-2">
              Letzte Statusänderung: {new Date(row.last_status_change).toLocaleString('de-DE')}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Produktionsschritte</CardTitle></CardHeader>
          <CardContent>{stepEditor(prod, setProd)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Prüfschritte</CardTitle></CardHeader>
          <CardContent>{stepEditor(qc, setQc)}</CardContent>
        </Card>
      </div>

      <DeliveryBlockersCard orderId={orderId} />

      <DeliveryOpsCards orderId={orderId} />


      <Card>
        <CardHeader><CardTitle className="text-base">Lieferhistorie</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {events.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Einträge.</p>}
          {events.map((e) => (
            <div key={e.id} className="flex items-start gap-3 text-sm">
              <span className="text-xs text-muted-foreground w-32 shrink-0">{new Date(e.created_at).toLocaleString('de-DE')}</span>
              <div>
                <div className="font-medium">{e.title}</div>
                {e.description && <div className="text-muted-foreground">{e.description}</div>}
              </div>
              {e.visible_to_customer && <Badge variant="outline" className="ml-auto text-[10px]">Kunde sichtbar</Badge>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

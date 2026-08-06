import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DELIVERY_TYPE_LABELS, READINESS_LABELS, readinessClass } from '@/pages/Dispatch/constants';

export interface AppointmentOrderSeed {
  order_id: string;
  customer_id?: string | null;
  order_number?: string | null;
  customer_name?: string | null;
  company_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  delivery_street?: string | null;
  delivery_zip?: string | null;
  delivery_city?: string | null;
  delivery_country?: string | null;
  salesperson_name?: string | null;
  is_vip?: boolean | null;
}

interface ReadinessIssue { key: string; level: string; label: string }
interface ReadinessResult { readiness: string; issues: ReadinessIssue[] }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  seed: AppointmentOrderSeed | null;
  onCreated?: () => void;
}

export function CreateAppointmentDialog({ open, onOpenChange, seed, onCreated }: Props) {
  const { user, profile, hasAnyRole } = useAuth();
  const qc = useQueryClient();
  const canOverride = hasAnyRole(['Admin', 'Super Admin']);

  const [type, setType] = useState('auslieferung');
  const [date, setDate] = useState('');
  const [from, setFrom] = useState('09:00');
  const [to, setTo] = useState('12:00');
  const [duration, setDuration] = useState('90');
  const [priority, setPriority] = useState('normal');
  const [street, setStreet] = useState('');
  const [zip, setZip] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('DE');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [device, setDevice] = useState('');
  const [training, setTraining] = useState(false);
  const [nisv, setNisv] = useState(false);
  const [internalNotes, setInternalNotes] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !seed) return;
    setStreet(seed.delivery_street ?? '');
    setZip(seed.delivery_zip ?? '');
    setCity(seed.delivery_city ?? '');
    setCountry(seed.delivery_country || 'DE');
    setPhone(seed.contact_phone ?? '');
    setEmail(seed.contact_email ?? '');
    setOverrideReason('');
  }, [open, seed]);

  const { data: readiness, isPending: checking } = useQuery({
    queryKey: ['dispatch', 'readiness', seed?.order_id],
    enabled: open && !!seed?.order_id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('check_delivery_readiness', { _order_id: seed!.order_id });
      if (error) throw error;
      return data as unknown as ReadinessResult;
    },
    staleTime: 30_000,
  });

  const isRed = readiness?.readiness === 'rot';
  const blocked = isRed && (!canOverride || overrideReason.trim().length < 5);

  const issues = useMemo(() => readiness?.issues ?? [], [readiness]);

  async function submit() {
    if (!seed) return;
    if (!date) { toast.error('Bitte ein Lieferdatum wählen.'); return; }
    if (blocked) {
      toast.error(canOverride
        ? 'Rote Sperre: bitte eine Begründung mit mindestens 5 Zeichen angeben.'
        : 'Auftrag ist nicht lieferbereit (rot). Nur Admin/Super Admin kann die Sperre übergehen.');
      return;
    }
    setSaving(true);
    try {
      const { data: inserted, error } = await supabase.from('delivery_appointments').insert({
        order_id: seed.order_id,
        customer_id: seed.customer_id ?? null,
        order_number: seed.order_number ?? null,
        customer_name: seed.customer_name ?? null,
        company_name: seed.company_name ?? null,
        contact_phone: phone || null,
        contact_email: email || null,
        delivery_street: street || null,
        delivery_zip: zip || null,
        delivery_city: city || null,
        delivery_country: country || null,
        appointment_type: type as never,
        status: 'intern_geplant' as never,
        readiness: (readiness?.readiness ?? 'gelb') as never,
        readiness_details: (readiness ?? {}) as never,
        readiness_override_by: isRed ? user?.id ?? null : null,
        readiness_override_reason: isRed ? overrideReason.trim() : null,
        readiness_override_at: isRed ? new Date().toISOString() : null,
        planned_date: date,
        time_window_start: from || null,
        time_window_end: to || null,
        duration_minutes: Number(duration) || null,
        salesperson_name: seed.salesperson_name ?? null,
        device_name: device || null,
        priority,
        is_vip: !!seed.is_vip,
        requires_training: training,
        requires_nisv_docs: nisv,
        internal_notes: internalNotes || null,
        customer_notes: customerNotes || null,
        created_by: user?.id ?? null,
      }).select('id').single();
      if (error) throw error;

      await supabase.from('delivery_status_history').insert({
        appointment_id: inserted.id,
        from_status: null,
        to_status: 'intern_geplant',
        changed_by: user?.id ?? null,
        changed_by_name: profile?.full_name ?? null,
        source: 'dispatch_ui',
        note: 'Liefertermin angelegt',
      });

      if (isRed) {
        await supabase.from('delivery_readiness_overrides').insert({
          appointment_id: inserted.id,
          order_id: seed.order_id,
          previous_readiness: 'rot',
          reason: overrideReason.trim(),
          overridden_by: user?.id ?? null,
          overridden_by_name: profile?.full_name ?? null,
        });
      }

      toast.success('Liefertermin angelegt.');
      qc.invalidateQueries({ queryKey: ['dispatch'] });
      onOpenChange(false);
      onCreated?.();
    } catch (e: any) {
      toast.error(e?.message ?? 'Termin konnte nicht angelegt werden.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Liefertermin erstellen</DialogTitle>
          <DialogDescription>
            {seed?.order_number ? `Auftrag ${seed.order_number} · ` : ''}{seed?.company_name || seed?.customer_name || '—'}
          </DialogDescription>
        </DialogHeader>

        {/* Ampel */}
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${readinessClass(readiness?.readiness)}`}>
              {checking ? 'Prüfe…' : (READINESS_LABELS[readiness?.readiness ?? ''] ?? 'Unbekannt')}
            </span>
            <span className="text-sm text-muted-foreground">Lieferbereitschaft</span>
          </div>
          {issues.length === 0 && !checking && (
            <p className="text-sm text-emerald-400 flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Alle Prüfpunkte erfüllt.</p>
          )}
          <ul className="space-y-1">
            {issues.map(i => (
              <li key={i.key} className="text-sm flex items-start gap-2">
                {i.level === 'rot'
                  ? <ShieldAlert className="h-4 w-4 text-rose-400 mt-0.5 shrink-0" />
                  : <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />}
                <span className={i.level === 'rot' ? 'text-rose-300' : 'text-amber-300'}>{i.label}</span>
              </li>
            ))}
          </ul>
          {isRed && (
            <div className="mt-3">
              {canOverride ? (
                <>
                  <Label className="text-xs">Begründung für Übergehen der roten Sperre (Pflicht, wird protokolliert)</Label>
                  <Textarea rows={2} value={overrideReason} onChange={e => setOverrideReason(e.target.value)} placeholder="z. B. Zahlung liegt als Bankbeleg vor" />
                </>
              ) : (
                <p className="text-sm text-rose-300">Rote Sperre — nur Admin / Super Admin darf diesen Termin trotzdem anlegen.</p>
              )}
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Terminart</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(DELIVERY_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Lieferdatum *</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Priorität</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="niedrig">Niedrig</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="hoch">Hoch</SelectItem>
                <SelectItem value="dringend">Dringend</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Zeitfenster von</Label>
            <Input type="time" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div>
            <Label>Zeitfenster bis</Label>
            <Input type="time" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <div>
            <Label>Dauer (Minuten)</Label>
            <Input type="number" min={15} step={15} value={duration} onChange={e => setDuration(e.target.value)} />
          </div>
          <div>
            <Label>Gerät / Artikel</Label>
            <Input value={device} onChange={e => setDevice(e.target.value)} placeholder="Gerätebezeichnung" />
          </div>
          <div className="sm:col-span-2">
            <Label>Straße</Label>
            <Input value={street} onChange={e => setStreet(e.target.value)} />
          </div>
          <div>
            <Label>PLZ</Label>
            <Input value={zip} onChange={e => setZip(e.target.value)} />
          </div>
          <div>
            <Label>Ort</Label>
            <Input value={city} onChange={e => setCity(e.target.value)} />
          </div>
          <div>
            <Label>Land</Label>
            <Input value={country} onChange={e => setCountry(e.target.value)} />
          </div>
          <div>
            <Label>Telefon</Label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label>E-Mail</Label>
            <Input value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label className="mb-0">Einweisung / Schulung nötig</Label>
            <Switch checked={training} onCheckedChange={setTraining} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label className="mb-0">NiSV-Unterlagen nötig</Label>
            <Switch checked={nisv} onCheckedChange={setNisv} />
          </div>
          <div className="sm:col-span-2">
            <Label>Interne Notiz</Label>
            <Textarea rows={2} value={internalNotes} onChange={e => setInternalNotes(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label>Hinweis für den Kunden</Label>
            <Textarea rows={2} value={customerNotes} onChange={e => setCustomerNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={submit} disabled={saving || checking || blocked}>
            {saving ? 'Speichert…' : 'Termin anlegen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

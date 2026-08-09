import { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import SignaturePad from 'signature_pad';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Camera, Eraser, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { fetchApproval, isReleased, missingStages } from '@/lib/delivery-approval/api';

const FAIL_REASONS = [
  { v: 'nicht_angetroffen', l: 'Kunde nicht angetroffen' },
  { v: 'zugang_verweigert', l: 'Zugang verweigert' },
  { v: 'adresse_falsch', l: 'Adresse falsch' },
  { v: 'geraet_defekt', l: 'Gerät beschädigt/defekt' },
  { v: 'kunde_verschoben', l: 'Kunde hat verschoben' },
  { v: 'sonstiges', l: 'Sonstiges' },
];

export default function MobileTourStopp() {
  const { tourId, stopId } = useParams<{ tourId: string; stopId: string }>();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const [stop, setStop] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  const [signer, setSigner] = useState('');
  const [serial, setSerial] = useState('');
  const [note, setNote] = useState('');
  const [delay, setDelay] = useState('');
  const [reason, setReason] = useState('nicht_angetroffen');
  const [photos, setPhotos] = useState<File[]>([]);

  const [release, setRelease] = useState<{ released: boolean; missing: string[] } | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('delivery_tour_stops')
        .select('*, delivery_appointments:appointment_id(*)')
        .eq('id', stopId!)
        .maybeSingle();
      setStop(data);
      setSerial((data as any)?.delivery_appointments?.serial_number ?? '');
      const orderId = (data as any)?.delivery_appointments?.order_id;
      if (orderId) {
        try {
          const approval = await fetchApproval(orderId);
          setRelease({ released: isReleased(approval), missing: missingStages(approval) });
        } catch { setRelease(null); }
      } else {
        setRelease({ released: true, missing: [] });
      }
    })();
  }, [stopId]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const c = canvasRef.current;
    const resize = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      c.width = c.offsetWidth * ratio;
      c.height = c.offsetHeight * ratio;
      c.getContext('2d')?.scale(ratio, ratio);
      padRef.current?.clear();
      setHasInk(false);
    };
    padRef.current = new SignaturePad(c, { backgroundColor: 'rgba(255,255,255,0)', penColor: 'hsl(var(--foreground))' });
    padRef.current.addEventListener('endStroke', () => setHasInk(!padRef.current?.isEmpty()));
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [stop]);

  const appointmentId = stop?.appointment_id;

  const setAppointmentStatus = async (status: string) => {
    setBusy(true);
    const { error } = await supabase.from('delivery_appointments').update({ status: status as any }).eq('id', appointmentId);
    if (!error) {
      await supabase.from('delivery_tour_stops')
        .update({
          stop_status: status as any,
          ...(status === 'angekommen' ? { actual_arrival: new Date().toISOString() } : {}),
        })
        .eq('id', stopId!);
    }
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success('Status aktualisiert');
    setStop((s: any) => ({ ...s, delivery_appointments: { ...s.delivery_appointments, status } }));
  };

  const saveDelay = async () => {
    const min = parseInt(delay, 10);
    if (Number.isNaN(min)) return toast.error('Bitte Minuten angeben.');
    setBusy(true);
    const { error } = await supabase.from('delivery_tour_stops')
      .update({ delay_minutes: min, delay_reason: note || null })
      .eq('id', stopId!);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Verzögerung ${min} Min. gemeldet`);
  };

  const uploadPhotos = async (category: string): Promise<string[]> => {
    const paths: string[] = [];
    const { data: u } = await supabase.auth.getUser();
    for (const f of photos) {
      const path = `${tourId}/${stopId}/${Date.now()}-${f.name.replace(/[^\w.-]/g, '_')}`;
      const { error } = await supabase.storage.from('dispatch-mobile').upload(path, f, { upsert: true });
      if (error) throw error;
      await supabase.from('delivery_photos').insert({
        appointment_id: appointmentId,
        tour_id: tourId!,
        storage_path: path,
        category,
        caption: note || null,
        created_by: u.user?.id ?? null,
      });
      paths.push(path);
    }
    return paths;
  };

  const completeDelivery = async () => {
    if (!padRef.current || padRef.current.isEmpty()) return toast.error('Bitte Unterschrift des Kunden erfassen.');
    if (!signer.trim()) return toast.error('Bitte Name des Unterzeichners angeben.');
    setBusy(true);
    try {
      const dataUrl = padRef.current.toDataURL('image/png');
      const blob = await (await fetch(dataUrl)).blob();
      const sigPath = `${tourId}/${stopId}/signature-${Date.now()}.png`;
      const { error: sErr } = await supabase.storage.from('dispatch-mobile').upload(sigPath, blob, { upsert: true, contentType: 'image/png' });
      if (sErr) throw sErr;
      await uploadPhotos('uebergabe');
      const { data: u } = await supabase.auth.getUser();

      const { error } = await supabase.from('delivery_signatures').insert({
        appointment_id: appointmentId,
        signer_name: signer.trim(),
        signer_role: 'kunde',
        signature_path: sigPath,
        created_by: u.user?.id ?? null,
      });
      if (error) throw error;

      const { error: aErr } = await supabase.from('delivery_appointments')
        .update({
          status: 'erfolgreich_ausgeliefert',
          delivered_at: new Date().toISOString(),
          serial_number: serial || null,
          internal_notes: note || null,
        })
        .eq('id', appointmentId);
      if (aErr) throw aErr;

      await supabase.from('delivery_tour_stops')
        .update({ stop_status: 'erfolgreich_ausgeliefert', actual_departure: new Date().toISOString() })
        .eq('id', stopId!);

      toast.success('Übergabe dokumentiert');
      navigate(`/m/tour/${tourId}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const reportFailure = async () => {
    setBusy(true);
    try {
      await uploadPhotos('vorfall');
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from('delivery_incidents').insert({
        tour_id: tourId!,
        appointment_id: appointmentId,
        incident_type: 'lieferung_fehlgeschlagen',
        reason_code: reason,
        description: note || null,
        created_by: u.user?.id ?? null,
      });
      if (error) throw error;
      const newStatus = reason === 'nicht_angetroffen' ? 'nicht_angetroffen' : 'lieferung_fehlgeschlagen';
      await supabase.from('delivery_appointments')
        .update({ status: newStatus as any, failure_reason: reason })
        .eq('id', appointmentId);
      await supabase.from('delivery_tour_stops').update({ stop_status: newStatus as any }).eq('id', stopId!);
      toast.success('Vorfall gemeldet');
      navigate(`/m/tour/${tourId}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!stop) return <div className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>;
  const a = stop.delivery_appointments;

  return (
    <div className="p-4 space-y-4">
      <Link to={`/m/tour/${tourId}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="w-4 h-4" /> Tour
      </Link>
      <div>
        <h1 className="text-xl font-bold">{a?.customer_name}</h1>
        <div className="text-xs text-muted-foreground">
          {a?.order_number} · {a?.device_name} · {[a?.delivery_street, a?.delivery_zip, a?.delivery_city].filter(Boolean).join(' ')}
        </div>
      </div>

      <Card className="p-4 space-y-2">
        <Label>Status</Label>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-11" disabled={busy} onClick={() => setAppointmentStatus('unterwegs')}>Unterwegs</Button>
          <Button variant="outline" className="h-11" disabled={busy} onClick={() => setAppointmentStatus('angekommen')}>Angekommen</Button>
          <Button variant="outline" className="h-11 col-span-2" disabled={busy} onClick={() => setAppointmentStatus('lieferung_begonnen')}>Lieferung begonnen</Button>
        </div>
        <div className="flex gap-2 pt-1">
          <Input inputMode="numeric" placeholder="Verzögerung in Min." value={delay} onChange={e => setDelay(e.target.value)} />
          <Button variant="outline" className="h-10 shrink-0" onClick={saveDelay} disabled={busy}>
            <Clock className="w-4 h-4 mr-1" /> melden
          </Button>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="font-semibold flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Übergabe</div>
        <div>
          <Label>Seriennummer</Label>
          <Input value={serial} onChange={e => setSerial(e.target.value)} placeholder="Seriennummer Gerät" />
        </div>
        <div>
          <Label>Unterzeichner</Label>
          <Input value={signer} onChange={e => setSigner(e.target.value)} placeholder="Name Kunde" />
        </div>
        <div>
          <Label>Bemerkung</Label>
          <Textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="optional" />
        </div>
        <div>
          <Label className="flex items-center gap-1"><Camera className="w-4 h-4" /> Fotos</Label>
          <Input type="file" accept="image/*" multiple capture="environment"
            onChange={e => setPhotos(Array.from(e.target.files ?? []))} />
          {photos.length > 0 && <div className="text-xs text-muted-foreground mt-1">{photos.length} Foto(s) ausgewählt</div>}
        </div>
        <div className="rounded-md border border-border bg-secondary/40 relative">
          <canvas ref={canvasRef} className="w-full h-48 touch-none" />
          {!hasInk && (
            <div className="absolute inset-0 grid place-items-center pointer-events-none text-xs text-muted-foreground">
              Unterschrift Kunde
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="h-11 flex-1" onClick={() => { padRef.current?.clear(); setHasInk(false); }} disabled={!hasInk}>
            <Eraser className="w-4 h-4 mr-1" /> löschen
          </Button>
          <Button className="h-11 flex-1" onClick={completeDelivery} disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
            Abschließen
          </Button>
        </div>
      </Card>

      <Card className="p-4 space-y-3 border-destructive/30">
        <div className="font-semibold flex items-center gap-2"><XCircle className="w-4 h-4 text-destructive" /> Lieferung nicht möglich</div>
        <Select value={reason} onValueChange={setReason}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {FAIL_REASONS.map(r => <SelectItem key={r.v} value={r.v}>{r.l}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="destructive" className="h-11 w-full" onClick={reportFailure} disabled={busy}>
          Vorfall melden
        </Button>
      </Card>
    </div>
  );
}

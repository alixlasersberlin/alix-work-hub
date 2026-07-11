import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { BookingLayout } from '@/components/esc/public/BookingLayout';
import { SignaturePad } from '@/components/esc/SignaturePad';
import { useAppointments } from '@/hooks/esc/useAppointments';
import { supabase } from '@/integrations/supabase/client';
import { generateCheckinPdf } from '@/lib/esc/checkin-pdf';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { toast } from 'sonner';
import { CalendarCheck, Clock, MapPin, Download, MapPinned } from 'lucide-react';

export default function Checkin() {
  const { token } = useParams();
  const { appointments } = useAppointments();
  const appointment = useMemo(
    () => appointments.find((a) => a.confirmationToken === token) || appointments[0],
    [appointments, token],
  );

  const [name, setName] = useState('');
  const [role, setRole] = useState<'customer' | 'technician'>('customer');
  const [notes, setNotes] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [geo, setGeo] = useState<{ lat?: number; lng?: number }>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setGeo({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { enableHighAccuracy: false, timeout: 4000 },
    );
  }, []);

  if (!appointment) {
    return (
      <BookingLayout narrow>
        <Card><CardHeader><CardTitle>Termin nicht gefunden</CardTitle></CardHeader></Card>
      </BookingLayout>
    );
  }

  const submit = async () => {
    if (!name.trim() || !signature) {
      toast.error('Name und Unterschrift erforderlich');
      return;
    }
    setSaving(true);
    const checkinAt = new Date().toISOString();
    try {
      const { error } = await supabase.from('esc_signatures').insert({
        event_id: appointment.id,
        signer_name: name.trim(),
        signer_role: role,
        signature_data_url: signature,
        checkin_at: checkinAt,
        geo_lat: geo.lat ?? null,
        geo_lng: geo.lng ?? null,
        notes: notes.trim() || null,
      });
      if (error) throw error;

      // Trigger PDF download
      const blob = generateCheckinPdf({
        appointment,
        signerName: name.trim(),
        signerRole: role === 'customer' ? 'Kunde' : 'Techniker',
        signatureDataUrl: signature,
        checkinAt,
        notes: notes.trim(),
        geo,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Termin-Protokoll_${appointment.id.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      setDone(true);
      toast.success('Check-in erfolgreich');
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? 'Check-in fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BookingLayout narrow>
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="text-[17px] flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-primary" /> Check-in
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-[13.5px]">
          <div className="rounded-md border p-3 bg-muted/30 space-y-1">
            <div className="font-medium">{appointment.title}</div>
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              {format(new Date(appointment.startAt), 'EEEE, dd. MMMM yyyy • HH:mm', { locale: de })} – {format(new Date(appointment.endAt), 'HH:mm')}
            </div>
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <MapPin className="w-3.5 h-3.5" />
              {appointment.location || appointment.address || '—'}
            </div>
          </div>

          {done ? (
            <div className="rounded-md border p-6 text-center bg-primary/5">
              <CalendarCheck className="w-8 h-8 mx-auto text-primary mb-2" />
              <div className="font-medium mb-1">Check-in gespeichert</div>
              <div className="text-[12px] text-muted-foreground">Das Protokoll wurde als PDF geladen.</div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <Label>Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Vor- und Nachname" />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={role === 'customer' ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1"
                    onClick={() => setRole('customer')}
                  >Kunde</Button>
                  <Button
                    type="button"
                    variant={role === 'technician' ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1"
                    onClick={() => setRole('technician')}
                  >Techniker</Button>
                </div>
                <div>
                  <Label>Notizen (optional)</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
                </div>
                {geo.lat && geo.lng && (
                  <div className="flex items-center gap-1 text-[11.5px] text-muted-foreground">
                    <MapPinned className="w-3 h-3" /> Geo: {geo.lat.toFixed(4)}, {geo.lng.toFixed(4)}
                  </div>
                )}
                <SignaturePad label="Bitte hier unterschreiben" onCapture={(d) => { setSignature(d); toast.success('Unterschrift übernommen'); }} />
                {signature && (
                  <img src={signature} alt="Unterschrift" className="h-16 border rounded bg-white p-1" />
                )}
              </div>

              <Button className="w-full min-h-11" onClick={submit} disabled={saving}>
                <Download className="w-4 h-4 mr-1" />
                {saving ? 'Speichern…' : 'Check-in & Protokoll herunterladen'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </BookingLayout>
  );
}

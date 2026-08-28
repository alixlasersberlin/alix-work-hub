import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CalendarCheck, CalendarClock, CheckCircle2, Loader2 } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { de } from 'date-fns/locale';

interface Creds {
  order_number: string;
  zip: string;
  email: string;
}

interface Props {
  creds: Creds | null;
  plannedDate: string | null;
  state: {
    response: 'confirmed' | 'change_requested' | null;
    responded_at: string | null;
    alternative_date: string | null;
    can_confirm: boolean;
  } | null | undefined;
}

function fmt(v?: string | null) {
  if (!v) return null;
  const dt = parseISO(v);
  return isValid(dt) ? format(dt, 'EEEE, dd. MMMM yyyy', { locale: de }) : null;
}

export function DeliveryConfirm({ creds, plannedDate, state }: Props) {
  const [mode, setMode] = useState<'idle' | 'change'>('idle');
  const [alt, setAlt] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<'confirmed' | 'change_requested' | null>(state?.response ?? null);
  const [error, setError] = useState('');

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  async function submit(response: 'confirmed' | 'change_requested') {
    if (!creds) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/portal-delivery-confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: anonKey, Authorization: `Bearer ${anonKey}` },
        body: JSON.stringify({
          ...creds,
          response,
          note: note || undefined,
          alternative_date: response === 'change_requested' && alt ? alt : undefined,
        }),
      });
      const data = await res.json();
      if (!data?.ok) {
        setError('Ihre Rückmeldung konnte nicht gespeichert werden. Bitte versuchen Sie es später erneut.');
      } else {
        setDone(response);
      }
    } catch {
      setError('Verbindung fehlgeschlagen. Bitte versuchen Sie es erneut.');
    }
    setBusy(false);
  }

  if (done) {
    return (
      <Card className="border-primary/30">
        <CardContent className="p-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div className="text-sm">
            <div className="font-medium">
              {done === 'confirmed' ? 'Vielen Dank – Ihr Liefertermin ist bestätigt.' : 'Vielen Dank – Ihre Terminanfrage ist bei uns eingegangen.'}
            </div>
            <p className="text-muted-foreground mt-1">
              {done === 'confirmed'
                ? 'Wir melden uns, sobald die Tour final geplant ist.'
                : 'Unsere Tourenplanung setzt sich zeitnah mit Ihnen in Verbindung.'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!creds || !state?.can_confirm) return null;

  return (
    <Card className="border-primary/30">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <CalendarCheck className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div className="text-sm">
            <div className="font-medium">Passt Ihnen dieser Liefertermin?</div>
            <p className="text-muted-foreground">
              {fmt(plannedDate) ? `Vorgeschlagen: ${fmt(plannedDate)}` : 'Bitte bestätigen Sie unseren Terminvorschlag.'}
            </p>
          </div>
        </div>

        {mode === 'idle' ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => submit('confirmed')} disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <CalendarCheck className="w-4 h-4 mr-1.5" />}
              Termin bestätigen
            </Button>
            <Button size="sm" variant="outline" onClick={() => setMode('change')} disabled={busy}>
              <CalendarClock className="w-4 h-4 mr-1.5" /> Anderen Termin wünschen
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Wunschtermin (optional)</Label>
              <Input type="date" value={alt} onChange={(e) => setAlt(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Ihre Nachricht (optional)</Label>
              <Textarea rows={3} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => submit('change_requested')} disabled={busy}>
                {busy && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />} Anfrage senden
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setMode('idle')} disabled={busy}>Abbrechen</Button>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

export default DeliveryConfirm;

import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, Search, ShieldCheck } from 'lucide-react';
import { BookingLayout } from '@/components/esc/public/BookingLayout';
import { Card, CardContent } from '@/components/ui/card';
import { CheckSequence } from '@/components/portal/check/CheckSequence';
import '@/styles/delivery-check.css';

export default function PortalLookup() {
  const navigate = useNavigate();
  const [orderNumber, setOrderNumber] = useState('');
  const [zip, setZip] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sequence, setSequence] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lookupRef = useRef<Promise<any | null> | null>(null);

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!orderNumber.trim() || !zip.trim() || !email.trim()) {
      setError('Bitte füllen Sie alle Felder aus.');
      return;
    }
    setLoading(true);
    setSequence(true);
    lookupRef.current = (async () => {
      try {
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/customer-portal-lookup`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: anonKey,
              Authorization: `Bearer ${anonKey}`,
            },
            body: JSON.stringify({ order_number: orderNumber, zip, email }),
          },
        );
        const data = await res.json();
        return data?.ok ? data : null;
      } catch {
        return 'error';
      }
    })();
  }

  // Ladeanimation wie unter /portal/check – Ergebnis erst nach Abschluss zeigen.
  const finishSequence = useCallback(async () => {
    const data = await (lookupRef.current ?? Promise.resolve(null));
    setSequence(false);
    setLoading(false);
    if (data === 'error') {
      setError('Verbindung fehlgeschlagen. Bitte versuchen Sie es erneut.');
      return;
    }
    if (!data) {
      setError('Die eingegebenen Daten konnten keiner Bestellung zugeordnet werden. Bitte prüfen Sie Ihre Angaben oder kontaktieren Sie unseren Support.');
      return;
    }
    sessionStorage.setItem('alix_portal_status', JSON.stringify(data));
    sessionStorage.setItem('alix_portal_creds', JSON.stringify({ order_number: orderNumber, zip, email }));
    navigate('/portal/status');
  }, [navigate, orderNumber, zip, email]);

  return (
    <BookingLayout hideLegalLinks narrow step={1} totalSteps={2}>
      {sequence && <CheckSequence onDone={finishSequence} />}
      <div className={sequence ? 'hidden' : undefined}>
      <div className="mb-2">
        <Button variant="ghost" size="sm" onClick={() => navigate('/book')} className="-ml-2">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Zurück
        </Button>
      </div>
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 sm:p-6 space-y-3 text-sm text-muted-foreground">
        <p>Die angezeigten Lieferzeiten und Termine sind Richtwerte auf Basis unseres aktuellen Produktionsablaufs.</p>
        <p>Alle Systeme von Alix Lasers werden individuell in Handfertigung gefertigt, konfiguriert und vor der Auslieferung geprüft. Dadurch können sich einzelne Produktions- und Liefertermine verschieben.</p>
        <p>Im Zuge der aktuellen Systemumstellung auf AlixSmart KI kann das derzeit angezeigte Lieferdatum vorübergehend vom tatsächlichen Produktionsstatus Ihres Auftrags abweichen.</p>
        <p>Aktuell überprüfen wir daher jeden Auftrag manuell, gleichen den jeweiligen Produktionsfortschritt ab und aktualisieren die Liefertermine schrittweise.</p>
        <p>
          <span className="font-medium text-foreground">Für Sie bedeutet das:</span> Ihr angezeigter Termin wird derzeit geprüft und bei Bedarf an den tatsächlichen Produktionsstatus angepasst.
        </p>
        <p>Vielen Dank für Ihr Verständnis.</p>
      </div>


      <div className="text-center mb-2 mt-6 dc-reveal">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Bestellstatus abfragen</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Geben Sie Ihre Auftragsdaten ein, um den aktuellen Bearbeitungsstand einzusehen.
        </p>
      </div>


      <Card className="dc-reveal dc-d2">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="order">Auftragsnummer</Label>
              <Input id="order" value={orderNumber} onChange={e => setOrderNumber(e.target.value)} placeholder="z.B. SO-1234" className="mt-1.5" autoComplete="off" />
            </div>
            <div>
              <Label htmlFor="zip">Postleitzahl</Label>
              <Input id="zip" value={zip} onChange={e => setZip(e.target.value)} placeholder="z.B. 41160" className="mt-1.5" autoComplete="postal-code" inputMode="numeric" />
            </div>
            <div>
              <Label htmlFor="email">E-Mail-Adresse</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ihre@email.de" className="mt-1.5" autoComplete="email" />
            </div>

            {error && (
              <div className="text-sm font-medium text-destructive-foreground bg-destructive/90 border border-destructive rounded-md p-3 shadow-sm">
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full h-11">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Search className="w-4 h-4 mr-2" /> Status abfragen</>}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
        <p>
          Ihre Daten werden ausschließlich zur Statusabfrage verwendet und nicht gespeichert.
          Es werden keine Zahlungs- oder Vertragsdetails öffentlich angezeigt. Weitere Informationen finden Sie in unserer{' '}
          <a href="https://alix-lasers.de/datenschutz" className="underline hover:text-primary">Datenschutzerklärung</a>.
        </p>
      </div>
      </div>
    </BookingLayout>
  );
}

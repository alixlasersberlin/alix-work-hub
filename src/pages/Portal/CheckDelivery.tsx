import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight, LifeBuoy, RotateCcw, Search, ShieldCheck } from 'lucide-react';
import { BookingLayout } from '@/components/esc/public/BookingLayout';
import { CheckSequence } from '@/components/portal/check/CheckSequence';
import { DeliveryResult, type CheckResult } from '@/components/portal/check/DeliveryResult';
import '@/styles/delivery-check.css';

type Mode = 'form' | 'sequence' | 'result' | 'notfound';

export default function CheckDelivery() {
  const navigate = useNavigate();
  const [orderNumber, setOrderNumber] = useState('');
  const [zip, setZip] = useState('');
  const [email, setEmail] = useState('');
  const [mode, setMode] = useState<Mode>('form');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [pending, setPending] = useState<CheckResult | null>(null);

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!orderNumber.trim() || !zip.trim() || !email.trim()) {
      setError('Bitte füllen Sie alle Felder aus.');
      return;
    }
    setMode('sequence');
    setPending(null);
    try {
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/customer-portal-lookup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({ order_number: orderNumber.trim(), zip: zip.trim(), email: email.trim() }),
      });
      const data = await res.json();
      if (!data?.ok) {
        setPending(null);
        return;
      }
      setPending(data as CheckResult);
    } catch {
      setPending(null);
    }
  }

  const finishSequence = useCallback(() => {
    if (pending) {
      setResult(pending);
      setMode('result');
    } else {
      setMode('notfound');
    }
  }, [pending]);

  function reset() {
    setResult(null);
    setPending(null);
    setMode('form');
  }

  return (
    <BookingLayout hideLegalLinks narrow>
      {mode === 'sequence' && <CheckSequence onDone={finishSequence} />}

      {mode === 'form' && (
        <div className="space-y-6">
          <div className="text-center pt-2 dc-reveal">
            <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight leading-tight">
              Wann kommt mein ALIX?
            </h1>
            <p className="text-muted-foreground mt-3">Lieferstatus in wenigen Sekunden prüfen.</p>
          </div>

          <Card className="border-primary/20 dc-reveal dc-d2">
            <CardContent className="p-6 sm:p-8">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="dc-order">Auftrags- oder Kundennummer</Label>
                  <Input
                    id="dc-order"
                    value={orderNumber}
                    onChange={e => setOrderNumber(e.target.value)}
                    placeholder="z. B. AB-2026-04305"
                    className="mt-1.5 h-12 text-base"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <Label htmlFor="dc-zip">Postleitzahl</Label>
                  <Input
                    id="dc-zip"
                    value={zip}
                    onChange={e => setZip(e.target.value)}
                    placeholder="z. B. 12529"
                    className="mt-1.5 h-12 text-base"
                    inputMode="numeric"
                    autoComplete="postal-code"
                  />
                </div>
                <div>
                  <Label htmlFor="dc-email">E-Mail-Adresse zur Verifizierung</Label>
                  <Input
                    id="dc-email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="ihre@email.de"
                    className="mt-1.5 h-12 text-base"
                    autoComplete="email"
                  />
                </div>

                {error && <p className="text-sm text-destructive font-medium">{error}</p>}

                <Button
                  type="submit"
                  className="w-full h-14 text-base tracking-wide transition-transform duration-200 hover:scale-[1.015] active:scale-[0.99]"
                >
                  <Search className="w-4 h-4 mr-2" /> LIEFERSTATUS PRÜFEN
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="flex items-start gap-2 text-xs text-muted-foreground dc-fade dc-d3">
            <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
            <p>Ihre Angaben werden ausschließlich zur Statusabfrage verwendet.</p>
          </div>
        </div>
      )}

      {mode === 'result' && result && (
        <div className="space-y-6">
          <DeliveryResult data={result} />
          <div className="text-center">
            <Button variant="outline" onClick={reset}>
              <RotateCcw className="w-4 h-4 mr-2" /> Neue Abfrage
            </Button>
          </div>
        </div>
      )}

      {mode === 'notfound' && (
        <div className="py-10 text-center dc-reveal">
          <h2 className="text-2xl font-semibold tracking-tight">Wir konnten den Auftrag nicht finden.</h2>
          <p className="text-muted-foreground mt-3 max-w-sm mx-auto">
            Bitte prüfen Sie Ihre Auftragsnummer und versuchen Sie es erneut.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={reset}>
              <RotateCcw className="w-4 h-4 mr-2" /> Erneut versuchen
            </Button>
            <Button variant="outline" onClick={() => navigate('/portal')}>
              <LifeBuoy className="w-4 h-4 mr-2" /> Klassische Statusabfrage
            </Button>
          </div>
        </div>
      )}
    </BookingLayout>
  );
}

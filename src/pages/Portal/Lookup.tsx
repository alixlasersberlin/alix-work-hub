import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, Search, ShieldCheck } from 'lucide-react';
import { BookingLayout } from '@/components/esc/public/BookingLayout';
import { Card, CardContent } from '@/components/ui/card';

export default function PortalLookup() {
  const navigate = useNavigate();
  const [orderNumber, setOrderNumber] = useState('');
  const [zip, setZip] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      if (!data?.ok) {
        setError('Die eingegebenen Daten konnten keiner Bestellung zugeordnet werden. Bitte prüfen Sie Ihre Angaben oder kontaktieren Sie unseren Support.');
        setLoading(false);
        return;
      }
      sessionStorage.setItem('alix_portal_status', JSON.stringify(data));
      navigate('/portal/status');
    } catch {
      setError('Verbindung fehlgeschlagen. Bitte versuchen Sie es erneut.');
      setLoading(false);
    }
  }

  return (
    <BookingLayout hideLegalLinks narrow step={1} totalSteps={2}>
      <div className="text-center mb-2">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Bestellstatus abfragen</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Geben Sie Ihre Auftragsdaten ein, um den aktuellen Bearbeitungsstand einzusehen.
        </p>
      </div>

      <Card>
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
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md p-3">
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
    </BookingLayout>
  );
}

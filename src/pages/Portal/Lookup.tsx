import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Search, ShieldCheck } from 'lucide-react';

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
    <div className="min-h-screen bg-white text-slate-900 flex flex-col">
      <header className="border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-display font-bold text-lg">A</div>
            <div>
              <div className="font-display font-bold text-lg leading-none">Alix Lasers</div>
              <div className="text-xs text-slate-500 mt-0.5">Kundenportal · Statusabfrage</div>
            </div>
          </div>
          <a href="https://alix-lasers.de" className="text-xs text-slate-500 hover:text-slate-900 hidden sm:inline">alix-lasers.de</a>
        </div>
      </header>

      <main className="flex-1 px-6 py-12">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900">Bestellstatus abfragen</h1>
            <p className="text-sm text-slate-600 mt-2">
              Geben Sie Ihre Auftragsdaten ein, um den aktuellen Bearbeitungsstand einzusehen.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
            <div>
              <Label htmlFor="order" className="text-slate-700">Auftragsnummer</Label>
              <Input id="order" value={orderNumber} onChange={e => setOrderNumber(e.target.value)} placeholder="z.B. SO-1234" className="mt-1.5 bg-white border-slate-300 text-slate-900" autoComplete="off" />
            </div>
            <div>
              <Label htmlFor="zip" className="text-slate-700">Postleitzahl</Label>
              <Input id="zip" value={zip} onChange={e => setZip(e.target.value)} placeholder="z.B. 41160" className="mt-1.5 bg-white border-slate-300 text-slate-900" autoComplete="postal-code" inputMode="numeric" />
            </div>
            <div>
              <Label htmlFor="email" className="text-slate-700">E-Mail-Adresse</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ihre@email.de" className="mt-1.5 bg-white border-slate-300 text-slate-900" autoComplete="email" />
            </div>

            {error && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full bg-slate-900 hover:bg-slate-800 text-white h-11">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Search className="w-4 h-4 mr-2" /> Status abfragen</>}
            </Button>
          </form>

          <div className="mt-6 flex items-start gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
            <p>
              Ihre Daten werden ausschließlich zur Statusabfrage verwendet und nicht gespeichert.
              Es werden keine Zahlungs- oder Vertragsdetails öffentlich angezeigt. Weitere Informationen finden Sie in unserer{' '}
              <a href="https://alix-lasers.de/datenschutz" className="underline hover:text-slate-700">Datenschutzerklärung</a>.
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 py-4">
        <div className="max-w-3xl mx-auto px-6 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} Alix Lasers GmbH · Bei Fragen kontaktieren Sie bitte unseren Support.
        </div>
      </footer>
    </div>
  );
}

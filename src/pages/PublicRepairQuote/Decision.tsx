import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export default function PublicRepairQuoteDecision() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<'accept' | 'reject' | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      const { data, error } = await supabase.functions.invoke('repair-quote-decision', { body: { token, action: 'view' } });
      if (error) setError(error.message);
      else if ((data as any)?.error) setError((data as any).error);
      else setData(data);
      setLoading(false);
    })();
  }, [token]);

  const submit = async (action: 'accept' | 'reject') => {
    if (!email.trim()) { setError('Bitte E-Mail-Adresse angeben'); return; }
    setSubmitting(true);
    setError(null);
    const { data: res, error } = await supabase.functions.invoke('repair-quote-decision', {
      body: { token, action, email: email.trim(), note: note.trim() || null },
    });
    setSubmitting(false);
    if (error || (res as any)?.error) { setError(error?.message || (res as any).error); return; }
    setDone(action);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (error && !data) {
    return <div className="min-h-screen flex items-center justify-center p-4 bg-background"><Card className="p-8 max-w-md text-center"><XCircle className="w-12 h-12 mx-auto text-destructive mb-3" /><p>{error}</p></Card></div>;
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="p-8 max-w-md text-center space-y-3">
          {done === 'accept' ? <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500" /> : <XCircle className="w-12 h-12 mx-auto text-destructive" />}
          <h2 className="text-xl font-bold">{done === 'accept' ? 'Vielen Dank für Ihre Freigabe!' : 'Kostenvoranschlag abgelehnt'}</h2>
          <p className="text-sm text-muted-foreground">{done === 'accept' ? 'Wir starten umgehend mit der Reparatur und melden uns nach Fertigstellung.' : 'Wir haben Ihre Rückmeldung erhalten. Unser Service-Team wird sich mit Ihnen in Verbindung setzen.'}</p>
        </Card>
      </div>
    );
  }

  const q = data?.quote;
  const r = data?.repair;
  const items = data?.items || [];

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-4">
        <Card className="p-6">
          <h1 className="text-2xl font-bold">Kostenvoranschlag {q?.quote_number}</h1>
          <p className="text-sm text-muted-foreground">Reparatur {r?.repair_number} · {r?.customer_name}</p>
          <p className="text-sm mt-2">Gerät: <b>{[r?.device_brand, r?.device_model].filter(Boolean).join(' ') || '–'}</b> · S/N {r?.device_serial_number || '–'}</p>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold mb-3">Positionen</h2>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground"><tr><th className="text-left py-2">Beschreibung</th><th className="text-right">Menge</th><th className="text-right">Einzelpreis</th><th className="text-right">Summe</th></tr></thead>
            <tbody>
              {items.map((i: any) => (
                <tr key={i.id} className="border-t border-border">
                  <td className="py-2">{i.description}</td>
                  <td className="text-right">{Number(i.quantity).toLocaleString('de-DE')}</td>
                  <td className="text-right">{Number(i.unit_price).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td>
                  <td className="text-right">{Number(i.line_total).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 text-right space-y-1 text-sm">
            <div>Netto: <b>{Number(q?.total_net || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</b></div>
            <div>MwSt. ({q?.vat_rate}%): {(Number(q?.total_gross || 0) - Number(q?.total_net || 0)).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</div>
            <div className="text-xl font-bold">Gesamt brutto: {Number(q?.total_gross || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</div>
          </div>
          {q?.customer_note && <div className="mt-4 p-3 rounded bg-muted text-sm whitespace-pre-wrap">{q.customer_note}</div>}
        </Card>

        {q?.status === 'Versendet' ? (
          <Card className="p-6 space-y-3">
            <h2 className="font-semibold">Ihre Entscheidung</h2>
            <div><Label>Ihre E-Mail-Adresse (Bestätigung)</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@firma.de" /></div>
            <div><Label>Anmerkung (optional)</Label><Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => submit('reject')} disabled={submitting}><XCircle className="w-4 h-4 mr-1" />Ablehnen</Button>
              <Button onClick={() => submit('accept')} disabled={submitting}><CheckCircle2 className="w-4 h-4 mr-1" />Reparatur freigeben</Button>
            </div>
          </Card>
        ) : (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            Status: <b>{q?.status}</b>{q?.decided_at && <> · entschieden am {new Date(q.decided_at).toLocaleString('de-DE')}</>}
          </Card>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CalendarClock, CheckCircle2, CreditCard, PenLine, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import SignaturePad from '@/components/finance/SignaturePad';

const fmt = (n: any, cur = 'EUR') =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: cur || 'EUR' }).format(Number(n ?? 0));
const d = (v: any) => (v ? new Date(v).toLocaleDateString('de-DE') : '—');

export default function PortalZahlung() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<any>(null);
  const [done, setDone] = useState<string | null>(null);

  const [promiseDate, setPromiseDate] = useState('');
  const [promiseAmount, setPromiseAmount] = useState('');
  const [months, setMonths] = useState('3');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [signedName, setSignedName] = useState('');


  useEffect(() => {
    document.title = 'Offene Posten – Alix Lasers ®';
    const meta = document.querySelector('meta[name="robots"]') ?? document.createElement('meta');
    meta.setAttribute('name', 'robots');
    meta.setAttribute('content', 'noindex,nofollow');
    document.head.appendChild(meta);
  }, []);

  useEffect(() => {
    (async () => {
      if (!token) { setError('Ungültiger Link'); setLoading(false); return; }
      const { data, error: err } = await supabase.functions.invoke('collect-portal-pay', {
        body: { token, action: 'view' },
      });
      if (err) { setError('Dieser Link ist ungültig oder abgelaufen.'); setLoading(false); return; }
      if ((data as any)?.error) { setError((data as any).error); setLoading(false); return; }
      setInfo(data);
      setPromiseAmount(String((data as any)?.amount ?? ''));
      setLoading(false);
    })();
  }, [token]);

  const act = async (action: string, payload: Record<string, unknown>) => {
    setBusy(true);
    const { data, error: err } = await supabase.functions.invoke('collect-portal-pay', {
      body: { token, action, ...payload },
    });
    setBusy(false);
    if (err || (data as any)?.error) {
      toast({ title: 'Fehler', description: (data as any)?.error ?? err?.message, variant: 'destructive' });
      return;
    }
    setDone((data as any)?.message ?? 'Vielen Dank.');
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Wird geladen…</div>;
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="max-w-md">
          <CardHeader><CardTitle>Link nicht verfügbar</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {error} Bitte wenden Sie sich an <a className="underline" href="mailto:finance@alixwork.de">finance@alixwork.de</a>.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Alix Lasers ®</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Offene Posten für {info?.customer_name ?? 'Ihr Kundenkonto'}
          </p>
        </header>

        {done ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              <p className="text-lg font-medium">{done}</p>
              <p className="text-sm text-muted-foreground">Sie können dieses Fenster nun schließen.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CreditCard className="h-4 w-4" /> Gesamtsaldo {fmt(info?.amount, info?.currency)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-2 pr-3">Rechnung</th>
                        <th className="py-2 pr-3">Datum</th>
                        <th className="py-2 pr-3">Fällig</th>
                        <th className="py-2 pr-3 text-right">Betrag</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(info?.items ?? []).map((i: any, idx: number) => (
                        <tr key={idx} className="border-b border-border/50">
                          <td className="py-2 pr-3">{i.invoice_number ?? '—'}</td>
                          <td className="py-2 pr-3">{d(i.invoice_date)}</td>
                          <td className="py-2 pr-3">{d(i.due_date)}</td>
                          <td className="py-2 pr-3 text-right">{fmt(i.balance, i.currency ?? info?.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  Bitte überweisen Sie den offenen Betrag auf das Konto aus Ihrer Rechnung und geben Sie die
                  Rechnungsnummer als Verwendungszweck an. Alternativ können Sie unten eine Zahlungszusage hinterlegen.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarClock className="h-4 w-4" /> Zahlung ankündigen
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Zahlungsdatum</label>
                  <Input type="date" value={promiseDate} onChange={(e) => setPromiseDate(e.target.value)} className="w-44" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Betrag</label>
                  <Input value={promiseAmount} onChange={(e) => setPromiseAmount(e.target.value)} className="w-36" />
                </div>
                <Button
                  disabled={busy}
                  onClick={() => act('promise', { date: promiseDate, amount: Number(promiseAmount.replace(',', '.')) })}
                >
                  Zusage senden
                </Button>
              </CardContent>
            </Card>

            {info?.plan && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <PenLine className="h-4 w-4" /> Ratenvereinbarung
                    {info.plan.signed_at ? ' (unterschrieben)' : ' unterschreiben'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                    <div><div className="text-xs text-muted-foreground">Gesamt</div>{fmt(info.plan.total_amount, info.plan.currency)}</div>
                    <div><div className="text-xs text-muted-foreground">Anzahlung</div>{fmt(info.plan.downpayment, info.plan.currency)}</div>
                    <div><div className="text-xs text-muted-foreground">Monatsrate</div>{fmt(info.plan.monthly_amount, info.plan.currency)}</div>
                    <div><div className="text-xs text-muted-foreground">Laufzeit</div>{info.plan.term_months ?? 0} Monate</div>
                  </div>

                  {(info.plan.items ?? []).length > 0 && (
                    <div className="max-h-56 overflow-y-auto rounded-md border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="px-3 py-2">Rate</th>
                            <th className="px-3 py-2">Fällig</th>
                            <th className="px-3 py-2 text-right">Betrag</th>
                          </tr>
                        </thead>
                        <tbody>
                          {info.plan.items.map((r: any) => (
                            <tr key={r.seq} className="border-b border-border/50">
                              <td className="px-3 py-1.5">{r.seq}</td>
                              <td className="px-3 py-1.5">{d(r.due_date)}</td>
                              <td className="px-3 py-1.5 text-right">{fmt(r.amount, info.plan.currency)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {info.plan.signed_at ? (
                    <p className="text-sm text-muted-foreground">
                      Unterschrieben am {d(info.plan.signed_at)} von {info.plan.signed_name ?? '—'}.
                    </p>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Mit Ihrer Unterschrift erkennen Sie die offene Forderung an und verpflichten sich zur Zahlung
                        der oben aufgeführten Raten.
                      </p>
                      <Input
                        placeholder="Vor- und Nachname"
                        value={signedName}
                        onChange={(e) => setSignedName(e.target.value)}
                        className="max-w-sm"
                      />
                      <SignaturePad onChange={setSignature} />
                      <Button
                        disabled={busy || !signature || signedName.trim().length < 3}
                        onClick={() => act('plan_sign', { signature, signed_name: signedName })}
                      >
                        Rechtsverbindlich unterschreiben
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            )}


            {info?.allow_installments && (
              <Card>
                <CardHeader><CardTitle className="text-base">Ratenzahlung beantragen</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-end gap-3">
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Anzahl Raten</label>
                      <Select value={months} onValueChange={setMonths}>
                        <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[2, 3, 4, 6, 9, 12, 18, 24].map((m) => (
                            <SelectItem key={m} value={String(m)}>{m} Raten</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      ca. {fmt(Number(info?.amount ?? 0) / Number(months || 1), info?.currency)} pro Rate
                    </div>
                  </div>
                  <Textarea rows={3} placeholder="Anmerkung (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
                  <Button disabled={busy} onClick={() => act('installment_request', { months: Number(months), note })}>
                    Antrag senden
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}

        <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-3 w-3" /> Gesicherte Verbindung · Alix Lasers ® Forderungsmanagement
        </p>
      </div>
    </div>
  );
}

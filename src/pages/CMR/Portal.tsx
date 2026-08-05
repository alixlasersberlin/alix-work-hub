import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText, AlertCircle } from 'lucide-react';

const money = (n: number, c: string) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: c || 'AED' }).format(Number(n || 0));

/**
 * Öffentliches CMR-Kundenportal: zeigt einem Kunden per Zugangslink seine Belege,
 * offenen Posten und Zahlungen. Die Daten kommen ausschließlich aus der
 * serverseitigen Funktion `cmr-portal-lookup` (kein direkter Datenbankzugriff).
 */
export default function CmrPortal() {
  const { token: pathToken } = useParams();
  const [params] = useSearchParams();
  const token = pathToken ?? params.get('token') ?? '';
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Kundenportal · CMR';
    (async () => {
      if (!token) { setError('Kein Zugangslink angegeben.'); setLoading(false); return; }
      const { data: res, error: err } = await supabase.functions.invoke('cmr-portal-lookup', { body: { token } });
      if (err || (res as any)?.error) setError((res as any)?.error ?? 'Zugang konnte nicht geprüft werden.');
      else setData(res);
      setLoading(false);
    })();
  }, [token]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="p-8 max-w-md text-center space-y-2">
          <AlertCircle className="w-6 h-6 mx-auto text-destructive" />
          <h1 className="text-lg font-semibold">Zugang nicht möglich</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
        </Card>
      </div>
    );
  }

  const cur = data.currency;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex items-center gap-4">
          {data.company?.logo_url && (
            <img src={data.company.logo_url} alt={`${data.company?.company_name ?? 'CMR'} Logo`} className="h-10 w-auto" loading="lazy" />
          )}
          <div>
            <h1 className="text-xl font-semibold">{data.company?.company_name ?? 'Kundenportal'}</h1>
            <p className="text-sm text-muted-foreground">{data.customer?.name ?? 'Ihre Belegübersicht'}</p>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="p-4"><div className="text-[11px] uppercase text-muted-foreground">Belege</div><div className="text-xl font-semibold mt-1">{data.summary.documents}</div></Card>
          <Card className="p-4"><div className="text-[11px] uppercase text-muted-foreground">Offene Posten</div><div className="text-xl font-semibold mt-1">{data.summary.open_count}</div></Card>
          <Card className="p-4"><div className="text-[11px] uppercase text-muted-foreground">Offener Betrag</div><div className="text-xl font-semibold mt-1 text-amber-500">{money(data.summary.open_amount, cur)}</div></Card>
        </div>

        <Card className="divide-y">
          <div className="p-3 text-sm font-semibold">Belege</div>
          {data.documents.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">Keine Belege vorhanden.</div>}
          {data.documents.map((d: any) => {
            const open = Number(d.gross_total || 0) - Number(d.paid_total || 0);
            return (
              <div key={d.id} className="p-3 flex items-center gap-3">
                <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{d.doc_number ?? '—'}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(d.doc_date).toLocaleDateString('de-DE')}
                    {d.due_date ? ` · fällig ${new Date(d.due_date).toLocaleDateString('de-DE')}` : ''}
                  </div>
                </div>
                {open > 0.01
                  ? <Badge variant="outline" className="border-amber-500/40 text-amber-500">offen {money(open, d.currency || cur)}</Badge>
                  : <Badge variant="outline" className="border-emerald-500/40 text-emerald-500">bezahlt</Badge>}
                <div className="w-32 text-right text-sm font-semibold tabular-nums">{money(d.gross_total, d.currency || cur)}</div>
              </div>
            );
          })}
        </Card>

        {data.payments.length > 0 && (
          <Card className="divide-y">
            <div className="p-3 text-sm font-semibold">Zahlungen</div>
            {data.payments.map((p: any) => (
              <div key={p.id} className="p-3 flex items-center gap-3 text-sm">
                <div className="flex-1">{new Date(p.paid_on).toLocaleDateString('de-DE')} · {p.method ?? '—'}</div>
                <div className="font-semibold tabular-nums">{money(p.amount, p.currency || cur)}</div>
              </div>
            ))}
          </Card>
        )}

        <p className="text-xs text-muted-foreground text-center">
          {data.company?.company_name} · {data.company?.email} {data.company?.phone ? `· ${data.company.phone}` : ''}
        </p>
      </div>
    </div>
  );
}

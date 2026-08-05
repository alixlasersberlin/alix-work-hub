import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { getCustomerReturnSummary, resolveRiskFlag, RD_STATUS, RISK_LABELS, type CustomerReturnSummary } from '@/lib/bank/returnDebit';
import { useAuth } from '@/hooks/useAuth';

const fmt = (n: number, cur = 'EUR') => new Intl.NumberFormat('de-DE', { style: 'currency', currency: cur }).format(n || 0);

/** Warnhinweis für Kundenakte, Auftrag, Rechnung, Ratenplan, SEPA, Lieferung usw. */
export function PaymentRiskWarning({ customerId, className }: { customerId?: string | null; className?: string }) {
  const [sum, setSum] = useState<CustomerReturnSummary | null>(null);
  useEffect(() => {
    if (!customerId) return;
    getCustomerReturnSummary(customerId).then(setSum).catch(() => {});
  }, [customerId]);
  if (!sum || sum.count === 0) return null;
  const repeated = sum.count > 1;
  return (
    <div className={`flex items-start gap-2 rounded-md border p-3 text-sm ${repeated ? 'border-red-500/40 bg-red-500/5 text-red-500' : 'border-amber-500/40 bg-amber-500/5 text-amber-500'} ${className ?? ''}`}>
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
      <span>
        {repeated
          ? 'Achtung: Wiederholte Zahlungsstörungen. Lastschrift nur nach manueller Prüfung ausführen.'
          : 'Achtung: Bei diesem Kunden besteht eine offene Rücklastschrift.'}
      </span>
    </div>
  );
}

/** Bereich „Rücklastschriften und Zahlungsstörungen" in der Kundenakte. */
export default function CustomerReturnDebits({ customerId }: { customerId: string }) {
  const { hasRole } = useAuth();
  const canUnblock = hasRole('Admin') || hasRole('Super Admin');
  const [sum, setSum] = useState<CustomerReturnSummary | null>(null);

  const load = () => getCustomerReturnSummary(customerId).then(setSum).catch(() => {});
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [customerId]);

  if (!sum || (sum.count === 0 && sum.flags.length === 0)) return null;

  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2">
        <Undo2 className="w-4 h-4 text-red-500" />Rücklastschriften und Zahlungsstörungen
      </CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid gap-2 sm:grid-cols-4">
          <Kpi l="Anzahl" v={String(sum.count)} />
          <Kpi l="Gesamtsumme" v={fmt(sum.total)} />
          <Kpi l="Offene Beträge" v={fmt(sum.openTotal)} />
          <Kpi l="Entstandene Gebühren" v={fmt(sum.fees)} />
          <Kpi l="Letzte Rücklastschrift" v={sum.lastDate ?? '–'} />
          <Kpi l="Rückgabegründe" v={sum.reasons.join(', ') || '–'} />
        </div>

        {!!sum.flags.length && (
          <div className="space-y-1">
            {sum.flags.map(f => (
              <div key={f.id} className="flex items-center justify-between rounded-md border border-border p-2">
                <span>
                  <Badge className="bg-red-500/15 text-red-500 border-red-500/30 mr-2">{RISK_LABELS[f.risk_type] ?? f.risk_type}</Badge>
                  <span className="text-xs text-muted-foreground">{f.reason}</span>
                </span>
                {canUnblock && (
                  <Button size="sm" variant="outline"
                    onClick={async () => { try { await resolveRiskFlag(f.id); toast.success('Sperre aufgehoben'); load(); } catch (e: any) { toast.error(e.message); } }}>
                    Sperre aufheben
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted/40"><tr className="text-left">
              <th className="p-2">Datum</th><th className="p-2">Rechnung</th><th className="p-2">Grund</th>
              <th className="p-2 text-right">Betrag</th><th className="p-2 text-right">Gebühr</th><th className="p-2">Status</th>
            </tr></thead>
            <tbody>
              {sum.rows.map(r => (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-2">{r.booking_date ?? '–'}</td>
                  <td className="p-2">{r.invoice_number ?? '–'}</td>
                  <td className="p-2">{r.return_reason ?? '–'}</td>
                  <td className="p-2 text-right text-red-500">{fmt(Number(r.return_debit_amount), r.currency)}</td>
                  <td className="p-2 text-right">{fmt(Number(r.bank_fee) + Number(r.additional_costs), r.currency)}</td>
                  <td className="p-2">{RD_STATUS[r.status] ?? r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function Kpi({ l, v }: { l: string; v: string }) {
  return (
    <div className="rounded-md border border-border p-2">
      <div className="text-[10px] uppercase text-muted-foreground">{l}</div>
      <div className="font-medium">{v}</div>
    </div>
  );
}

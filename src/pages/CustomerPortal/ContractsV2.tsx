import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, FileSignature } from 'lucide-react';
import { logPortalAudit } from '@/lib/portal/audit';
import { ContractSignDialog } from './ContractSignDialog';

type Ctx = { customerId: string; companyName: string | null; email: string | null };

type Contract = {
  id: string;
  contract_number: string | null;
  contract_type: string | null;
  start_date: string | null;
  end_date: string | null;
  monthly_rate: number | null;
  remaining_amount: number | null;
  status: string | null;
  notes: string | null;
  signature_status?: string | null;
  customer_visible?: boolean | null;
  contract_version?: number | null;
};

export default function CustomerPortalContractsV2() {
  const ctx = useOutletContext<Ctx>();
  const [loading, setLoading] = useState(true);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [signContract, setSignContract] = useState<Contract | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('finance_contracts')
        .select('id, contract_number, contract_type, start_date, end_date, monthly_rate, remaining_amount, status, notes, signature_status, customer_visible, contract_version')
        .order('start_date', { ascending: false });
      setContracts((data ?? []) as Contract[]);
      setLoading(false);
      void logPortalAudit({ action: 'contract_viewed', customerId: ctx.customerId });
    })();
  }, [ctx.customerId, reloadKey]);

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold flex items-center gap-2"><FileSignature className="w-5 h-5" /> Meine Verträge</h2>
        <p className="text-muted-foreground text-sm">Serviceverträge und Ratenzahlungen bei Alix Lasers.</p>
      </div>

      {contracts.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Aktuell keine Verträge hinterlegt.</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {contracts.map((c) => (
            <Card key={c.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between gap-2">
                  <span className="truncate">{c.contract_type ?? 'Vertrag'}</span>
                  {c.status && <Badge variant={c.status === 'active' ? 'default' : 'outline'}>{c.status}</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Vertragsnummer" value={<span className="font-mono">{c.contract_number ?? '—'}</span>} />
                <Row label="Laufzeit" value={`${fmtDate(c.start_date)} — ${fmtDate(c.end_date)}`} />
                <Row label="Monatliche Rate" value={fmtEur(c.monthly_rate)} />
                <Row label="Restbetrag" value={fmtEur(c.remaining_amount)} />
                {c.signature_status && (
                  <Row label="Signatur" value={<Badge variant={c.signature_status === 'signed' ? 'default' : 'outline'}>{c.signature_status}</Badge>} />
                )}
                {c.notes && <p className="text-xs text-muted-foreground pt-1 border-t">{c.notes}</p>}
                {c.customer_visible && c.signature_status && c.signature_status !== 'signed' && (
                  <Button size="sm" className="w-full mt-2" onClick={() => setSignContract(c)}>
                    <FileSignature className="w-4 h-4 mr-1" /> Jetzt signieren
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Änderungen bitte über den Bereich „Nachrichten" mitteilen — direkte Anpassungen am Vertrag sind über das Portal nicht möglich.
      </p>

      {signContract && (
        <ContractSignDialog
          open={!!signContract}
          onOpenChange={(v) => !v && setSignContract(null)}
          contractId={signContract.id}
          contractLabel={`${signContract.contract_type ?? 'Vertrag'} · ${signContract.contract_number ?? ''}`}
          onSigned={() => setReloadKey((k) => k + 1)}
        />
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground text-xs">{label}</span><span className="text-right">{value}</span></div>;
}
function fmtDate(d?: string | null) { return d ? new Date(d).toLocaleDateString('de-DE') : '—'; }
function fmtEur(n?: number | null) { return n == null ? '—' : new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n); }

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Building2, Loader2 } from 'lucide-react';
import { useLicense, licMoney } from '@/hooks/useLicense';

export default function LicenseLizenznehmer() {
  const { licensees, loading } = useLicense();
  const [contracts, setContracts] = useState<any[]>([]);
  const [tx, setTx] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    (async () => {
      setBusy(true);
      const [{ data: c }, { data: r }] = await Promise.all([
        supabase.from('license_contracts' as any).select('*'),
        supabase.from('royalty_transactions' as any).select('licensee_tenant_id,royalty_amount,status').limit(5000),
      ]);
      setContracts(((c as any[]) || []));
      setTx(((r as any[]) || []));
      setBusy(false);
    })();
  }, []);

  if (loading || busy) return <div className="p-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader title="Lizenznehmer" subtitle="Mandanten mit Markenlizenz der Alix License" icon={Building2} />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {licensees.map((t) => {
          const c = contracts.find((x) => x.licensee_tenant_id === t.id);
          const rows = tx.filter((x) => x.licensee_tenant_id === t.id);
          const total = rows.reduce((s, x) => s + Number(x.royalty_amount || 0), 0);
          const open = rows.filter((x) => x.status === 'offen').reduce((s, x) => s + Number(x.royalty_amount || 0), 0);
          return (
            <Card key={t.id} className="space-y-2 p-4">
              <div className="flex items-center justify-between">
                <div className="font-medium">{t.name}</div>
                <Badge variant={c ? 'default' : 'outline'}>{c ? 'Vertrag aktiv' : 'kein Vertrag'}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">Mandant {t.code}</div>
              {c && (
                <div className="text-sm">
                  Royalty {Number(c.royalty_percent || 0)} % · Abrechnung {c.billing_mode === 'single' ? 'je Rechnung' : 'monatlich'}
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Royalty gesamt</span>
                <span className="font-medium">{licMoney(total)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">davon offen</span>
                <span className="font-medium">{licMoney(open)}</span>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

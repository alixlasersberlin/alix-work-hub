import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Crown, Loader2, TrendingUp, FileText, Building2, Package } from 'lucide-react';
import { useLicense, licMoney } from '@/hooks/useLicense';

export default function LicenseDashboard() {
  const { tenants, loading } = useLicense();
  const [busy, setBusy] = useState(true);
  const [tx, setTx] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      setBusy(true);
      const year = new Date().getFullYear();
      const [{ data: r }, { data: i }] = await Promise.all([
        supabase
          .from('royalty_transactions' as any)
          .select('royalty_amount,source_invoice_date,product_name,licensee_tenant_id,status,currency')
          .gte('source_invoice_date', `${year - 1}-01-01`)
          .limit(5000),
        supabase
          .from('license_invoices' as any)
          .select('id,invoice_number,amount_net,status,invoice_date,licensee_tenant_id,currency')
          .order('invoice_date', { ascending: false })
          .limit(500),
      ]);
      setTx(((r as any[]) || []));
      setInvoices(((i as any[]) || []));
      setBusy(false);
    })();
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const year = today.slice(0, 4);
  const sum = (rows: any[]) => rows.reduce((s, r) => s + Number(r.royalty_amount || 0), 0);
  const thisYear = tx.filter((r) => String(r.source_invoice_date).startsWith(year));

  const tenantName = (id: string | null) => tenants.find((t) => t.id === id)?.name || '–';

  const byProduct = new Map<string, number>();
  thisYear.forEach((r) => byProduct.set(r.product_name || '–', (byProduct.get(r.product_name || '–') || 0) + Number(r.royalty_amount || 0)));
  const byTenant = new Map<string, number>();
  thisYear.forEach((r) => {
    const k = tenantName(r.licensee_tenant_id);
    byTenant.set(k, (byTenant.get(k) || 0) + Number(r.royalty_amount || 0));
  });

  const open = invoices.filter((i) => i.status !== 'bezahlt' && i.status !== 'storniert');
  const paid = invoices.filter((i) => i.status === 'bezahlt');
  const elapsedMonths = new Date().getMonth() + 1;
  const forecast = elapsedMonths > 0 ? (sum(thisYear) / elapsedMonths) * 12 : 0;

  const kpis = [
    { label: 'Lizenzumsatz gesamt', value: sum(tx), icon: TrendingUp },
    { label: 'Lizenzen heute', value: sum(tx.filter((r) => r.source_invoice_date === today)), icon: FileText },
    { label: 'Lizenzen Monat', value: sum(tx.filter((r) => String(r.source_invoice_date).startsWith(month))), icon: FileText },
    { label: 'Lizenzen Jahr', value: sum(thisYear), icon: FileText },
    { label: 'Offene Lizenzrechnungen', value: open.reduce((s, i) => s + Number(i.amount_net || 0), 0), icon: Building2 },
    { label: 'Bezahlte Lizenzrechnungen', value: paid.reduce((s, i) => s + Number(i.amount_net || 0), 0), icon: Building2 },
    { label: 'Royalty Forecast', value: forecast, icon: TrendingUp },
  ];

  if (loading || busy) {
    return (
      <div className="flex items-center justify-center p-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="Alix License"
        subtitle="ALIX LASERS LICENSING L.L.C-FZ · Dubai · Lizenz- und Royalty-Center"
        icon={Crown}
        actions={<Badge variant="outline">Systemmandant</Badge>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <k.icon className="h-4 w-4" /> {k.label}
            </div>
            <div className="mt-2 text-2xl font-semibold">{licMoney(k.value)}</div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2 font-medium">
            <Package className="h-4 w-4" /> Top Produkte ({year})
          </div>
          <ul className="space-y-2 text-sm">
            {[...byProduct.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, amt]) => (
              <li key={name} className="flex justify-between gap-4">
                <span className="truncate">{name}</span>
                <span className="font-medium">{licMoney(amt)}</span>
              </li>
            ))}
            {byProduct.size === 0 && <li className="text-muted-foreground">Noch keine Royalty-Buchungen.</li>}
          </ul>
        </Card>

        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2 font-medium">
            <Building2 className="h-4 w-4" /> Top Mandanten ({year})
          </div>
          <ul className="space-y-2 text-sm">
            {[...byTenant.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, amt]) => (
              <li key={name} className="flex justify-between gap-4">
                <span className="truncate">{name}</span>
                <span className="font-medium">{licMoney(amt)}</span>
              </li>
            ))}
            {byTenant.size === 0 && <li className="text-muted-foreground">Noch keine Daten.</li>}
          </ul>
        </Card>
      </div>

      <Card className="p-4">
        <div className="mb-3 font-medium">Letzte Lizenzrechnungen</div>
        <div className="space-y-2 text-sm">
          {invoices.slice(0, 10).map((i) => (
            <div key={i.id} className="flex items-center justify-between gap-4 border-b border-border/50 pb-2">
              <span className="font-mono text-xs">{i.invoice_number}</span>
              <span className="truncate">{tenantName(i.licensee_tenant_id)}</span>
              <span>{i.invoice_date}</span>
              <Badge variant={i.status === 'bezahlt' ? 'default' : 'outline'}>{i.status}</Badge>
              <span className="font-medium">{licMoney(i.amount_net, i.currency)}</span>
            </div>
          ))}
          {invoices.length === 0 && (
            <div className="text-muted-foreground">
              Noch keine Lizenzrechnungen –{' '}
              <Link className="underline" to="/license/royalties">
                Lizenzabrechnung starten
              </Link>
              .
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/infinity/PageHeader';
import { KpiTile } from '@/components/infinity/KpiTile';
import {
  Gauge, Loader2, Star, FileSignature, Hash, Package, Building2,
  TrendingUp, AlertTriangle, Receipt,
} from 'lucide-react';
import { useLicense, licMoney } from '@/hooks/useLicense';

const monthKey = (d: Date) => d.toISOString().slice(0, 7);
const monthLabel = (k: string) =>
  new Date(`${k}-01T00:00:00Z`).toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });

export default function LicenseCockpit() {
  const { tenants, licensees, loading } = useLicense();
  const [busy, setBusy] = useState(true);
  const [brands, setBrands] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [rates, setRates] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [tx, setTx] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      setBusy(true);
      const year = new Date().getFullYear();
      const [b, c, r, p, t, i] = await Promise.all([
        supabase.from('brand_registry' as any).select('id,name,code,status,valid_to,owner_tenant_id'),
        supabase.from('license_contracts' as any).select('id,contract_number,licensee_tenant_id,brand_id,status,start_date,end_date,royalty_percent,rate_per_unit,minimum_royalty,license_model,billing_mode,auto_renew'),
        supabase.from('license_rates' as any).select('id,brand_id,tenant_id,product_name,sku,license_model,rate_percent,rate_per_unit,min_amount,is_active,valid_to'),
        supabase.from('license_products' as any).select('id,item_name,sku,is_licensable,brand_id,rate_percent,rate_per_unit,license_model'),
        supabase.from('royalty_transactions' as any)
          .select('royalty_amount,net_amount,source_invoice_date,product_name,licensee_tenant_id,brand_id,status,currency')
          .gte('source_invoice_date', `${year - 1}-01-01`).limit(5000),
        supabase.from('license_invoices' as any)
          .select('id,invoice_number,amount_net,status,invoice_date,due_date,licensee_tenant_id,currency')
          .order('invoice_date', { ascending: false }).limit(500),
      ]);
      setBrands((b.data as any[]) || []);
      setContracts((c.data as any[]) || []);
      setRates((r.data as any[]) || []);
      setProducts((p.data as any[]) || []);
      setTx((t.data as any[]) || []);
      setInvoices((i.data as any[]) || []);
      setBusy(false);
    })();
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const curMonth = today.slice(0, 7);
  const year = today.slice(0, 4);
  const sum = (rows: any[], f = 'royalty_amount') => rows.reduce((s, r) => s + Number(r[f] || 0), 0);

  const thisYear = useMemo(() => tx.filter((r) => String(r.source_invoice_date).startsWith(year)), [tx, year]);
  const lastYear = useMemo(() => tx.filter((r) => String(r.source_invoice_date).startsWith(String(Number(year) - 1))), [tx, year]);

  // 12-Monats-Trend
  const trend = useMemo(() => {
    const keys: string[] = [];
    const now = new Date();
    for (let k = 11; k >= 0; k--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - k, 1));
      keys.push(monthKey(d));
    }
    return keys.map((k) => ({
      key: k,
      amount: sum(tx.filter((r) => String(r.source_invoice_date).startsWith(k))),
    }));
  }, [tx]);

  const monthAmount = trend[trend.length - 1]?.amount ?? 0;
  const prevMonthAmount = trend[trend.length - 2]?.amount ?? 0;
  const monthDelta = prevMonthAmount > 0 ? ((monthAmount - prevMonthAmount) / prevMonthAmount) * 100 : undefined;
  const yearDelta = sum(lastYear) > 0 ? ((sum(thisYear) - sum(lastYear)) / sum(lastYear)) * 100 : undefined;

  const tenantName = (id: string | null) => tenants.find((t) => t.id === id)?.name || '–';
  const brandName = (id: string | null) => brands.find((b) => b.id === id)?.name || 'ohne Marke';

  const activeContracts = contracts.filter((c) => (c.status || 'aktiv') === 'aktiv');
  const activeBrands = brands.filter((b) => (b.status || 'aktiv') === 'aktiv');
  const activeRates = rates.filter((r) => r.is_active !== false);
  const licensableProducts = products.filter((p) => p.is_licensable);

  const openInvoices = invoices.filter((i) => i.status !== 'bezahlt' && i.status !== 'storniert');
  const overdueInvoices = openInvoices.filter((i) => i.due_date && i.due_date < today);

  const avgRate = activeContracts.length
    ? activeContracts.reduce((s, c) => s + Number(c.royalty_percent || 0), 0) / activeContracts.length
    : 0;

  const in90 = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
  const expiring = [
    ...contracts.filter((c) => c.end_date && c.end_date >= today && c.end_date <= in90)
      .map((c) => ({ kind: 'Vertrag', label: c.contract_number || 'Vertrag', sub: tenantName(c.licensee_tenant_id), date: c.end_date, renew: c.auto_renew })),
    ...brands.filter((b) => b.valid_to && b.valid_to >= today && b.valid_to <= in90)
      .map((b) => ({ kind: 'Marke', label: b.name, sub: b.code || '', date: b.valid_to, renew: false })),
    ...rates.filter((r) => r.valid_to && r.valid_to >= today && r.valid_to <= in90)
      .map((r) => ({ kind: 'Satz', label: r.product_name || r.sku || 'Royalty-Satz', sub: brandName(r.brand_id), date: r.valid_to, renew: false })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  // Mandanten-Matrix
  const byTenant = useMemo(() => {
    return licensees.map((t) => {
      const rows = thisYear.filter((r) => r.licensee_tenant_id === t.id);
      const c = activeContracts.find((x) => x.licensee_tenant_id === t.id);
      const inv = invoices.filter((i) => i.licensee_tenant_id === t.id);
      return {
        id: t.id,
        name: t.name,
        code: t.code,
        contract: c,
        base: sum(rows, 'net_amount'),
        royalty: sum(rows),
        bookings: rows.length,
        open: inv.filter((i) => i.status !== 'bezahlt' && i.status !== 'storniert')
          .reduce((s, i) => s + Number(i.amount_net || 0), 0),
      };
    }).sort((a, b) => b.royalty - a.royalty);
  }, [licensees, thisYear, activeContracts, invoices]);

  const byBrand = useMemo(() => {
    const m = new Map<string, number>();
    thisYear.forEach((r) => {
      const k = brandName(r.brand_id);
      m.set(k, (m.get(k) || 0) + Number(r.royalty_amount || 0));
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [thisYear, brands]);

  const maxTrend = Math.max(...trend.map((t) => t.amount), 1);
  const maxBrand = Math.max(...byBrand.map(([, v]) => v), 1);

  if (loading || busy) {
    return <div className="flex items-center justify-center p-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="Lizenz-Cockpit"
        subtitle="Marken, Lizenzen, Verträge, Royalty-Sätze und Lizenzumsatz über alle Mandanten"
        icon={Gauge}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm"><Link to="/license/royalties">Lizenzabrechnung</Link></Button>
            <Button asChild variant="outline" size="sm"><Link to="/license/auswertungen">Auswertungen</Link></Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile label="Royalty Monat" value={licMoney(monthAmount)} icon={TrendingUp} delta={monthDelta}
          trend={trend.map((t) => t.amount)} accent="gold" />
        <KpiTile label={`Royalty ${year}`} value={licMoney(sum(thisYear))} icon={Receipt} delta={yearDelta} accent="emerald" />
        <KpiTile label="Lizenzbasis netto" value={licMoney(sum(thisYear, 'net_amount'))} icon={Building2} accent="sky" />
        <KpiTile label="Ø Royalty-Satz" value={avgRate.toFixed(2)} unit="%" icon={Hash} accent="violet" />
        <KpiTile label="Aktive Marken" value={activeBrands.length} unit={`/ ${brands.length}`} icon={Star} accent="gold"
          onClick={() => (window.location.href = '/license/marken')} />
        <KpiTile label="Aktive Verträge" value={activeContracts.length} unit={`/ ${contracts.length}`} icon={FileSignature} accent="sky"
          onClick={() => (window.location.href = '/license/vertraege')} />
        <KpiTile label="Royalty-Sätze aktiv" value={activeRates.length} icon={Hash} accent="emerald"
          onClick={() => (window.location.href = '/license/saetze')} />
        <KpiTile label="Lizenzpflichtige Artikel" value={licensableProducts.length} unit={`/ ${products.length}`} icon={Package} accent="violet"
          onClick={() => (window.location.href = '/license/produkte')} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium"><TrendingUp className="h-4 w-4" /> Royalty-Verlauf (12 Monate)</div>
            <span className="text-xs text-muted-foreground">Gesamt {licMoney(trend.reduce((s, t) => s + t.amount, 0))}</span>
          </div>
          <div className="flex h-40 items-end gap-1.5">
            {trend.map((t) => (
              <div key={t.key} className="group flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                  {licMoney(t.amount)}
                </span>
                <div
                  className="w-full rounded-t bg-amber-400/70 transition-all group-hover:bg-amber-300"
                  style={{ height: `${Math.max((t.amount / maxTrend) * 100, 2)}%` }}
                  title={`${monthLabel(t.key)}: ${licMoney(t.amount)}`}
                />
                <span className="text-[10px] text-muted-foreground">{monthLabel(t.key)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2 font-medium"><Star className="h-4 w-4" /> Royalty nach Marke ({year})</div>
          <div className="space-y-3 text-sm">
            {byBrand.slice(0, 6).map(([name, amt]) => (
              <div key={name}>
                <div className="flex justify-between gap-3">
                  <span className="truncate">{name}</span>
                  <span className="font-medium">{licMoney(amt)}</span>
                </div>
                <div className="mt-1 h-1.5 w-full rounded-full bg-muted">
                  <div className="h-1.5 rounded-full bg-amber-400/80" style={{ width: `${(amt / maxBrand) * 100}%` }} />
                </div>
              </div>
            ))}
            {byBrand.length === 0 && <div className="text-muted-foreground">Noch keine Royalty-Buchungen.</div>}
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2 font-medium"><Building2 className="h-4 w-4" /> Lizenznehmer-Matrix ({year})</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2">Mandant</th>
                <th>Vertrag</th>
                <th className="text-right">Satz</th>
                <th className="text-right">Buchungen</th>
                <th className="text-right">Basis netto</th>
                <th className="text-right">Royalty</th>
                <th className="text-right">Offen</th>
              </tr>
            </thead>
            <tbody>
              {byTenant.map((t) => (
                <tr key={t.id} className="border-b border-border/50">
                  <td className="py-2">
                    <div className="font-medium">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.code}</div>
                  </td>
                  <td>
                    {t.contract
                      ? <Badge variant="default">{t.contract.contract_number || 'aktiv'}</Badge>
                      : <Badge variant="outline">kein Vertrag</Badge>}
                  </td>
                  <td className="text-right tabular-nums">
                    {t.contract?.royalty_percent ? `${Number(t.contract.royalty_percent)} %`
                      : t.contract?.rate_per_unit ? `${licMoney(t.contract.rate_per_unit)} / Stk` : '–'}
                  </td>
                  <td className="text-right tabular-nums">{t.bookings}</td>
                  <td className="text-right tabular-nums text-muted-foreground">{licMoney(t.base)}</td>
                  <td className="text-right font-medium tabular-nums">{licMoney(t.royalty)}</td>
                  <td className="text-right tabular-nums">{licMoney(t.open)}</td>
                </tr>
              ))}
              {byTenant.length === 0 && (
                <tr><td colSpan={7} className="py-4 text-muted-foreground">Keine Lizenznehmer angelegt.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4 text-amber-400" /> Laufen in 90 Tagen aus
          </div>
          <div className="space-y-2 text-sm">
            {expiring.slice(0, 10).map((e, idx) => (
              <div key={`${e.kind}-${e.label}-${idx}`} className="flex items-center justify-between gap-3 border-b border-border/50 pb-2">
                <Badge variant="outline">{e.kind}</Badge>
                <span className="flex-1 truncate">{e.label}</span>
                <span className="truncate text-xs text-muted-foreground">{e.sub}</span>
                <span className="tabular-nums">{e.date}</span>
                {e.renew && <Badge variant="secondary">Auto-Verlängerung</Badge>}
              </div>
            ))}
            {expiring.length === 0 && <div className="text-muted-foreground">Keine auslaufenden Marken, Verträge oder Sätze.</div>}
          </div>
        </Card>

        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2 font-medium"><Receipt className="h-4 w-4" /> Lizenzrechnungen</div>
          <div className="mb-3 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-border p-3">
              <div className="text-xs text-muted-foreground">Offen</div>
              <div className="text-lg font-semibold">{licMoney(openInvoices.reduce((s, i) => s + Number(i.amount_net || 0), 0))}</div>
              <div className="text-xs text-muted-foreground">{openInvoices.length} Rechnungen</div>
            </div>
            <div className="rounded-lg border border-rose-500/30 p-3">
              <div className="text-xs text-muted-foreground">Überfällig</div>
              <div className="text-lg font-semibold text-rose-300">{licMoney(overdueInvoices.reduce((s, i) => s + Number(i.amount_net || 0), 0))}</div>
              <div className="text-xs text-muted-foreground">{overdueInvoices.length} Rechnungen</div>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            {invoices.slice(0, 6).map((i) => (
              <div key={i.id} className="flex items-center justify-between gap-3 border-b border-border/50 pb-2">
                <span className="font-mono text-xs">{i.invoice_number}</span>
                <span className="flex-1 truncate">{tenantName(i.licensee_tenant_id)}</span>
                <Badge variant={i.status === 'bezahlt' ? 'default' : 'outline'}>{i.status}</Badge>
                <span className="font-medium tabular-nums">{licMoney(i.amount_net, i.currency)}</span>
              </div>
            ))}
            {invoices.length === 0 && (
              <div className="text-muted-foreground">
                Noch keine Lizenzrechnungen – <Link className="underline" to="/license/royalties">Lizenzabrechnung starten</Link>.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

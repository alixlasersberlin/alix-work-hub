import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Receipt, Loader2, RefreshCw, FileText, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useLicense, licMoney } from '@/hooks/useLicense';
import { generateRoyalties, createLicenseInvoices } from '@/lib/license/engine';
import { downloadCsv, downloadPdf } from '@/lib/license/export';

const firstOfMonth = () => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
const today = () => new Date().toISOString().slice(0, 10);

export default function LicenseRoyalties() {
  const { licensor, tenants, settings, canWrite } = useLicense();
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [status, setStatus] = useState('');
  const [tenantFilter, setTenantFilter] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);

  const load = async () => {
    setBusy(true);
    let q = supabase
      .from('royalty_transactions' as any)
      .select('*')
      .gte('source_invoice_date', from)
      .lte('source_invoice_date', to)
      .order('source_invoice_date', { ascending: false })
      .limit(2000);
    if (status) q = q.eq('status', status);
    if (tenantFilter) q = q.eq('licensee_tenant_id', tenantFilter);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setRows(((data as any[]) || []));
    setBusy(false);
  };
  useEffect(() => { load(); }, [from, to, status, tenantFilter]);

  const tenantsBySource = useMemo(() => {
    const map: Record<string, string> = {};
    tenants.forEach((t) => { if (t.zoho_source_system) map[t.zoho_source_system] = t.id; });
    return map;
  }, [tenants]);

  const tName = (id: string | null) => tenants.find((t) => t.id === id)?.name || '–';
  const total = rows.reduce((s, r) => s + Number(r.royalty_amount || 0), 0);
  const openTotal = rows.filter((r) => r.status === 'offen').reduce((s, r) => s + Number(r.royalty_amount || 0), 0);

  const runGeneration = async () => {
    setRunning(true);
    try {
      const res = await generateRoyalties({ from, to, licensorTenantId: licensor?.id ?? null, tenantsBySource });
      toast.success(`${res.created} Lizenzbuchungen erzeugt (${licMoney(res.amount)}), ${res.skipped} bereits vorhanden.`);
      load();
    } catch (e: any) {
      toast.error(e.message || 'Lizenzlauf fehlgeschlagen.');
    }
    setRunning(false);
  };

  const runBilling = async (mode: 'single' | 'monthly') => {
    setRunning(true);
    try {
      const res = await createLicenseInvoices({
        from, to, mode,
        licensorTenantId: licensor?.id ?? null,
        paymentTermsDays: settings?.payment_terms_days ?? 14,
        licenseeTenantId: tenantFilter || null,
      });
      toast.success(`${res.invoices} Lizenzrechnungen über ${licMoney(res.amount)} erstellt.`);
      load();
    } catch (e: any) {
      toast.error(e.message || 'Abrechnung fehlgeschlagen.');
    }
    setRunning(false);
  };

  const headers = ['Royalty-Nr', 'Datum', 'Mandant', 'Produkt', 'Seriennummer', 'Verkaufsrechnung', 'Netto', 'Satz %', 'Royalty', 'Status'];
  const exportRows = () => rows.map((r) => [
    r.royalty_number, r.source_invoice_date, tName(r.licensee_tenant_id), r.product_name, r.serial_number || '',
    r.source_invoice_number, Number(r.net_amount || 0).toFixed(2), Number(r.rate_percent || 0), Number(r.royalty_amount || 0).toFixed(2), r.status,
  ]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="Lizenzabrechnung"
        subtitle="Automatische Royalty-Ermittlung aus abgeschlossenen Verkaufsrechnungen"
        icon={Receipt}
        actions={canWrite && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={runGeneration} disabled={running}>
              {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />} Lizenzlauf starten
            </Button>
            <Button variant="outline" onClick={() => runBilling('monthly')} disabled={running}>
              <FileText className="mr-2 h-4 w-4" /> Sammelrechnung
            </Button>
            <Button variant="outline" onClick={() => runBilling('single')} disabled={running}>
              <FileText className="mr-2 h-4 w-4" /> Einzelrechnungen
            </Button>
          </div>
        )}
      />

      <Card className="grid gap-3 p-4 md:grid-cols-5">
        <div><Label>Von</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label>Bis</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div>
          <Label>Mandant</Label>
          <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={tenantFilter} onChange={(e) => setTenantFilter(e.target.value)}>
            <option value="">alle</option>
            {tenants.filter((t) => t.code !== 'LIC').map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <Label>Status</Label>
          <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">alle</option>
            <option value="offen">offen</option>
            <option value="abgerechnet">abgerechnet</option>
            <option value="storniert">storniert</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <Button variant="outline" onClick={() => downloadCsv(`royalties_${from}_${to}`, headers, exportRows())}>
            <Download className="mr-2 h-4 w-4" /> CSV
          </Button>
          <Button variant="outline" onClick={() => downloadPdf(`royalties_${from}_${to}`, 'Royalty-Buchungen', headers, exportRows(), `${from} – ${to}`)}>
            PDF
          </Button>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Royalty gesamt</div><div className="text-2xl font-semibold">{licMoney(total)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">davon offen</div><div className="text-2xl font-semibold">{licMoney(openTotal)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Buchungen</div><div className="text-2xl font-semibold">{rows.length}</div></Card>
      </div>

      <Card className="p-4">
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : (
          <div className="space-y-2 text-sm">
            {rows.map((r) => (
              <div key={r.id} className="grid grid-cols-2 items-center gap-2 border-b border-border/50 pb-2 md:grid-cols-7">
                <span className="font-mono text-xs">{r.royalty_number}</span>
                <span>{r.source_invoice_date}</span>
                <span className="truncate">{tName(r.licensee_tenant_id)}</span>
                <span className="truncate">{r.product_name}</span>
                <span className="truncate text-xs text-muted-foreground">{r.source_invoice_number}{r.serial_number ? ` · SN ${r.serial_number}` : ''}</span>
                <span className="font-medium">{licMoney(r.royalty_amount, r.currency)}</span>
                <Badge variant={r.status === 'offen' ? 'outline' : 'default'}>{r.status}</Badge>
              </div>
            ))}
            {rows.length === 0 && <div className="text-muted-foreground">Keine Royalty-Buchungen im Zeitraum. Starten Sie den Lizenzlauf.</div>}
          </div>
        )}
      </Card>
    </div>
  );
}

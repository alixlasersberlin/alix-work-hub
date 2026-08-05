import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageHeader } from '@/components/infinity/PageHeader';
import { FileText, Loader2, Download, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useLicense, licMoney } from '@/hooks/useLicense';
import { downloadPdf, downloadCsv } from '@/lib/license/export';

export default function LicenseRechnungen() {
  const { tenants, licensor, canWrite } = useLicense();
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [detail, setDetail] = useState<any | null>(null);
  const [items, setItems] = useState<any[]>([]);

  const load = async () => {
    setBusy(true);
    const { data } = await supabase.from('license_invoices' as any).select('*').order('invoice_date', { ascending: false }).limit(1000);
    setRows(((data as any[]) || []));
    setBusy(false);
  };
  useEffect(() => { load(); }, []);

  const tName = (id: string | null) => tenants.find((t) => t.id === id)?.name || '–';

  const openDetail = async (inv: any) => {
    setDetail(inv);
    const { data } = await supabase.from('license_invoice_items' as any).select('*').eq('invoice_id', inv.id);
    setItems(((data as any[]) || []));
  };

  const markPaid = async (inv: any) => {
    const { error } = await supabase.from('license_invoices' as any).update({ status: 'bezahlt', paid_at: new Date().toISOString() }).eq('id', inv.id);
    if (error) { toast.error(error.message); return; }
    await supabase.from('intercompany_invoices' as any).update({ status: 'bezahlt', paid_at: new Date().toISOString() }).eq('license_invoice_id', inv.id);
    await supabase.from('license_audit_log' as any).insert({ entity: 'license_invoices', entity_id: inv.id, action: 'paid' });
    toast.success('Lizenzrechnung als bezahlt markiert.');
    load();
  };

  const pdf = async (inv: any) => {
    const { data } = await supabase.from('license_invoice_items' as any).select('*').eq('invoice_id', inv.id);
    const lines = ((data as any[]) || []);
    downloadPdf(
      inv.invoice_number,
      `Lizenzrechnung ${inv.invoice_number}`,
      ['Leistung', 'Verkaufsrechnung', 'Seriennummer', 'Basis netto', 'Satz %', 'Lizenzbetrag'],
      lines.map((l) => [l.description, l.source_invoice_number || '', l.serial_number || '', Number(l.base_amount || 0).toFixed(2), Number(l.rate_percent || 0), Number(l.amount || 0).toFixed(2)]),
      `${licensor?.name || 'Alix License'} → ${tName(inv.licensee_tenant_id)} · Zeitraum ${inv.period_start || '–'} bis ${inv.period_end || '–'} · Summe ${licMoney(inv.amount_net, inv.currency)}`,
    );
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="Lizenzrechnungen"
        subtitle="Rechnungen der Alix License an die Mandanten (LIC-RG)"
        icon={FileText}
        actions={
          <Button variant="outline" onClick={() => downloadCsv('lizenzrechnungen',
            ['Nummer', 'Datum', 'Mandant', 'Zeitraum', 'Betrag', 'Status'],
            rows.map((r) => [r.invoice_number, r.invoice_date, tName(r.licensee_tenant_id), `${r.period_start || ''} - ${r.period_end || ''}`, Number(r.amount_net || 0).toFixed(2), r.status]))}>
            <Download className="mr-2 h-4 w-4" /> CSV
          </Button>
        }
      />
      <Card className="p-4">
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : (
          <div className="space-y-2 text-sm">
            {rows.map((r) => (
              <div key={r.id} className="grid grid-cols-2 items-center gap-2 border-b border-border/50 pb-2 md:grid-cols-7">
                <button className="text-left font-mono text-xs underline" onClick={() => openDetail(r)}>{r.invoice_number}</button>
                <span>{r.invoice_date}</span>
                <span className="truncate">{tName(r.licensee_tenant_id)}</span>
                <span className="text-xs text-muted-foreground">{r.period_start} – {r.period_end}</span>
                <span className="font-medium">{licMoney(r.amount_net, r.currency)}</span>
                <Badge variant={r.status === 'bezahlt' ? 'default' : 'outline'}>{r.status}</Badge>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => pdf(r)}>PDF</Button>
                  {canWrite && r.status !== 'bezahlt' && (
                    <Button size="sm" onClick={() => markPaid(r)}><Check className="h-4 w-4" /></Button>
                  )}
                </div>
              </div>
            ))}
            {rows.length === 0 && <div className="text-muted-foreground">Noch keine Lizenzrechnungen.</div>}
          </div>
        )}
      </Card>

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Lizenzrechnung {detail?.invoice_number}</DialogTitle></DialogHeader>
          <div className="space-y-2 text-sm">
            <div className="text-muted-foreground">
              {licensor?.name} → {tName(detail?.licensee_tenant_id)} · Lizenzgebühr gemäß Markenlizenzvertrag
            </div>
            {items.map((l) => (
              <div key={l.id} className="flex justify-between gap-4 border-b border-border/50 pb-1">
                <span className="truncate">{l.description}</span>
                <span className="whitespace-nowrap">{Number(l.rate_percent || 0)} % von {licMoney(l.base_amount)}</span>
                <span className="font-medium">{licMoney(l.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between pt-2 font-semibold">
              <span>Summe</span><span>{licMoney(detail?.amount_net, detail?.currency)}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

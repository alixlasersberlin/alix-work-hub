import { useState } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function DatevExport() {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + '01';
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [busy, setBusy] = useState(false);

  async function downloadDatev() {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('finance-datev-export', { body: { date_from: from, date_to: to } });
      if (error) throw error;
      const text = typeof data === 'string' ? data : await (data as Blob).text?.();
      const blob = new Blob([text || ''], { type: 'text/csv;charset=windows-1252' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `EXTF_${from}_${to}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  async function downloadJournalCsv() {
    setBusy(true);
    try {
      const { data, error } = await (supabase as any).from('finance_journal').select('*').gte('booking_date', from).lte('booking_date', to).order('booking_date');
      if (error) throw error;
      const cols = ['journal_number','booking_date','source_module','vorgang','reference','order_number','invoice_number','amount_net','amount_vat','amount_gross','account','contra_account','description','status'];
      const head = cols.join(';');
      const body = (data || []).map((r: any) => cols.map(c => String(r[c] ?? '').replace(/[;\n\r"]/g, ' ')).join(';')).join('\n');
      const blob = new Blob([head + '\n' + body], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `journal_${from}_${to}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <PageHeader icon={FileSpreadsheet} title="Export DATEV" subtitle="DATEV-Buchungsstapel (EXTF 700) & Journal-Export" />
      <Card>
        <CardHeader><CardTitle>Zeitraum</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div><Label>Von</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
            <div><Label>Bis</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={downloadDatev} disabled={busy}><Download className="mr-2 h-4 w-4" />DATEV EXTF 700 (Finanztransaktionen)</Button>
            <Button variant="outline" onClick={downloadJournalCsv} disabled={busy}><Download className="mr-2 h-4 w-4" />Buchungsjournal CSV</Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Der DATEV-Export verwendet die bestehende Edge Function <code>finance-datev-export</code> und liefert
            einen ASCII-Buchungsstapel im DATEV-Format „EXTF Buchungsstapel 700". Konfiguration (Berater-/Mandantennr.,
            SKR, Sachkonten) erfolgt unter <code>app_settings.finance.datev.config</code>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

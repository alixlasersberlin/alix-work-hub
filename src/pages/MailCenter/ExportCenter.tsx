import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, FileDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const SOURCES = [
  { key: 'mail_campaigns', label: 'Kampagnen' },
  { key: 'mail_events', label: 'Trackingdaten' },
  { key: 'mail_messages', label: 'Kundenkommunikation' },
  { key: 'mail_audit_logs', label: 'Audit Logs' },
  { key: 'mail_unsubscribes', label: 'Abmeldungen' },
  { key: 'mail_phone_notes', label: 'Telefonnotizen' },
  { key: 'mail_tasks', label: 'Aufgaben' },
];

function toCSV(rows: any[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  return [
    headers.join(','),
    ...rows.map(r => headers.map(h => {
      const v = r[h]; if (v == null) return '';
      const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
      return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')),
  ].join('\n');
}

export default function ExportCenter() {
  const [source, setSource] = useState('mail_campaigns');
  const [format, setFormat] = useState<'csv' | 'json' | 'xlsx'>('csv');
  const [loading, setLoading] = useState(false);

  async function doExport() {
    setLoading(true);
    try {
      const { data, error } = await supabase.from(source as any).select('*').limit(10000);
      if (error) throw error;
      const rows = data || [];
      let blob: Blob;
      let ext = format;
      if (format === 'json') {
        blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
      } else if (format === 'xlsx') {
        // simplified: export as CSV with .xlsx extension fallback
        blob = new Blob([toCSV(rows)], { type: 'text/csv' });
        ext = 'csv';
        toast.info('XLSX nicht direkt unterstützt – als CSV exportiert');
      } else {
        blob = new Blob([toCSV(rows)], { type: 'text/csv' });
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${source}-${new Date().toISOString().slice(0, 10)}.${ext}`; a.click();
      URL.revokeObjectURL(url);
      toast.success(`${rows.length} Zeilen exportiert`);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2"><FileDown className="w-5 h-5 text-primary" /><h2 className="text-xl font-semibold">Export Center</h2></div>

      <Card>
        <CardHeader><CardTitle className="text-base">Daten exportieren</CardTitle></CardHeader>
        <CardContent className="space-y-3 max-w-xl">
          <div>
            <label className="text-sm font-medium">Quelle</label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SOURCES.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Format</label>
            <Select value={format} onValueChange={(v: any) => setFormat(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="json">JSON</SelectItem>
                <SelectItem value="xlsx">XLSX</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={doExport} disabled={loading}><Download className="w-4 h-4 mr-2" />{loading ? 'Exportiere…' : 'Export starten'}</Button>
        </CardContent>
      </Card>
    </div>
  );
}

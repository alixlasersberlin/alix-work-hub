import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, FileDown, FileJson, FileSpreadsheet, Printer } from 'lucide-react';
import { toast } from 'sonner';

type Row = Record<string, any>;

const SOURCES = [
  { id: 'role_audit_log', label: 'Rollen-Änderungsprotokoll' },
  { id: 'role_change_requests', label: 'Freigabeanträge' },
  { id: 'role_temporary_grants', label: 'Befristete & geplante Rechte' },
  { id: 'role_break_glass_sessions', label: 'Break-Glass-Sessions' },
  { id: 'role_recert_campaigns', label: 'Rezertifizierungs-Kampagnen' },
  { id: 'role_recert_items', label: 'Rezertifizierungs-Positionen' },
];

function toCsv(rows: Row[]): string {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = (v: any) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n');
}

export default function AuditExport() {
  const [source, setSource] = useState(SOURCES[0].id);
  const [from, setFrom] = useState<string>(new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString().split('T')[0]);
  const [to, setTo] = useState<string>(new Date().toISOString().split('T')[0]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const dateCol = source === 'role_recert_campaigns' ? 'created_at'
                  : source === 'role_recert_items' ? 'created_at'
                  : 'created_at';
    const { data, error } = await (supabase as any).from(source).select('*')
      .gte(dateCol, from + 'T00:00:00Z')
      .lte(dateCol, to + 'T23:59:59Z')
      .order(dateCol, { ascending: false }).limit(5000);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setRows(data ?? []);
  };

  const downloadCsv = () => {
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `${source}_${from}_${to}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };
  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `${source}_${from}_${to}.json`;
    a.click(); URL.revokeObjectURL(url);
  };
  const printPdf = () => window.print();

  return (
    <div className="space-y-4 print:space-y-2">
      <div className="print:hidden">
        <h2 className="text-lg font-semibold flex items-center gap-2"><FileDown className="w-5 h-5" /> Audit-Exporte</h2>
        <p className="text-xs text-muted-foreground">Exportiert Compliance-Nachweise (ISO 27001 / SOX) als CSV, JSON oder PDF.</p>
      </div>

      <Card className="p-4 print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <Label>Quelle</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{SOURCES.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Von</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><Label>Bis</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
          <Button onClick={load} disabled={loading}>{loading && <Loader2 className="w-3 h-3 mr-1 animate-spin" />} Laden</Button>
        </div>
        {rows.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            <Button size="sm" variant="outline" onClick={downloadCsv}><FileSpreadsheet className="w-3 h-3 mr-1" /> CSV</Button>
            <Button size="sm" variant="outline" onClick={downloadJson}><FileJson className="w-3 h-3 mr-1" /> JSON</Button>
            <Button size="sm" variant="outline" onClick={printPdf}><Printer className="w-3 h-3 mr-1" /> PDF drucken</Button>
          </div>
        )}
      </Card>

      {rows.length > 0 && (
        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-2">
            {SOURCES.find(s => s.id === source)?.label} · {rows.length} Einträge · {from} – {to}
          </div>
          <div className="border rounded-md max-h-[600px] overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-background border-b">
                <tr>{Object.keys(rows[0]).map(c => <th key={c} className="p-2 text-left font-medium">{c}</th>)}</tr>
              </thead>
              <tbody>
                {rows.slice(0, 500).map((r, i) => (
                  <tr key={i} className="border-b hover:bg-muted/30">
                    {Object.keys(rows[0]).map(c => (
                      <td key={c} className="p-2 font-mono max-w-[200px] truncate" title={typeof r[c] === 'object' ? JSON.stringify(r[c]) : String(r[c] ?? '')}>
                        {typeof r[c] === 'object' ? JSON.stringify(r[c]) : String(r[c] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 500 && <div className="text-[10px] text-muted-foreground mt-2">Zeige 500 von {rows.length} — Export enthält alle.</div>}
        </Card>
      )}
    </div>
  );
}

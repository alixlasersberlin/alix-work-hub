import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { BUG_STATUS, CAPA_STATUS } from './_shared';

function toCsv(rows: Record<string, any>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(';'), ...rows.map(r => headers.map(h => escape(r[h])).join(';'))].join('\n');
}

function download(filename: string, csv: string) {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const EXPORTS: { key: string; label: string; table: string }[] = [
  { key: 'bugs', label: 'Bugs', table: 'bugs' },
  { key: 'capas', label: 'CAPA', table: 'capas' },
  { key: 'audit', label: 'Audit-Feststellungen', table: 'audit_findings' },
  { key: 'actions', label: 'Maßnahmen', table: 'capa_actions' },
];

export default function Berichte() {
  const [bugs, setBugs] = useState<Record<string, number>>({});
  const [capas, setCapas] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const sb = supabase as any;
      const [b, c] = await Promise.all([
        sb.from('bugs').select('status'),
        sb.from('capas').select('status'),
      ]);
      const bag = (rows: any[] | null) => (rows ?? []).reduce<Record<string, number>>((acc, r) => {
        acc[r.status] = (acc[r.status] ?? 0) + 1;
        return acc;
      }, {});
      setBugs(bag(b.data));
      setCapas(bag(c.data));
    })();
  }, []);

  async function exportCsv(table: string, label: string) {
    setBusy(table);
    const { data, error } = await (supabase as any).from(table).select('*').order('created_at', { ascending: false }).limit(5000);
    setBusy(null);
    if (error) { toast.error('Export fehlgeschlagen: ' + error.message); return; }
    if (!data || data.length === 0) { toast.info('Keine Daten zum Export.'); return; }
    const ts = new Date().toISOString().slice(0, 10);
    download(`${label}-${ts}.csv`, toCsv(data));
    toast.success(`${label} exportiert (${data.length})`);
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Bugs nach Status</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {BUG_STATUS.map(s => (
            <div key={s} className="flex justify-between border-b border-border pb-1">
              <span className="text-sm">{s.replace(/_/g, ' ')}</span>
              <span className="font-mono font-medium">{bugs[s] ?? 0}</span>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>CAPA nach Status</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {CAPA_STATUS.map(s => (
            <div key={s} className="flex justify-between border-b border-border pb-1">
              <span className="text-sm">{s.replace(/_/g, ' ')}</span>
              <span className="font-mono font-medium">{capas[s] ?? 0}</span>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card className="md:col-span-2">
        <CardHeader><CardTitle>CSV-Export</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {EXPORTS.map(e => (
            <Button key={e.key} variant="outline" disabled={busy === e.table} onClick={() => exportCsv(e.table, e.label)}>
              <Download className="h-4 w-4 mr-2" />
              {busy === e.table ? 'Exportiere…' : e.label}
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

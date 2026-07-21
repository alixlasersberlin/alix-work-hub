import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { FileUp, ArrowRight, Download, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Workflow } from 'lucide-react';

const NAME_KEYS = ['kunde', 'kundenname', 'customer', 'name', 'firma', 'company', 'customer_name'];

function pickKey(row: Record<string, any>, candidates: string[]): string | null {
  const keys = Object.keys(row);
  for (const c of candidates) {
    const k = keys.find(k => k.trim().toLowerCase().replace(/[_\-\s]/g, '') === c.replace(/[_\-\s]/g, ''));
    if (k) return k;
  }
  return null;
}

function normName(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').replace(/[.,;:()"']/g, '').trim();
}

export default function AuftragsImport() {
  const nav = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [filename, setFilename] = useState('');
  const [running, setRunning] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFilename(f.name);
    const buf = await f.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<any>(ws, { defval: '' });
    setRows(json);
    toast.success(`${json.length} Zeilen eingelesen`);
  }

  async function runMatch() {
    if (!rows.length) return;
    setRunning(true);
    try {
      const orderKey = pickKey(rows[0], ORDER_KEYS);
      const nameKey = pickKey(rows[0], NAME_KEYS);
      if (!orderKey && !nameKey) {
        toast.error('Keine Spalte "Auftragsnummer" oder "Kunde" gefunden.');
        setRunning(false);
        return;
      }

      const orderNumbers = Array.from(new Set(rows
        .map(r => orderKey ? stripAt(String(r[orderKey] ?? '')) : '')
        .filter(Boolean)));
      const names = Array.from(new Set(rows
        .map(r => nameKey ? String(r[nameKey] ?? '').trim() : '')
        .filter(Boolean)));

      const foundNumbers = new Map<string, any>();
      for (let i = 0; i < orderNumbers.length; i += 200) {
        const chunk = orderNumbers.slice(i, i + 200);
        const { data } = await (supabase as any)
          .from('orders')
          .select('id, order_number, customer_name, source_system, total, status')
          .in('order_number', chunk);
        (data ?? []).forEach((o: any) => foundNumbers.set(String(o.order_number), o));
      }

      const foundNames = new Map<string, any>();
      if (nameKey && names.length) {
        for (let i = 0; i < names.length; i += 50) {
          const chunk = names.slice(i, i + 50);
          const orFilter = chunk.map(n => `customer_name.ilike.%${n.replace(/[,()]/g, '')}%`).join(',');
          const { data } = await (supabase as any)
            .from('orders')
            .select('id, order_number, customer_name, source_system, total, status')
            .or(orFilter)
            .limit(500);
          (data ?? []).forEach((o: any) => {
            const key = String(o.customer_name ?? '').toLowerCase();
            if (!foundNames.has(key)) foundNames.set(key, o);
          });
        }
      }

      const results = rows.map((r, idx) => {
        const num = orderKey ? stripAt(String(r[orderKey] ?? '')) : '';
        const name = nameKey ? String(r[nameKey] ?? '').trim() : '';
        let match: any = null;
        if (num && foundNumbers.has(num)) match = foundNumbers.get(num);
        if (!match && name) {
          const nameL = name.toLowerCase();
          for (const [k, v] of foundNames) {
            if (k.includes(nameL) || nameL.includes(k)) { match = v; break; }
          }
        }
        return {
          idx,
          input: { num, name, raw: r },
          found: !!match,
          match,
        };
      });

      sessionStorage.setItem('auftragsabgleich:results', JSON.stringify({
        filename,
        at: new Date().toISOString(),
        rows: results,
      }));
      toast.success(`Abgleich fertig: ${results.filter(r => r.found).length}/${results.length} gefunden`);
      nav('/operation/auftrags-abgleich');
    } catch (e: any) {
      toast.error(e.message ?? 'Fehler beim Abgleich');
    } finally {
      setRunning(false);
    }
  }

  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Auftragsnummer', 'Kunde'],
      ['2026-04226', 'Beispiel Kunde GmbH'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Aufträge');
    XLSX.writeFile(wb, 'auftragsabgleich-vorlage.xlsx');
  }

  const preview = rows.slice(0, 8);
  const cols = rows.length ? Object.keys(rows[0]).slice(0, 6) : [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader icon={Workflow} title="Auftragsabgleich – Import" subtitle="XLSX/CSV hochladen und mit vorhandenen Aufträgen abgleichen." />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><FileUp className="h-4 w-4" /> Datei hochladen</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={downloadTemplate}><Download className="h-4 w-4 mr-2" />Vorlage</Button>
            <Link to="/operation/auftrags-abgleich"><Button variant="ghost" size="sm">Zum Abgleich <ArrowRight className="h-4 w-4 ml-2" /></Button></Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} />
          <p className="text-xs text-muted-foreground">
            Spalten: <Badge variant="outline">Auftragsnummer</Badge> und/oder <Badge variant="outline">Kunde</Badge>. Suffix „-AT" wird automatisch ignoriert.
          </p>
          {filename && <p className="text-xs">Datei: <span className="font-mono">{filename}</span> · {rows.length} Zeilen</p>}
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Vorschau ({rows.length} Zeilen)</CardTitle>
            <Button onClick={runMatch} disabled={running}>
              {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowRight className="h-4 w-4 mr-2" />}
              Abgleich starten
            </Button>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40"><tr className="text-left">{cols.map(c => <th key={c} className="p-2">{c}</th>)}</tr></thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    {cols.map(c => <td key={c} className="p-2">{String(r[c] ?? '')}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 8 && <p className="p-3 text-xs text-muted-foreground">… {rows.length - 8} weitere Zeilen</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

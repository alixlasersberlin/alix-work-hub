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
      const nameKey = pickKey(rows[0], NAME_KEYS);
      if (!nameKey) {
        toast.error('Keine Spalte "Kunde"/"Kundenname" gefunden.');
        setRunning(false);
        return;
      }

      const names = Array.from(new Set(rows
        .map(r => String(r[nameKey] ?? '').trim())
        .filter(Boolean)));

      const foundNames = new Map<string, any[]>();
      const addHit = (key: string, hit: any) => {
        const arr = foundNames.get(key) ?? [];
        arr.push(hit);
        foundNames.set(key, arr);
      };

      const sources: Array<{ table: string; label: string; numCol: string; select: string; route: string; fields: string[] }> = [
        { table: 'orders', label: 'Auftrag', numCol: 'order_number', select: 'id, order_number, customer_name, contact_name, source_system, total, status, customer_id', route: '/orders', fields: ['customer_name', 'contact_name'] },
        { table: 'offers', label: 'Angebot', numCol: 'offer_number', select: 'id, offer_number, customer_name, contact_name, status, total, customer_id', route: '/offers', fields: ['customer_name', 'contact_name'] },
        { table: 'finance_contracts', label: 'Vertrag', numCol: 'contract_number', select: 'id, contract_number, customer_name, status, customer_id', route: '/finance/contracts', fields: ['customer_name'] },
        { table: 'repair_orders', label: 'Reparatur', numCol: 'repair_number', select: 'id, repair_number, customer_name, contact_name, status, customer_id', route: '/repair', fields: ['customer_name', 'contact_name'] },
      ];

      // Per-name token search — matches regardless of word order ("Jogl, Michelle" vs "Michelle Jogl").
      const cleanTok = (s: string) => s.replace(/[,%()]/g, ' ').replace(/\s+/g, ' ').trim();
      for (const name of names) {
        const key = normName(name);
        if (!key) continue;
        const tokens = key.split(' ').map(cleanTok).filter(t => t.length >= 3);
        if (!tokens.length) continue;

        // Also resolve matching customers (company_name / contact_name) → their IDs
        let customerIds: string[] = [];
        try {
          let cq: any = (supabase as any).from('customers').select('id').limit(50);
          for (const t of tokens) cq = cq.or(`company_name.ilike.%${t}%,contact_name.ilike.%${t}%`);
          const { data: cs } = await cq;
          customerIds = (cs ?? []).map((c: any) => c.id);
        } catch { /* ignore */ }

        for (const src of sources) {
          const runQuery = async (field: string) => {
            try {
              let q: any = (supabase as any).from(src.table).select(src.select).limit(200);
              for (const t of tokens) q = q.ilike(field, `%${t}%`);
              const { data } = await q;
              return data ?? [];
            } catch { return []; }
          };
          const perSource: any[] = [];
          for (const f of src.fields) perSource.push(...await runQuery(f));
          if (customerIds.length) {
            try {
              const { data } = await (supabase as any).from(src.table).select(src.select).in('customer_id', customerIds).limit(200);
              perSource.push(...(data ?? []));
            } catch { /* ignore */ }
          }
          const seen = new Set<string>();
          for (const o of perSource) {
            if (seen.has(o.id)) continue;
            seen.add(o.id);
            addHit(key, {
              id: o.id,
              order_number: o[src.numCol] ?? '',
              customer_name: o.customer_name ?? o.contact_name,
              status: o.status,
              source_system: o.source_system,
              source_kind: src.label,
              source_route: src.route,
            });
          }
        }
      }

      const results = rows.map((r, idx) => {
        const name = String(r[nameKey] ?? '').trim();
        const nameL = normName(name);
        const matches = nameL ? (foundNames.get(nameL) ?? []) : [];
        return {
          idx,
          input: { num: '', name, raw: r },
          found: matches.length > 0,
          match: matches[0] ?? null,
          matches,
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
      ['Kunde'],
      ['Beispiel Kunde GmbH'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Kunden');
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
            Spalte: <Badge variant="outline">Kunde</Badge> (bzw. Kundenname/Firma). Abgleich erfolgt ausschließlich anhand des Kundennamens.
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

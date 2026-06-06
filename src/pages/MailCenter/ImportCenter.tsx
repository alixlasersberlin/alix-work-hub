import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Target = 'customers' | 'mail_templates' | 'mail_unsubscribes';

function parseCSV(text: string): any[] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const cells = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g)?.slice(0, headers.length) || [];
    const row: any = {};
    headers.forEach((h, i) => {
      let v = (cells[i] || '').replace(/,$/, '').trim().replace(/^"|"$/g, '').replace(/""/g, '"');
      row[h] = v;
    });
    return row;
  });
}

export default function Import() {
  const [target, setTarget] = useState<Target>('mail_unsubscribes');
  const [rows, setRows] = useState<any[]>([]);
  const [filename, setFilename] = useState('');
  const [importing, setImporting] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFilename(f.name);
    const text = await f.text();
    let parsed: any[] = [];
    try {
      if (f.name.endsWith('.json')) parsed = JSON.parse(text);
      else parsed = parseCSV(text);
    } catch (err: any) { toast.error('Parsen fehlgeschlagen: ' + err.message); return; }
    setRows(parsed);
    toast.success(`${parsed.length} Zeilen gelesen`);
  }

  async function doImport() {
    if (!rows.length) return;
    setImporting(true);
    try {
      const batch = 200;
      let inserted = 0;
      for (let i = 0; i < rows.length; i += batch) {
        const chunk = rows.slice(i, i + batch);
        const { error } = await supabase.from(target as any).insert(chunk);
        if (error) throw error;
        inserted += chunk.length;
      }
      toast.success(`${inserted} Zeilen importiert`);
      setRows([]); setFilename('');
    } catch (e: any) {
      toast.error(e.message);
    } finally { setImporting(false); }
  }

  const cols = rows.length ? Object.keys(rows[0]).slice(0, 6) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2"><Upload className="w-5 h-5 text-primary" /><h2 className="text-xl font-semibold">Import Center</h2></div>

      <Card>
        <CardHeader><CardTitle className="text-base">Datei wählen</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 max-w-2xl">
            <div>
              <label className="text-sm font-medium">Ziel</label>
              <Select value={target} onValueChange={(v: any) => setTarget(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mail_unsubscribes">Abmeldungen</SelectItem>
                  <SelectItem value="mail_templates">Vorlagen</SelectItem>
                  <SelectItem value="customers">Kunden</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">CSV / JSON / XLSX</label>
              <Input type="file" accept=".csv,.json,.xlsx" onChange={onFile} />
            </div>
          </div>
          {filename && <p className="text-xs text-muted-foreground">{filename}</p>}
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Vorschau ({rows.length} Zeilen)</CardTitle>
            <Button onClick={doImport} disabled={importing}><CheckCircle2 className="w-4 h-4 mr-2" />{importing ? 'Importiere…' : 'Import starten'}</Button>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40"><tr className="text-left">{cols.map(c => <th key={c} className="p-2">{c}</th>)}</tr></thead>
              <tbody>
                {rows.slice(0, 10).map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    {cols.map(c => <td key={c} className="p-2">{String(r[c] || '')}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 10 && <p className="p-3 text-xs text-muted-foreground">… {rows.length - 10} weitere Zeilen</p>}
          </CardContent>
        </Card>
      )}

      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm">XLSX wird über SheetJS gelesen – Datei vorher in CSV/JSON konvertieren oder eine Edge Function ergänzen. Spalten müssen exakt mit den Zielspalten übereinstimmen.</p>
        </CardContent>
      </Card>
    </div>
  );
}

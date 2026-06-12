import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, ArrowLeft, CheckCircle2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Felder im sales_leads-Schema, die per CSV befüllbar sind
const TARGET_FIELDS = [
  '— nicht importieren —',
  'lead_status',
  'source',
  'form_name',
  'first_name',
  'last_name',
  'company',
  'email',
  'phone',
  'street',
  'zip',
  'city',
  'country',
  'requested_products',
  'device_category',
  'customer_goal',
  'implementation_period',
  'additional_services',
  'service_rating',
  'consultation_type',
  'delivery_preference',
  'message',
  'notes',
];

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter(l => l.length > 0);
  if (!lines.length) return { headers: [], rows: [] };
  const split = (line: string): string[] => {
    const out: string[] = [];
    let cur = ''; let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') q = false;
        else cur += ch;
      } else {
        if (ch === ',' || ch === ';' || ch === '\t') { out.push(cur); cur = ''; }
        else if (ch === '"') q = true;
        else cur += ch;
      }
    }
    out.push(cur);
    return out;
  };
  const headers = split(lines[0]).map(h => h.trim());
  const rows = lines.slice(1).map(line => {
    const cells = split(line);
    const o: Record<string, string> = {};
    headers.forEach((h, i) => { o[h] = (cells[i] ?? '').trim(); });
    return o;
  });
  return { headers, rows };
}

export default function SalesLeadsImport() {
  const nav = useNavigate();
  const [filename, setFilename] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [defaultSource, setDefaultSource] = useState('csv');
  const [defaultStatus, setDefaultStatus] = useState('Neu');
  const [importing, setImporting] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFilename(f.name);
    const text = await f.text();
    const parsed = parseCSV(text);
    setHeaders(parsed.headers);
    setRows(parsed.rows);
    // Auto-Mapping by exact name match
    const initial: Record<string, string> = {};
    parsed.headers.forEach(h => {
      const lc = h.toLowerCase().replace(/\s+/g, '_');
      if (TARGET_FIELDS.includes(lc)) initial[h] = lc;
    });
    setMapping(initial);
    toast.success(`${parsed.rows.length} Zeilen gelesen`);
  }

  const mapped = useMemo(() => {
    return rows.map(r => {
      const o: any = { source: defaultSource, lead_status: defaultStatus };
      Object.entries(mapping).forEach(([csvCol, field]) => {
        if (field && field !== '— nicht importieren —') {
          let v: any = r[csvCol];
          if (v === '' || v == null) return;
          if (field === 'service_rating') v = Number(v) || null;
          if (field === 'additional_services') {
            v = String(v).split(/[;,|]/).map(x => x.trim()).filter(Boolean);
          }
          o[field] = v;
        }
      });
      return o;
    });
  }, [rows, mapping, defaultSource, defaultStatus]);

  async function doImport() {
    if (!mapped.length) return;
    setImporting(true);
    try {
      const batch = 200;
      let ok = 0;
      for (let i = 0; i < mapped.length; i += batch) {
        const chunk = mapped.slice(i, i + batch);
        const { error } = await supabase.from('sales_leads').insert(chunk);
        if (error) throw error;
        ok += chunk.length;
      }
      toast.success(`${ok} Anfragen importiert`);
      setRows([]); setHeaders([]); setMapping({}); setFilename('');
      nav('/verkauf/anfragen');
    } catch (e: any) {
      toast.error(e.message ?? 'Import fehlgeschlagen');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => nav('/verkauf/anfragen')}><ArrowLeft className="h-4 w-4 mr-1" />Zurück</Button>
        <Upload className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">Verkaufsanfragen – CSV-Import</h1>
          <p className="text-sm text-muted-foreground">Spalten zuordnen und in die Anfragenliste übernehmen</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">1. Datei wählen</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input type="file" accept=".csv,.tsv,.txt" onChange={onFile} />
          {filename && <p className="text-xs text-muted-foreground">{filename} – {rows.length} Zeilen</p>}
        </CardContent>
      </Card>

      {headers.length > 0 && (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base">2. Standardwerte</CardTitle></CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm">Quelle</label>
                <Select value={defaultSource} onValueChange={setDefaultSource}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV-Import</SelectItem>
                    <SelectItem value="zoho_forms">Zoho Forms</SelectItem>
                    <SelectItem value="website">Website</SelectItem>
                    <SelectItem value="phone">Telefon</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="api">API</SelectItem>
                    <SelectItem value="manual">Manuell</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm">Status (Standard)</label>
                <Select value={defaultStatus} onValueChange={setDefaultStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Neu">Neu</SelectItem>
                    <SelectItem value="Importiert - Angebot offen">Importiert – Angebot offen</SelectItem>
                    <SelectItem value="In Bearbeitung">In Bearbeitung</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">3. Spalten-Mapping</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {headers.map(h => (
                <div key={h} className="grid grid-cols-2 gap-2 items-center">
                  <div className="text-sm font-mono truncate">{h}</div>
                  <Select value={mapping[h] || '— nicht importieren —'} onValueChange={(v) => setMapping(m => ({ ...m, [h]: v }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TARGET_FIELDS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">4. Vorschau ({rows.length} Zeilen)</CardTitle>
              <Button onClick={doImport} disabled={importing || mapped.length === 0}>
                <CheckCircle2 className="h-4 w-4 mr-2" />{importing ? 'Importiere…' : 'Import starten'}
              </Button>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    {Object.values(mapping).filter(v => v && v !== '— nicht importieren —').slice(0, 8).map(f => (
                      <th key={f} className="p-2">{f}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mapped.slice(0, 10).map((r, i) => (
                    <tr key={i} className="border-t">
                      {Object.values(mapping).filter(v => v && v !== '— nicht importieren —').slice(0, 8).map(f => (
                        <td key={f} className="p-2">{Array.isArray(r[f]) ? r[f].join(', ') : (r[f] ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}

      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm">
            Empfohlene Spaltennamen: <code>first_name, last_name, company, email, phone, device_category, customer_goal, implementation_period, additional_services, service_rating</code>. Mehrere Zusatzleistungen mit <code>;</code> oder <code>,</code> trennen. Leadnummer wird automatisch erzeugt.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

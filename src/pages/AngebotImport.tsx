import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileDown, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Trash2, ArrowRight, History } from 'lucide-react';
import { toast } from 'sonner';

type RawRow = Record<string, any>;

type ParsedRow = {
  __rowIndex: number;
  group: string;
  kunde_firma: string;
  kunde_email: string;
  artikel_sku: string;
  artikel_name: string;
  beschreibung: string;
  menge: number;
  einzelpreis: number;
  mwst: number;
  errors: string[];
};

type HistoryEntry = {
  id: string;
  filename: string;
  rows: number;
  groups: number;
  errors: number;
  at: string;
};

const HEADERS = [
  'gruppe',
  'kunde_firma',
  'kunde_email',
  'artikel_sku',
  'artikel_name',
  'beschreibung',
  'menge',
  'einzelpreis',
  'mwst',
];

const TEMPLATE_ROWS: any[][] = [
  HEADERS,
  ['Angebot-1', 'Beispiel GmbH', 'kontakt@beispiel.de', 'SKU-001', 'Alix BlueIce Weiss', 'Beschreibung optional', 1, 1990, 19],
  ['Angebot-1', 'Beispiel GmbH', 'kontakt@beispiel.de', 'SKU-022', 'Zubehör Set', 2, 89.5, 19],
  ['Angebot-2', 'Studio Aurora', 'info@aurora.at', 'SKU-101', 'Alix Twin +IPL', 1, 5400, 20],
];

const STORAGE_HISTORY = 'angebot_import_history_v1';
const STORAGE_HANDOFF = 'angebot_import_handoff_v1';

function loadHistory(): HistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_HISTORY) || '[]'); } catch { return []; }
}
function saveHistory(h: HistoryEntry[]) {
  localStorage.setItem(STORAGE_HISTORY, JSON.stringify(h.slice(0, 20)));
}

function validateRow(r: RawRow, idx: number): ParsedRow {
  const errors: string[] = [];
  const get = (k: string) => {
    const key = Object.keys(r).find(x => x.trim().toLowerCase() === k);
    return key !== undefined ? r[key] : '';
  };
  const num = (v: any) => {
    if (v === '' || v == null) return NaN;
    const s = String(v).replace(/\./g, '').replace(',', '.').replace(/[^\d.\-]/g, '');
    return Number(s);
  };
  const group = String(get('gruppe') ?? '').trim();
  const kunde_firma = String(get('kunde_firma') ?? '').trim();
  const kunde_email = String(get('kunde_email') ?? '').trim();
  const artikel_sku = String(get('artikel_sku') ?? '').trim();
  const artikel_name = String(get('artikel_name') ?? '').trim();
  const beschreibung = String(get('beschreibung') ?? '').trim();
  const menge = num(get('menge'));
  const einzelpreis = num(get('einzelpreis'));
  const mwst = num(get('mwst'));

  if (!group) errors.push('gruppe fehlt');
  if (!kunde_firma && !kunde_email) errors.push('kunde fehlt');
  if (!artikel_sku && !artikel_name) errors.push('artikel fehlt');
  if (!Number.isFinite(menge) || menge <= 0) errors.push('menge ungültig');
  if (!Number.isFinite(einzelpreis) || einzelpreis < 0) errors.push('einzelpreis ungültig');
  if (!Number.isFinite(mwst) || mwst < 0 || mwst > 100) errors.push('mwst ungültig');

  return {
    __rowIndex: idx + 2, // header is row 1
    group,
    kunde_firma,
    kunde_email,
    artikel_sku,
    artikel_name,
    beschreibung,
    menge: Number.isFinite(menge) ? menge : 0,
    einzelpreis: Number.isFinite(einzelpreis) ? einzelpreis : 0,
    mwst: Number.isFinite(mwst) ? mwst : 0,
    errors,
  };
}

export default function AngebotImport() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => { setHistory(loadHistory()); }, []);

  const summary = useMemo(() => {
    const total = rows.length;
    const errors = rows.filter(r => r.errors.length > 0).length;
    const groups = new Set(rows.filter(r => r.errors.length === 0).map(r => r.group)).size;
    return { total, errors, groups };
  }, [rows]);

  const groupMap = useMemo(() => {
    const map = new Map<string, ParsedRow[]>();
    rows.filter(r => r.errors.length === 0).forEach(r => {
      const list = map.get(r.group) ?? [];
      list.push(r);
      map.set(r.group, list);
    });
    return map;
  }, [rows]);

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = ev.target?.result;
        const wb = XLSX.read(data, { type: typeof data === 'string' ? 'string' : 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json: RawRow[] = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
        const parsed = json.map((r, i) => validateRow(r, i));
        setRows(parsed);
        toast.success(`${parsed.length} Zeilen eingelesen`);
      } catch (e: any) {
        toast.error('Datei konnte nicht gelesen werden: ' + e.message);
      }
    };
    if (file.name.toLowerCase().endsWith('.csv')) reader.readAsText(file);
    else reader.readAsArrayBuffer(file);
  }

  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet(TEMPLATE_ROWS);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Angebote');
    XLSX.writeFile(wb, 'angebot-import-vorlage.xlsx');
  }

  function downloadTemplateCsv() {
    const csv = TEMPLATE_ROWS.map(r => r.map(c => {
      const s = String(c ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'angebot-import-vorlage.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function clearAll() {
    setRows([]);
    setFileName('');
    if (fileRef.current) fileRef.current.value = '';
  }

  function commitHistory() {
    const entry: HistoryEntry = {
      id: crypto.randomUUID(),
      filename: fileName || 'unbenannt',
      rows: summary.total,
      groups: summary.groups,
      errors: summary.errors,
      at: new Date().toISOString(),
    };
    const next = [entry, ...history];
    setHistory(next);
    saveHistory(next);
  }

  function openGroupInEditor(group: string) {
    const groupRows = groupMap.get(group);
    if (!groupRows || groupRows.length === 0) return;
    const handoff = {
      group,
      kunde_firma: groupRows[0].kunde_firma,
      kunde_email: groupRows[0].kunde_email,
      lines: groupRows.map(r => ({
        sku: r.artikel_sku,
        name: r.artikel_name,
        description: r.beschreibung,
        quantity: r.menge,
        rate: r.einzelpreis,
        tax_percentage: r.mwst,
      })),
      createdAt: new Date().toISOString(),
    };
    sessionStorage.setItem(STORAGE_HANDOFF, JSON.stringify(handoff));
    commitHistory();
    navigate('/verkauf/angebot/neu');
  }

  return (
    <div className="p-6 lg:p-8 animate-fade-in space-y-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-primary" /> Angebot · Data Import
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            CSV/Excel Vorlage hochladen, validieren und Angebote als Entwurf öffnen. Nur Super Admin.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={downloadTemplate}><FileDown className="w-4 h-4 mr-2" /> Vorlage .xlsx</Button>
          <Button variant="outline" size="sm" onClick={downloadTemplateCsv}><FileDown className="w-4 h-4 mr-2" /> Vorlage .csv</Button>
        </div>
      </div>

      <Card className="card-glow">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Upload className="w-4 h-4 text-primary" /> Datei hochladen</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
          >
            <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-foreground font-medium">Datei hier ablegen oder klicken</p>
            <p className="text-xs text-muted-foreground mt-1">Unterstützt: .xlsx, .xls, .csv · Spalten: {HEADERS.join(', ')}</p>
            {fileName && <p className="text-xs text-primary mt-3">Geladen: {fileName}</p>}
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={e => handleFiles(e.target.files)}
            />
          </div>
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Zeilen</p><p className="text-2xl font-bold">{summary.total}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Angebote (gültig)</p><p className="text-2xl font-bold text-primary">{summary.groups}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Fehlerhafte Zeilen</p><p className={`text-2xl font-bold ${summary.errors ? 'text-destructive' : 'text-emerald-500'}`}>{summary.errors}</p></CardContent></Card>
            <Card><CardContent className="p-4 flex items-center justify-end"><Button variant="ghost" size="sm" onClick={clearAll}><Trash2 className="w-4 h-4 mr-2" /> Zurücksetzen</Button></CardContent></Card>
          </div>

          <Card className="card-glow">
            <CardHeader><CardTitle className="text-base">Vorschau</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-secondary/40">
                    <tr className="text-left text-muted-foreground">
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Gruppe</th>
                      <th className="px-3 py-2">Kunde</th>
                      <th className="px-3 py-2">Artikel</th>
                      <th className="px-3 py-2 text-right">Menge</th>
                      <th className="px-3 py-2 text-right">Preis</th>
                      <th className="px-3 py-2 text-right">MwSt%</th>
                      <th className="px-3 py-2">Hinweise</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map(r => (
                      <tr key={r.__rowIndex} className={r.errors.length ? 'bg-destructive/5' : ''}>
                        <td className="px-3 py-2 text-muted-foreground">{r.__rowIndex}</td>
                        <td className="px-3 py-2">
                          {r.errors.length === 0
                            ? <Badge variant="outline" className="text-emerald-500 border-emerald-500/30"><CheckCircle2 className="w-3 h-3 mr-1" />OK</Badge>
                            : <Badge variant="outline" className="text-destructive border-destructive/30"><AlertTriangle className="w-3 h-3 mr-1" />Fehler</Badge>}
                        </td>
                        <td className="px-3 py-2 font-medium">{r.group || '—'}</td>
                        <td className="px-3 py-2">{r.kunde_firma}{r.kunde_email && <div className="text-muted-foreground">{r.kunde_email}</div>}</td>
                        <td className="px-3 py-2">{r.artikel_name || r.artikel_sku}{r.artikel_sku && r.artikel_name && <div className="text-muted-foreground">{r.artikel_sku}</div>}</td>
                        <td className="px-3 py-2 text-right">{r.menge}</td>
                        <td className="px-3 py-2 text-right">{r.einzelpreis.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</td>
                        <td className="px-3 py-2 text-right">{r.mwst}</td>
                        <td className="px-3 py-2 text-destructive">{r.errors.join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {groupMap.size > 0 && (
            <Card className="card-glow">
              <CardHeader><CardTitle className="text-base">Gültige Angebote ({groupMap.size})</CardTitle></CardHeader>
              <CardContent>
                <div className="grid gap-2">
                  {Array.from(groupMap.entries()).map(([group, gRows]) => {
                    const sum = gRows.reduce((s, r) => s + r.menge * r.einzelpreis, 0);
                    return (
                      <div key={group} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                        <div>
                          <p className="font-medium text-sm">{group}</p>
                          <p className="text-xs text-muted-foreground">{gRows[0].kunde_firma || gRows[0].kunde_email} · {gRows.length} Position(en) · {sum.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</p>
                        </div>
                        <Button size="sm" onClick={() => openGroupInEditor(group)}>
                          Im Editor öffnen <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Card className="card-glow">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><History className="w-4 h-4 text-primary" /> Import-Historie</CardTitle></CardHeader>
        <CardContent className="p-0">
          {history.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Noch keine Imports.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-secondary/40">
                  <tr className="text-left text-muted-foreground">
                    <th className="px-3 py-2">Datum</th>
                    <th className="px-3 py-2">Datei</th>
                    <th className="px-3 py-2 text-right">Zeilen</th>
                    <th className="px-3 py-2 text-right">Angebote</th>
                    <th className="px-3 py-2 text-right">Fehler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {history.map(h => (
                    <tr key={h.id}>
                      <td className="px-3 py-2">{new Date(h.at).toLocaleString('de-DE')}</td>
                      <td className="px-3 py-2">{h.filename}</td>
                      <td className="px-3 py-2 text-right">{h.rows}</td>
                      <td className="px-3 py-2 text-right text-primary">{h.groups}</td>
                      <td className={`px-3 py-2 text-right ${h.errors ? 'text-destructive' : ''}`}>{h.errors}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

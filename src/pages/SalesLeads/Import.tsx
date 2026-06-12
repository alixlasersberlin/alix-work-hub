import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Upload, ArrowLeft, CheckCircle2, AlertTriangle, FileText, FileSpreadsheet, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Felder im sales_leads-Schema, die per Import befüllbar sind
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

// Aliasse (DE/EN) → sales_leads-Feld. Werden für TXT/Label-Parsing genutzt.
const LABEL_ALIASES: Record<string, string> = {
  // Name
  'vorname': 'first_name', 'first name': 'first_name', 'first_name': 'first_name',
  'nachname': 'last_name', 'last name': 'last_name', 'last_name': 'last_name',
  'name': 'first_name', // wird unten ggf. in Vor-/Nachname gesplittet
  // Kontakt
  'firma': 'company', 'unternehmen': 'company', 'company': 'company',
  'e-mail': 'email', 'email': 'email', 'mail': 'email',
  'telefon': 'phone', 'telefonnummer': 'phone', 'phone': 'phone', 'mobil': 'phone', 'tel': 'phone',
  // Adresse
  'strasse': 'street', 'straße': 'street', 'street': 'street', 'adresse': 'street',
  'plz': 'zip', 'postleitzahl': 'zip', 'zip': 'zip',
  'stadt': 'city', 'ort': 'city', 'city': 'city',
  'land': 'country', 'country': 'country',
  // Inhalt
  'geräteklasse': 'device_category', 'geraeteklasse': 'device_category', 'device category': 'device_category', 'device_category': 'device_category', 'gerät': 'device_category', 'geraet': 'device_category', 'kategorie': 'device_category',
  'zusatzleistungen': 'additional_services', 'zusatzleistung': 'additional_services', 'additional services': 'additional_services', 'additional_services': 'additional_services', 'services': 'additional_services',
  'ziel': 'customer_goal', 'kundenziel': 'customer_goal', 'customer goal': 'customer_goal', 'customer_goal': 'customer_goal', 'zielsetzung': 'customer_goal',
  'zeitraum': 'implementation_period', 'umsetzungszeitraum': 'implementation_period', 'implementation period': 'implementation_period', 'implementation_period': 'implementation_period', 'zeitplan': 'implementation_period',
  'wunschprodukt': 'requested_products', 'wunschprodukte': 'requested_products', 'produkte': 'requested_products', 'requested products': 'requested_products', 'requested_products': 'requested_products', 'interesse': 'requested_products',
  'bewertung': 'service_rating', 'rating': 'service_rating', 'service rating': 'service_rating', 'service_rating': 'service_rating', 'sterne': 'service_rating',
  'beratungsart': 'consultation_type', 'consultation': 'consultation_type', 'consultation_type': 'consultation_type',
  'lieferpräferenz': 'delivery_preference', 'lieferpraeferenz': 'delivery_preference', 'delivery': 'delivery_preference', 'delivery_preference': 'delivery_preference',
  'nachricht': 'message', 'message': 'message',
  'notiz': 'notes', 'notizen': 'notes', 'note': 'notes', 'notes': 'notes', 'bemerkung': 'notes',
  // Quelle / Status
  'quelle': 'source', 'lead source': 'source', 'lead_source': 'source', 'source': 'source',
  'status': 'lead_status', 'lead status': 'lead_status', 'lead_status': 'lead_status',
  'formular': 'form_name', 'form': 'form_name', 'form_name': 'form_name',
};

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

// Parser für TXT-Blöcke wie "Label: Wert".
// Mehrere Anfragen können durch Leerzeile, "---" oder "===" getrennt werden.
function parseTxtBlocks(text: string): Record<string, any>[] {
  const blocks = text
    .split(/\n\s*(?:---+|===+)\s*\n|\n\s*\n\s*\n/g) // Trenner: ---, === oder doppelte Leerzeile
    .map(b => b.trim())
    .filter(Boolean);

  const out: Record<string, any>[] = [];
  for (const block of blocks) {
    const lines = block.split(/\r?\n/);
    const obj: Record<string, any> = {};
    let currentKey: string | null = null;

    for (const raw of lines) {
      const line = raw.trimEnd();
      if (!line.trim()) { currentKey = null; continue; }
      // "Label: Value"  (Label kann Umlaute enthalten, max 40 Zeichen vor :)
      const m = line.match(/^([A-Za-zÄÖÜäöüß0-9 _\-\/\.]{1,40}?)\s*[:：]\s*(.*)$/);
      if (m) {
        const labelRaw = m[1].trim().toLowerCase();
        const value = m[2].trim();
        const field = LABEL_ALIASES[labelRaw];
        if (field) {
          if (field === 'first_name' && labelRaw === 'name' && value.includes(' ')) {
            const parts = value.split(/\s+/);
            obj.first_name = parts[0];
            obj.last_name = parts.slice(1).join(' ');
          } else {
            obj[field] = obj[field] ? `${obj[field]}, ${value}` : value;
          }
          currentKey = field;
        } else {
          // unbekanntes Label → in notes anhängen
          obj.notes = (obj.notes ? obj.notes + '\n' : '') + `${m[1].trim()}: ${value}`;
          currentKey = 'notes';
        }
      } else if (currentKey) {
        obj[currentKey] = (obj[currentKey] ? obj[currentKey] + ' ' : '') + line.trim();
      } else {
        obj.notes = (obj.notes ? obj.notes + '\n' : '') + line.trim();
      }
    }

    // Nachbearbeitung
    if (obj.service_rating != null) {
      const n = parseInt(String(obj.service_rating).replace(/[^\d]/g, ''), 10);
      obj.service_rating = Number.isFinite(n) ? Math.max(1, Math.min(5, n)) : null;
    }
    if (typeof obj.additional_services === 'string') {
      obj.additional_services = obj.additional_services.split(/[;,|]/).map((x: string) => x.trim()).filter(Boolean);
    }
    if (Object.keys(obj).length) out.push(obj);
  }
  return out;
}

export default function SalesLeadsImport() {
  const nav = useNavigate();
  const [tab, setTab] = useState<'csv' | 'txt'>('csv');
  const [defaultSource, setDefaultSource] = useState('csv');
  const [defaultStatus, setDefaultStatus] = useState('Neu');
  const [importing, setImporting] = useState(false);

  // CSV-State
  const [filename, setFilename] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});

  // TXT-State
  const [txt, setTxt] = useState('');
  const txtParsed = useMemo(() => parseTxtBlocks(txt), [txt]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFilename(f.name);
    const text = await f.text();
    const parsed = parseCSV(text);
    setHeaders(parsed.headers);
    setRows(parsed.rows);
    const initial: Record<string, string> = {};
    parsed.headers.forEach(h => {
      const lc = h.toLowerCase().replace(/\s+/g, '_');
      if (TARGET_FIELDS.includes(lc)) initial[h] = lc;
      else if (LABEL_ALIASES[h.trim().toLowerCase()]) initial[h] = LABEL_ALIASES[h.trim().toLowerCase()];
    });
    setMapping(initial);
    toast.success(`${parsed.rows.length} Zeilen gelesen`);
  }

  async function onTxtFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    setTxt(text);
    toast.success(`Datei geladen: ${f.name}`);
  }

  const csvMapped = useMemo(() => {
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

  const txtMapped = useMemo(() => {
    return txtParsed.map(p => ({
      source: defaultSource,
      lead_status: defaultStatus,
      ...p,
    }));
  }, [txtParsed, defaultSource, defaultStatus]);

  const activeMapped = tab === 'csv' ? csvMapped : txtMapped;

  async function doImport() {
    if (!activeMapped.length) return;
    setImporting(true);
    try {
      const batch = 200;
      let ok = 0;
      for (let i = 0; i < activeMapped.length; i += batch) {
        const chunk = activeMapped.slice(i, i + batch);
        const { error } = await supabase.from('sales_leads').insert(chunk);
        if (error) throw error;
        ok += chunk.length;
      }
      toast.success(`${ok} Anfragen importiert`);
      setRows([]); setHeaders([]); setMapping({}); setFilename(''); setTxt('');
      nav('/verkauf/anfragen');
    } catch (e: any) {
      toast.error(e.message ?? 'Import fehlgeschlagen');
    } finally {
      setImporting(false);
    }
  }

  const TXT_TEMPLATE = `Name: Celina Vaiana
Telefon: +4917661846033
Email: vaianacelina@gmail.com
Firma:
PLZ: 60311
Stadt: Frankfurt
Geräteklasse: Diodenlaser
Zusatzleistungen: Schulung; Wartung
Kundenziel: Eröffnung Studio im Q3
Zeitraum: 3 Monate
Bewertung: 5
Notiz: Anruf am 12.06., Rückruf gewünscht

---

Name: Max Mustermann
Telefon: +491701234567
Email: max@example.com
Geräteklasse: IPL
Bewertung: 4`;

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => nav('/verkauf/anfragen')}><ArrowLeft className="h-4 w-4 mr-1" />Zurück</Button>
        <Upload className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">Verkaufsanfragen – Import</h1>
          <p className="text-sm text-muted-foreground">CSV-Datei oder freier TXT-Block (Label: Wert) in die Anfragenliste übernehmen</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Standardwerte (für beide Importwege)</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm">Quelle</label>
            <Select value={defaultSource} onValueChange={setDefaultSource}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV-Import</SelectItem>
                <SelectItem value="txt">TXT-Import</SelectItem>
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

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="csv"><FileSpreadsheet className="h-4 w-4 mr-2" />CSV / TSV</TabsTrigger>
          <TabsTrigger value="txt"><FileText className="h-4 w-4 mr-2" />TXT (Label: Wert)</TabsTrigger>
        </TabsList>

        <TabsContent value="csv" className="space-y-6">
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
                <CardHeader><CardTitle className="text-base">2. Spalten-Mapping</CardTitle></CardHeader>
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
                  <CardTitle className="text-base">3. Vorschau ({rows.length} Zeilen)</CardTitle>
                  <Button onClick={doImport} disabled={importing || csvMapped.length === 0}>
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
                      {csvMapped.slice(0, 10).map((r, i) => (
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
        </TabsContent>

        <TabsContent value="txt" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">1. TXT einfügen oder Datei laden</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setTxt(TXT_TEMPLATE)}>
                  <Plus className="h-4 w-4 mr-1" />Vorlage einfügen
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setTxt('')}>
                  <Trash2 className="h-4 w-4 mr-1" />Leeren
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input type="file" accept=".txt,.md,.log" onChange={onTxtFile} />
              <Textarea
                rows={16}
                value={txt}
                onChange={(e) => setTxt(e.target.value)}
                placeholder={`Mehrere Anfragen mit Leerzeile oder --- trennen.\n\n${TXT_TEMPLATE}`}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Erkannte Labels (DE/EN): Name, Vorname, Nachname, Firma, E-Mail, Telefon, Straße, PLZ, Stadt, Land, Geräteklasse, Zusatzleistungen, Kundenziel, Zeitraum, Bewertung, Notiz, Nachricht, Status, Quelle. Unbekannte Labels landen in <code>notes</code>.
              </p>
            </CardContent>
          </Card>

          {txtMapped.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  2. Vorschau <Badge variant="outline">{txtMapped.length} Anfrage(n)</Badge>
                </CardTitle>
                <Button onClick={doImport} disabled={importing || txtMapped.length === 0}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />{importing ? 'Importiere…' : 'Import starten'}
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {txtMapped.slice(0, 20).map((r, i) => (
                  <div key={i} className="border rounded p-3 text-xs space-y-1">
                    <div className="font-medium text-sm">
                      #{i + 1} · {(r.first_name || '') + ' ' + (r.last_name || '')} {r.company ? `· ${r.company}` : ''}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-muted-foreground">
                      {Object.entries(r).filter(([k]) => !['source', 'lead_status'].includes(k)).map(([k, v]) => (
                        <div key={k}><span className="font-mono">{k}:</span> {Array.isArray(v) ? v.join(', ') : String(v ?? '')}</div>
                      ))}
                    </div>
                  </div>
                ))}
                {txtMapped.length > 20 && <p className="text-xs text-muted-foreground">… und {txtMapped.length - 20} weitere</p>}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm">
            Leadnummer wird automatisch erzeugt. Bei TXT mehrere Anfragen mit Leerzeile, <code>---</code> oder <code>===</code> trennen. Bei <code>Zusatzleistungen</code> Mehrfachwerte mit <code>;</code> oder <code>,</code> trennen.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

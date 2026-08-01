import { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FeedbackHeader } from './_shared';
import { Upload, FileSpreadsheet, Users, ListChecks, Download, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { parseQuestionsFromFile, type ParsedQuestion } from '@/lib/feedback/parseDocQuestions';


type Row = Record<string, any>;

const norm = (s: string) => s.toString().trim().toLowerCase().replace(/[\s_.-]/g, '');

function pick(row: Row, keys: string[]) {
  for (const k of Object.keys(row)) {
    if (keys.includes(norm(k))) {
      const v = row[k];
      if (v === null || v === undefined || v === '') continue;
      return String(v).trim();
    }
  }
  return '';
}

async function readFile(file: File): Promise<Row[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Row>(ws, { defval: '' });
}

function downloadTemplate(name: string, headers: string[], sample: any[][]) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...sample]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Vorlage');
  XLSX.writeFile(wb, name);
}

const QTYPES = ['text', 'textarea', 'yesno', 'single', 'multi', 'dropdown', 'stars', 'scale10', 'slider', 'nps', 'matrix', 'ranking', 'date', 'number', 'upload', 'consent', 'signature', 'heading', 'description', 'divider'];

export default function FeedbackImport() {
  const sb = supabase as any;
  const [surveys, setSurveys] = useState<any[]>([]);
  const [surveyId, setSurveyId] = useState('');
  const [busy, setBusy] = useState<'r' | 'q' | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const recRef = useRef<HTMLInputElement>(null);
  const qRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    sb.from('surveys').select('id,name,status').is('deleted_at', null).order('created_at', { ascending: false })
      .then(({ data }: any) => setSurveys(data ?? []));
    // eslint-disable-next-line
  }, []);

  const selected = useMemo(() => surveys.find(s => s.id === surveyId), [surveys, surveyId]);
  const addLog = (l: string) => setLog(p => [l, ...p].slice(0, 30));

  async function importRecipients(file: File) {
    if (!surveyId) { toast.error('Bitte zuerst eine Umfrage wählen'); return; }
    setBusy('r');
    try {
      const rows = await readFile(file);
      const payload = rows.map(r => ({
        survey_id: surveyId,
        customer_number: pick(r, ['kundennummer', 'kundennr', 'customernumber', 'customerno']) || null,
        company_name: pick(r, ['firma', 'firmenname', 'company', 'companyname', 'kunde']) || null,
        first_name: pick(r, ['vorname', 'firstname']) || null,
        last_name: pick(r, ['nachname', 'name', 'lastname']) || null,
        email: pick(r, ['email', 'emailadresse', 'mail', 'emailaddress']) || null,
        language: pick(r, ['sprache', 'language']) || 'de',
        country: pick(r, ['land', 'country']) || null,
        device_model: pick(r, ['geraet', 'gerät', 'geraetemodell', 'devicemodel', 'modell']) || null,
        serial_number: pick(r, ['seriennummer', 'serial', 'serialnumber']) || null,
        order_number: pick(r, ['auftragsnummer', 'auftrag', 'ordernumber']) || null,
        salesperson: pick(r, ['verkaeufer', 'verkäufer', 'salesperson']) || null,
        status: 'neu',
      })).filter(r => r.email || r.company_name || r.last_name);

      if (!payload.length) { toast.error('Keine gültigen Zeilen gefunden'); return; }
      const { error } = await sb.from('survey_recipients').insert(payload);
      if (error) throw new Error(error.message);
      toast.success(`${payload.length} Empfänger importiert`);
      addLog(`${new Date().toLocaleTimeString('de-DE')} · ${payload.length} Empfänger → ${selected?.name ?? ''}`);
    } catch (e: any) {
      toast.error(e.message ?? 'Import fehlgeschlagen');
    } finally {
      setBusy(null);
      if (recRef.current) recRef.current.value = '';
    }
  }

  async function insertQuestions(list: { label: string; qtype: string; required: boolean; options: string[]; help_text?: string | null }[]) {
    const { data: existing } = await sb.from('survey_questions').select('id').eq('survey_id', surveyId);
    let pos = (existing?.length ?? 0);
    let created = 0, opts = 0;
    for (const item of list) {
      if (!item.label) continue;
      pos += 1;
      const { data: q, error } = await sb.from('survey_questions').insert({
        survey_id: surveyId,
        qtype: QTYPES.includes(item.qtype) ? item.qtype : 'text',
        label: item.label, position: pos, required: item.required,
        help_text: item.help_text ?? null,
      }).select('id').single();
      if (error) throw new Error(error.message);
      created += 1;
      if (item.options.length) {
        const { error: oe } = await sb.from('survey_question_options').insert(
          item.options.map((l, i) => ({ question_id: q.id, label: l, value: `opt${i + 1}`, position: i + 1 }))
        );
        if (oe) throw new Error(oe.message);
        opts += item.options.length;
      }
    }
    return { created, opts };
  }

  async function importQuestions(file: File) {
    if (!surveyId) { toast.error('Bitte zuerst eine Umfrage wählen'); return; }
    setBusy('q');
    try {
      const rows = await readFile(file);
      const list = rows.map(r => {
        const label = pick(r, ['frage', 'label', 'fragetext', 'question', 'text']);
        const rawType = norm(pick(r, ['typ', 'fragetyp', 'type', 'qtype']) || 'text');
        const requiredRaw = norm(pick(r, ['pflicht', 'pflichtfeld', 'required']) || '');
        const optRaw = pick(r, ['optionen', 'antworten', 'options', 'answers']);
        return {
          label,
          qtype: QTYPES.includes(rawType) ? rawType : 'text',
          required: ['ja', 'yes', 'true', '1', 'x'].includes(requiredRaw),
          options: optRaw ? optRaw.split(/[;|]/).map(s => s.trim()).filter(Boolean) : [],
          help_text: pick(r, ['hilfetext', 'beschreibung', 'helptext']) || null,
        };
      }).filter(r => r.label);
      const { created, opts } = await insertQuestions(list);
      if (!created) { toast.error('Keine gültigen Fragen gefunden'); return; }
      toast.success(`${created} Fragen (${opts} Optionen) importiert`);
      addLog(`${new Date().toLocaleTimeString('de-DE')} · ${created} Fragen → ${selected?.name ?? ''}`);
    } catch (e: any) {
      toast.error(e.message ?? 'Import fehlgeschlagen');
    } finally {
      setBusy(null);
      if (qRef.current) qRef.current.value = '';
    }
  }

  async function analyzeDoc(file: File) {
    if (!surveyId) { toast.error('Bitte zuerst eine Umfrage wählen'); return; }
    setBusy('d');
    setDocName(file.name);
    try {
      const list = await parseQuestionsFromFile(file);
      if (!list.length) { toast.error('Keine Fragen erkannt — Fragezeilen sollten mit „?" enden oder nummeriert sein.'); setParsed([]); return; }
      setParsed(list);
      toast.success(`${list.length} Fragen erkannt — bitte prüfen und übernehmen`);
    } catch (e: any) {
      toast.error(e.message ?? 'Datei konnte nicht gelesen werden');
    } finally {
      setBusy(null);
      if (docRef.current) docRef.current.value = '';
    }
  }

  async function confirmParsed() {
    if (!parsed?.length) return;
    setBusy('d');
    try {
      const { created, opts } = await insertQuestions(parsed);
      toast.success(`${created} Fragen (${opts} Optionen) importiert`);
      addLog(`${new Date().toLocaleTimeString('de-DE')} · ${created} Fragen aus ${docName} → ${selected?.name ?? ''}`);
      setParsed(null); setDocName('');
    } catch (e: any) {
      toast.error(e.message ?? 'Import fehlgeschlagen');
    } finally { setBusy(null); }
  }


  return (
    <div className="space-y-5">
      <FeedbackHeader title="Upload & Import" subtitle="Empfänger und Fragenkataloge per CSV oder Excel importieren" />

      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted-foreground">Ziel-Umfrage</span>
          <Select value={surveyId} onValueChange={setSurveyId}>
            <SelectTrigger className="w-80"><SelectValue placeholder="Umfrage wählen…" /></SelectTrigger>
            <SelectContent>
              {surveys.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {selected && <Badge variant="outline">{selected.status}</Badge>}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4 text-primary" />Empfänger importieren</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Spalten: Kundennummer, Firma, Vorname, Nachname, E-Mail, Sprache, Land, Gerät, Seriennummer, Auftragsnummer, Verkäufer.
            </p>
            <input ref={recRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) importRecipients(f); }} />
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy !== null || !surveyId} onClick={() => recRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />{busy === 'r' ? 'Importiere…' : 'Datei wählen'}
              </Button>
              <Button variant="outline" onClick={() => downloadTemplate('empfaenger-vorlage.xlsx',
                ['Kundennummer', 'Firma', 'Vorname', 'Nachname', 'E-Mail', 'Sprache', 'Land', 'Gerät', 'Seriennummer', 'Auftragsnummer', 'Verkäufer'],
                [['10023', 'Muster GmbH', 'Anna', 'Muster', 'anna@muster.de', 'de', 'DE', 'Alix Pro', 'SN-1234', '2026-01234', 'M. Klein']])}>
                <Download className="h-4 w-4 mr-2" />Vorlage
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><ListChecks className="h-4 w-4 text-primary" />Fragenkatalog importieren</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Spalten: Frage, Typ ({QTYPES.slice(0, 8).join(', ')} …), Pflicht (Ja/Nein), Optionen (mit „;" getrennt), Beschreibung.
            </p>
            <input ref={qRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) importQuestions(f); }} />
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy !== null || !surveyId} onClick={() => qRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />{busy === 'q' ? 'Importiere…' : 'Datei wählen'}
              </Button>
              <Button variant="outline" onClick={() => downloadTemplate('fragen-vorlage.xlsx',
                ['Frage', 'Typ', 'Pflicht', 'Optionen', 'Beschreibung'],
                [
                  ['Wie zufrieden sind Sie insgesamt?', 'stars', 'Ja', '', ''],
                  ['Was können wir verbessern?', 'textarea', 'Nein', '', 'Freitext'],
                  ['Welche Leistung nutzen Sie?', 'single', 'Ja', 'Service; Schulung; Marketing', ''],
                ])}>
                <Download className="h-4 w-4 mr-2" />Vorlage
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileSpreadsheet className="h-4 w-4 text-primary" />Import-Protokoll</CardTitle></CardHeader>
        <CardContent>
          {log.length === 0
            ? <p className="text-sm text-muted-foreground">Noch keine Importe in dieser Sitzung.</p>
            : <ul className="text-sm space-y-1">{log.map((l, i) => <li key={i} className="text-muted-foreground">{l}</li>)}</ul>}
        </CardContent>
      </Card>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Download, FileJson, FileSpreadsheet, Loader2 } from 'lucide-react';
import { FeedbackHeader, Section } from './_shared';

type SurveyRow = { id: string; name: string | null; status: string | null };
type ExportRow = {
  id: string; survey_id: string | null; format: string; anonymized: boolean;
  row_count: number | null; status: string; created_at: string; filters: any;
};

function csvEscape(v: unknown) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function FeedbackExports() {
  const sb = supabase as any;
  const [surveys, setSurveys] = useState<SurveyRow[]>([]);
  const [history, setHistory] = useState<ExportRow[]>([]);
  const [surveyId, setSurveyId] = useState<string>('all');
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [anonymized, setAnonymized] = useState(false);
  const [onlyCompleted, setOnlyCompleted] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);

  const surveyTitles = useMemo(
    () => Object.fromEntries(surveys.map((s) => [s.id, s.name ?? 'Ohne Titel'])),
    [surveys],
  );

  async function loadHistory() {
    const { data } = await sb
      .from('survey_exports')
      .select('id, survey_id, format, anonymized, row_count, status, created_at, filters')
      .order('created_at', { ascending: false })
      .limit(50);
    setHistory((data ?? []) as ExportRow[]);
  }

  useEffect(() => {
    (async () => {
      const { data } = await sb
        .from('surveys')
        .select('id, name, status')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      setSurveys((data ?? []) as SurveyRow[]);
      await loadHistory();
    })();
  }, []);

  async function runExport() {
    setBusy(true);
    try {
      let q = sb
        .from('survey_responses')
        .select('id, survey_id, recipient_id, language, score_total, nps_score, is_critical, started_at, completed_at, duration_seconds, status, order_number, device_model, serial_number')
        .order('completed_at', { ascending: false, nullsFirst: false })
        .limit(5000);
      if (surveyId !== 'all') q = q.eq('survey_id', surveyId);
      if (onlyCompleted) q = q.not('completed_at', 'is', null);
      if (from) q = q.gte('created_at', new Date(from).toISOString());
      if (to) q = q.lte('created_at', new Date(`${to}T23:59:59`).toISOString());
      const { data: responses, error } = await q;
      if (error) throw error;
      const rows = responses ?? [];
      if (rows.length === 0) {
        toast.error('Keine Antworten für diese Auswahl gefunden');
        return;
      }

      const ids = rows.map((r: any) => r.id);
      const items: any[] = [];
      for (let i = 0; i < ids.length; i += 200) {
        const { data } = await sb
          .from('survey_response_items')
          .select('response_id, question_label, qtype, value_text, value_number, value_date, value_bool, value_json')
          .in('response_id', ids.slice(i, i + 200));
        items.push(...(data ?? []));
      }

      let recipients: Record<string, any> = {};
      if (!anonymized) {
        const rIds = [...new Set(rows.map((r: any) => r.recipient_id).filter(Boolean))] as string[];
        for (let i = 0; i < rIds.length; i += 200) {
          const { data } = await sb
            .from('survey_recipients')
            .select('id, email, company_name, first_name, last_name, customer_number, country')
            .in('id', rIds.slice(i, i + 200));
          (data ?? []).forEach((r: any) => { recipients[r.id] = r; });
        }
      }

      const answerValue = (it: any) => {
        if (it.value_text != null) return it.value_text;
        if (it.value_number != null) return it.value_number;
        if (it.value_bool != null) return it.value_bool ? 'Ja' : 'Nein';
        if (it.value_date != null) return it.value_date;
        if (it.value_json != null) return Array.isArray(it.value_json) ? it.value_json.join(' | ') : JSON.stringify(it.value_json);
        return '';
      };

      const byResponse = new Map<string, any[]>();
      items.forEach((it) => {
        const list = byResponse.get(it.response_id) ?? [];
        list.push(it);
        byResponse.set(it.response_id, list);
      });

      const labels = [...new Set(items.map((i) => i.question_label ?? '').filter(Boolean))];

      const records = rows.map((r: any) => {
        const rec = recipients[r.recipient_id ?? ''] ?? {};
        const base: Record<string, unknown> = {
          Umfrage: surveyTitles[r.survey_id] ?? r.survey_id,
          Teilnahme_ID: r.id,
          Kunde: anonymized ? 'anonymisiert' : (rec.company_name ?? ''),
          Name: anonymized ? '' : [rec.first_name, rec.last_name].filter(Boolean).join(' '),
          Email: anonymized ? '' : (rec.email ?? ''),
          Kundennummer: anonymized ? '' : (rec.customer_number ?? ''),
          Land: rec.country ?? '',
          Auftragsnummer: r.order_number ?? '',
          Geraet: r.device_model ?? '',
          Seriennummer: anonymized ? '' : (r.serial_number ?? ''),
          Sprache: r.language,
          Status: r.status,
          NPS: r.nps_score ?? '',
          Score: r.score_total ?? '',
          Kritisch: r.is_critical ? 'Ja' : 'Nein',
          Dauer_Sekunden: r.duration_seconds ?? '',
          Gestartet: r.started_at ?? '',
          Abgeschlossen: r.completed_at ?? '',
        };
        const answers = byResponse.get(r.id) ?? [];
        labels.forEach((l) => {
          const found = answers.filter((a) => (a.question_label ?? '') === l).map(answerValue);
          base[l] = found.join(' | ');
        });
        return base;
      });

      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      const name = surveyId === 'all' ? 'alle-umfragen' : (surveyTitles[surveyId] ?? 'umfrage').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);

      if (format === 'json') {
        download(`umfrage-export-${name}-${stamp}.json`, JSON.stringify(records, null, 2), 'application/json');
      } else {
        const headers = Object.keys(records[0]);
        const csv = [
          headers.join(';'),
          ...records.map((rec) => headers.map((h) => csvEscape((rec as any)[h])).join(';')),
        ].join('\n');
        download(`umfrage-export-${name}-${stamp}.csv`, `\uFEFF${csv}`, 'text/csv;charset=utf-8');
      }

      await sb.from('survey_exports').insert({
        survey_id: surveyId === 'all' ? null : surveyId,
        format,
        anonymized,
        row_count: records.length,
        status: 'erstellt',
        filters: { only_completed: onlyCompleted, from: from || null, to: to || null },
      });
      await loadHistory();
      toast.success(`${records.length} Teilnahmen exportiert`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Export fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="space-y-6 p-4 md:p-6">
        <FeedbackHeader
          title="Exporte"
          subtitle="Antworten als CSV oder JSON herunterladen – optional anonymisiert und gefiltert."
        />

        <Card className="border-border/60 bg-card/50 backdrop-blur">
          <CardContent className="grid gap-4 p-5 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label>Umfrage</Label>
              <Select value={surveyId} onValueChange={setSurveyId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Umfragen</SelectItem>
                  {surveys.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name ?? 'Ohne Titel'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Format</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as 'csv' | 'json')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV (Excel)</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Von</Label>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Bis</Label>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
              <div>
                <p className="text-sm font-medium">Nur abgeschlossene</p>
                <p className="text-xs text-muted-foreground">Abbrüche ausschließen</p>
              </div>
              <Switch checked={onlyCompleted} onCheckedChange={setOnlyCompleted} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
              <div>
                <p className="text-sm font-medium">Anonymisiert</p>
                <p className="text-xs text-muted-foreground">Ohne Name, E-Mail, Kundennummer</p>
              </div>
              <Switch checked={anonymized} onCheckedChange={setAnonymized} />
            </div>
            <div className="flex items-end">
              <Button onClick={runExport} disabled={busy} className="w-full">
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> :
                  format === 'csv' ? <FileSpreadsheet className="mr-2 h-4 w-4" /> : <FileJson className="mr-2 h-4 w-4" />}
                Export erstellen
              </Button>
            </div>
          </CardContent>
        </Card>

        <Section title="Export-Verlauf">
          <Card className="border-border/60 bg-card/50 backdrop-blur">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Umfrage</TableHead>
                    <TableHead>Format</TableHead>
                    <TableHead>Zeilen</TableHead>
                    <TableHead>Datenschutz</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                        Noch keine Exporte erstellt.
                      </TableCell>
                    </TableRow>
                  )}
                  {history.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {new Date(h.created_at).toLocaleString('de-DE')}
                      </TableCell>
                      <TableCell className="text-sm">{h.survey_id ? (surveyTitles[h.survey_id] ?? '–') : 'Alle Umfragen'}</TableCell>
                      <TableCell className="uppercase text-xs">{h.format}</TableCell>
                      <TableCell>{h.row_count ?? '–'}</TableCell>
                      <TableCell>
                        {h.anonymized
                          ? <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/15 text-emerald-400">anonymisiert</Badge>
                          : <Badge variant="outline">personenbezogen</Badge>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><Download className="h-3 w-3" />{h.status}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Section>
      </div>
    </>
  );
}

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FeedbackHeader } from './_shared';
import { Download, Eye, AlertTriangle, Trash2, FileText, Loader2 } from 'lucide-react';
import { buildResponsesPdf, recipientName } from '@/lib/feedback/responses-pdf';
import { useCanDelete } from '@/hooks/useCanDelete';
import { toast } from 'sonner';

export default function FeedbackResponses() {
  const sb = supabase as any;
  const [surveys, setSurveys] = useState<any[]>([]);
  const [surveyId, setSurveyId] = useState<string>('all');
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [detail, setDetail] = useState<any | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pdfBusy, setPdfBusy] = useState(false);

  const canDelete = useCanDelete();

  useEffect(() => { sb.from('surveys').select('id,name').is('deleted_at', null).order('name').then((r: any) => setSurveys(r.data ?? [])); /* eslint-disable-next-line */ }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let query = sb.from('survey_responses').select('*').order('completed_at', { ascending: false, nullsFirst: false }).limit(1000);
      if (surveyId !== 'all') query = query.eq('survey_id', surveyId);
      const { data } = await query;
      const list = data ?? [];
      const rids = list.map((r: any) => r.recipient_id).filter(Boolean);
      let recMap: Record<string, any> = {};
      if (rids.length) {
        const { data: recs } = await sb.from('survey_recipients').select('id,company_name,first_name,last_name,email,customer_number').in('id', rids);
        (recs ?? []).forEach((x: any) => { recMap[x.id] = x; });
      }
      setRows(list.map((r: any) => ({ ...r, recipient: recMap[r.recipient_id] })));
      setLoading(false);
    })();
    /* eslint-disable-next-line */
  }, [surveyId]);

  async function open(r: any) {
    setDetail(r);
    const { data } = await sb.from('survey_response_items').select('*').eq('response_id', r.id).order('created_at');
    setItems(data ?? []);
  }

  async function deleteResponse(r: any) {
    if (!confirm('Diese Antwort endgültig löschen?')) return;
    await sb.from('survey_response_items').delete().eq('response_id', r.id);
    const { error } = await sb.from('survey_responses').delete().eq('id', r.id);
    if (error) { toast.error(error.message); return; }
    setRows(prev => prev.filter(x => x.id !== r.id));
    toast.success('Antwort gelöscht');
  }

  async function deleteAllForSurvey() {
    if (surveyId === 'all') { toast.error('Bitte zuerst eine Umfrage auswählen'); return; }
    const ids = rows.map(r => r.id);
    if (!ids.length) { toast.error('Keine Antworten vorhanden'); return; }
    if (!confirm(`Wirklich alle ${ids.length} Antworten dieser Umfrage löschen?`)) return;
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      await sb.from('survey_response_items').delete().in('response_id', chunk);
      const { error } = await sb.from('survey_responses').delete().in('id', chunk);
      if (error) { toast.error(error.message); return; }
    }
    setRows([]);
    toast.success('Alle Antworten gelöscht');
  }



  async function exportPdf() {
    if (!filtered.length) { toast.error('Keine Antworten vorhanden'); return; }
    setPdfBusy(true);
    try {
      const ids = filtered.map(r => r.id);
      const all: any[] = [];
      for (let i = 0; i < ids.length; i += 200) {
        const { data } = await sb.from('survey_response_items')
          .select('response_id, question_label, value_text, value_number, value_bool, value_date, value_json')
          .in('response_id', ids.slice(i, i + 200));
        all.push(...(data ?? []));
      }
      const surveyName = surveyId === 'all'
        ? 'Alle Umfragen'
        : (surveys.find(s => s.id === surveyId)?.name ?? 'Umfrage');
      const doc = buildResponsesPdf({
        surveyName,
        responses: filtered,
        items: all.map((i: any) => ({ response_id: i.response_id, question_label: i.question_label, value: itemValue(i) })),
      });
      doc.save(`umfrage-antworten-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success('PDF erstellt');
    } catch (e: any) {
      toast.error(e?.message ?? 'PDF konnte nicht erstellt werden');
    } finally {
      setPdfBusy(false);
    }
  }

  function exportSinglePdf() {
    if (!detail) return;
    const doc = buildResponsesPdf({
      surveyName: surveys.find(s => s.id === detail.survey_id)?.name ?? 'Umfrage',
      responses: [detail],
      items: items.map((i: any) => ({ response_id: detail.id, question_label: i.question_label, value: itemValue(i) })),
    });
    doc.save(`antwort-${recipientName(detail).replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`);
  }

  function exportCsv() {
    const head = ['Datum', 'Kunde', 'E-Mail', 'Status', 'Score', 'NPS', 'Dauer (s)'];
    const lines = filtered.map(r => [
      r.completed_at ? new Date(r.completed_at).toLocaleString('de-DE') : '',
      r.recipient?.company_name ?? `${r.recipient?.first_name ?? ''} ${r.recipient?.last_name ?? ''}`.trim(),
      r.recipient?.email ?? '', r.status ?? '', r.score_total ?? '', r.nps_score ?? '', r.duration_seconds ?? '',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'));
    const blob = new Blob(['\uFEFF' + [head.join(';'), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'umfrage-antworten.csv'; a.click();
  }

  const filtered = rows.filter(r => !q || JSON.stringify(r.recipient ?? {}).toLowerCase().includes(q.toLowerCase()));

  function itemValue(i: any) {
    if (i.value_text) return i.value_text;
    if (i.value_number !== null && i.value_number !== undefined) return String(i.value_number);
    if (i.value_bool !== null && i.value_bool !== undefined) return i.value_bool ? 'Ja' : 'Nein';
    if (i.value_date) return new Date(i.value_date).toLocaleDateString('de-DE');
    if (i.value_json) return Array.isArray(i.value_json) ? i.value_json.join(', ') : JSON.stringify(i.value_json);
    return '–';
  }

  return (
    <div className="space-y-5">
      <FeedbackHeader title="Antworten" subtitle="Alle eingegangenen Rückmeldungen"
        action={
          <div className="flex gap-2">
            {canDelete && (
              <Button variant="outline" className="text-destructive border-destructive/40" onClick={deleteAllForSurvey}>
                <Trash2 className="h-4 w-4 mr-2" />Alle Antworten löschen
              </Button>
            )}
            <Button variant="outline" onClick={exportPdf} disabled={pdfBusy}>
              {pdfBusy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
              Alle Antworten als PDF
            </Button>
            <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-2" />CSV Export</Button>
          </div>
        } />

      <div className="flex flex-wrap gap-2">
        <Select value={surveyId} onValueChange={setSurveyId}>
          <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Umfragen</SelectItem>
            {surveys.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input className="max-w-xs" placeholder="Kunde suchen …" value={q} onChange={e => setQ(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left"><tr>
              <th className="p-3">Datum</th><th className="p-3">Kunde</th><th className="p-3">Status</th>
              <th className="p-3">Score</th><th className="p-3">NPS</th><th className="p-3">Dauer</th><th className="p-3" />
            </tr></thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                  <td className="p-3 text-muted-foreground">{r.completed_at ? new Date(r.completed_at).toLocaleString('de-DE') : '–'}</td>
                  <td className="p-3">
                    {r.recipient?.company_name || `${r.recipient?.first_name ?? ''} ${r.recipient?.last_name ?? ''}`.trim() || 'Anonym'}
                    <div className="text-xs text-muted-foreground">{r.recipient?.email}</div>
                  </td>
                  <td className="p-3">
                    {r.is_critical && <Badge variant="outline" className="mr-1 border-destructive/40 text-destructive"><AlertTriangle className="h-3 w-3 mr-1" />Kritisch</Badge>}
                    <Badge variant="outline">{r.status}</Badge>
                  </td>
                  <td className="p-3">{r.score_total ?? '–'}</td>
                  <td className="p-3">{r.nps_score ?? '–'}</td>
                  <td className="p-3">{r.duration_seconds ? `${Math.round(r.duration_seconds / 60)} min` : '–'}</td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => open(r)}><Eye className="h-4 w-4" /></Button>
                    {canDelete && <Button size="sm" variant="ghost" onClick={() => deleteResponse(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td className="p-4 text-muted-foreground" colSpan={7}>{loading ? 'Lade …' : 'Keine Antworten vorhanden.'}</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={!!detail} onOpenChange={o => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <span>Antwortdetails</span>
              <Button size="sm" variant="outline" className="ml-auto mr-6" onClick={exportSinglePdf}>
                <FileText className="h-4 w-4 mr-1" />PDF
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {items.map(i => (
              <div key={i.id} className="rounded-md border border-border p-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{i.question_label}</div>
                <div className="text-sm mt-1">{itemValue(i)}</div>
              </div>
            ))}
            {items.length === 0 && <p className="text-sm text-muted-foreground">Keine Einzelantworten gespeichert.</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

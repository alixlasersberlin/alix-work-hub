import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FeedbackHeader, StatusPill } from './_shared';
import { Plus, Search, Copy, Trash2, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { useCanDelete } from '@/hooks/useCanDelete';
import { downloadSurveyPdf } from '@/lib/feedback/surveyPdf';


export default function FeedbackSurveys() {
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();
  const canDelete = useCanDelete();

  async function load() {
    setLoading(true);
    const { data } = await (supabase as any).from('surveys').select('*').is('deleted_at', null).order('created_at', { ascending: false });
    setRows(data ?? []); setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function duplicate(id: string) {
    const sb = supabase as any;
    const { data: src } = await sb.from('surveys').select('*').eq('id', id).single();
    if (!src) return;
    const { id: _i, created_at, updated_at, created_by, updated_by, public_token, public_enabled, ...rest } = src;
    const { data: copy, error } = await sb.from('surveys').insert({ ...rest, name: `${src.name} (Kopie)`, status: 'entwurf', version: 1, public_token: null, public_enabled: false }).select().single();
    if (error) { toast.error(error.message); return; }
    const { data: qs } = await sb.from('survey_questions').select('*').eq('survey_id', id).order('position');
    for (const qq of qs ?? []) {
      const { id: qid, created_at: _c, updated_at: _u, created_by: _cb, updated_by: _ub, ...qrest } = qq;
      const { data: nq } = await sb.from('survey_questions').insert({ ...qrest, survey_id: copy.id, section_id: null }).select().single();
      const { data: opts } = await sb.from('survey_question_options').select('*').eq('question_id', qid).order('position');
      if (opts?.length && nq) {
        await sb.from('survey_question_options').insert(opts.map((o: any) => ({
          question_id: nq.id, label: o.label, value: o.value, position: o.position, score: o.score,
        })));
      }
    }
    toast.success('Umfrage dupliziert');
    load();
  }

  async function remove(id: string) {
    if (!confirm('Umfrage wirklich löschen?')) return;
    const { error } = await (supabase as any).from('surveys').update({ deleted_at: new Date().toISOString(), status: 'archiviert' }).eq('id', id);
    if (error) toast.error(error.message); else { toast.success('Gelöscht'); load(); }
  }

  async function exportPdf(id: string) {
    try {
      toast.info('PDF wird erzeugt …');
      await downloadSurveyPdf(id);
      toast.success('PDF heruntergeladen');
    } catch (e: any) {
      toast.error(e?.message ?? 'PDF-Export fehlgeschlagen');
    }
  }


  const filtered = rows.filter(r => !q || `${r.name} ${r.public_title ?? ''} ${r.status}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-5">
      <FeedbackHeader
        title="Umfragen"
        subtitle="Alle Kundenumfragen im Überblick"
        action={<Button onClick={() => nav('/umfragen/neu')}><Plus className="h-4 w-4 mr-2" />Neue Umfrage</Button>}
      />
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Suche nach Name oder Status …" value={q} onChange={e => setQ(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="p-3">Name</th><th className="p-3">Status</th><th className="p-3">Sprache</th>
                <th className="p-3">Zeitraum</th><th className="p-3">Version</th><th className="p-3 text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                  <td className="p-3">
                    <button className="text-primary hover:underline" onClick={() => nav(`/umfragen/${r.id}`)}>{r.name}</button>
                    {r.public_title && <div className="text-xs text-muted-foreground">{r.public_title}</div>}
                  </td>
                  <td className="p-3"><StatusPill status={r.status} /></td>
                  <td className="p-3 uppercase text-muted-foreground">{r.language}</td>
                  <td className="p-3 text-muted-foreground text-xs">
                    {r.starts_at ? new Date(r.starts_at).toLocaleDateString('de-DE') : '–'} – {r.ends_at ? new Date(r.ends_at).toLocaleDateString('de-DE') : '–'}
                  </td>
                  <td className="p-3">v{r.version}</td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <Button size="sm" variant="outline" className="mr-1" onClick={() => exportPdf(r.id)}>
                      <FileDown className="h-4 w-4 mr-1" />PDF
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => duplicate(r.id)}><Copy className="h-4 w-4" /></Button>

                    {canDelete && <Button size="sm" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td className="p-4 text-muted-foreground" colSpan={6}>{loading ? 'Lade …' : 'Keine Umfragen gefunden.'}</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

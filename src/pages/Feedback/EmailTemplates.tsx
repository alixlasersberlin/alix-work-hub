import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { FeedbackHeader, LANGUAGES } from './_shared';
import { Plus, Pencil, Trash2, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { useCanDelete } from '@/hooks/useCanDelete';

const KINDS = [
  { value: 'einladung', label: 'Einladung' },
  { value: 'erinnerung', label: 'Erinnerung' },
  { value: 'danke', label: 'Dankesmail' },
  { value: 'geschenk', label: 'Geschenk-Mail' },
  { value: 'abschluss', label: 'Abschluss' },
];

const EMPTY = {
  kind: 'einladung', language: 'de', subject: '', from_name: 'ALIX Lasers', from_email: '',
  reply_to: '', body_html: '<p>Guten Tag {{name}},</p><p>wir laden Sie ein, an unserer Umfrage teilzunehmen.</p><p><a href="{{link}}">Umfrage starten</a></p>',
  tracking_enabled: true, status: 'aktiv', survey_id: null as string | null,
};

export default function FeedbackEmailTemplates() {
  const sb = supabase as any;
  const [rows, setRows] = useState<any[]>([]);
  const [surveys, setSurveys] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(EMPTY);
  const canDelete = useCanDelete();

  async function load() {
    const [t, s] = await Promise.all([
      sb.from('survey_email_templates').select('*').order('created_at', { ascending: false }),
      sb.from('surveys').select('id,name').is('deleted_at', null).order('name'),
    ]);
    setRows(t.data ?? []); setSurveys(s.data ?? []);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function save() {
    if (!form.subject?.trim()) { toast.error('Bitte Betreff angeben'); return; }
    const payload = {
      survey_id: form.survey_id || null, kind: form.kind, language: form.language, subject: form.subject,
      from_name: form.from_name || null, from_email: form.from_email || null, reply_to: form.reply_to || null,
      body_html: form.body_html, tracking_enabled: form.tracking_enabled, status: form.status,
    };
    const { error } = form.id
      ? await sb.from('survey_email_templates').update(payload).eq('id', form.id)
      : await sb.from('survey_email_templates').insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success('Gespeichert'); setOpen(false); setForm(EMPTY); load();
  }

  async function remove(id: string) {
    if (!confirm('Vorlage löschen?')) return;
    const { error } = await sb.from('survey_email_templates').delete().eq('id', id);
    if (error) toast.error(error.message); else load();
  }

  return (
    <div className="space-y-5">
      <FeedbackHeader title="E-Mail-Vorlagen" subtitle="Einladungen, Erinnerungen und Dankesmails"
        action={<Button onClick={() => { setForm(EMPTY); setOpen(true); }}><Plus className="h-4 w-4 mr-2" />Neue Vorlage</Button>} />

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left"><tr>
              <th className="p-3">Art</th><th className="p-3">Betreff</th><th className="p-3">Sprache</th>
              <th className="p-3">Umfrage</th><th className="p-3">Status</th><th className="p-3" />
            </tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                  <td className="p-3"><Badge variant="outline"><Mail className="h-3 w-3 mr-1" />{KINDS.find(k => k.value === r.kind)?.label ?? r.kind}</Badge></td>
                  <td className="p-3">{r.subject}</td>
                  <td className="p-3 uppercase">{r.language}</td>
                  <td className="p-3 text-muted-foreground">{surveys.find(s => s.id === r.survey_id)?.name ?? 'Global'}</td>
                  <td className="p-3">{r.status}</td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <Button size="icon" variant="ghost" onClick={() => { setForm(r); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    {canDelete && <Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td className="p-4 text-muted-foreground" colSpan={6}>Noch keine Vorlagen. Ohne Vorlage wird ein Standardtext versendet.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-auto">
          <DialogHeader><DialogTitle>{form.id ? 'Vorlage bearbeiten' : 'Neue Vorlage'}</DialogTitle></DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Art</Label>
              <Select value={form.kind} onValueChange={v => setForm({ ...form, kind: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{KINDS.map(k => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sprache</Label>
              <Select value={form.language} onValueChange={v => setForm({ ...form, language: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LANGUAGES.map(l => <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Umfrage (optional)</Label>
              <Select value={form.survey_id ?? 'global'} onValueChange={v => setForm({ ...form, survey_id: v === 'global' ? null : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global (für alle Umfragen)</SelectItem>
                  {surveys.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2"><Label>Betreff</Label><Input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} /></div>
            <div><Label>Absendername</Label><Input value={form.from_name ?? ''} onChange={e => setForm({ ...form, from_name: e.target.value })} /></div>
            <div><Label>Antwortadresse</Label><Input value={form.reply_to ?? ''} onChange={e => setForm({ ...form, reply_to: e.target.value })} /></div>
            <div className="md:col-span-2">
              <Label>Inhalt (HTML) – Platzhalter: {'{{name}}'}, {'{{firma}}'}, {'{{link}}'}, {'{{umfrage}}'}</Label>
              <Textarea rows={10} className="font-mono text-xs" value={form.body_html ?? ''} onChange={e => setForm({ ...form, body_html: e.target.value })} />
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button><Button onClick={save}>Speichern</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

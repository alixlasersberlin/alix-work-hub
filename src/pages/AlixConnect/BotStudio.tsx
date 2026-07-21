import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Bot, Plus, Trash2, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/infinity/PageHeader';

type Intent = {
  id: string; name: string; description: string | null;
  training_phrases: string[]; response_template: string | null;
  handoff_to_human: boolean; enabled: boolean; channels: string[];
};

export default function BotStudio() {
  const [intents, setIntents] = useState<Intent[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Intent>>({ name: '', training_phrases: [], response_template: '', channels: ['web','whatsapp','email'], enabled: true, handoff_to_human: false });
  const [trainOpen, setTrainOpen] = useState<Intent | null>(null);
  const [trainUtterance, setTrainUtterance] = useState('');
  const [trainResponse, setTrainResponse] = useState('');

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('ac_bot_intents' as any).select('*').order('created_at', { ascending: false });
    if (error) toast.error(error.message);
    setIntents((data as any) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name) { toast.error('Name erforderlich'); return; }
    const phrases = Array.isArray(form.training_phrases) ? form.training_phrases : String(form.training_phrases || '').split('\n').filter(Boolean);
    const { error } = await supabase.from('ac_bot_intents' as any).insert({
      name: form.name, description: form.description ?? null,
      training_phrases: phrases, response_template: form.response_template ?? '',
      channels: form.channels ?? ['web'], enabled: form.enabled ?? true, handoff_to_human: form.handoff_to_human ?? false,
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Intent gespeichert');
    setOpen(false); setForm({ name: '', training_phrases: [], response_template: '', channels: ['web','whatsapp','email'], enabled: true, handoff_to_human: false });
    load();
  };

  const toggle = async (i: Intent, field: 'enabled' | 'handoff_to_human') => {
    const { error } = await supabase.from('ac_bot_intents' as any).update({ [field]: !i[field] }).eq('id', i.id);
    if (error) toast.error(error.message); else load();
  };

  const remove = async (i: Intent) => {
    if (!confirm(`Intent "${i.name}" löschen?`)) return;
    const { error } = await supabase.from('ac_bot_intents' as any).delete().eq('id', i.id);
    if (error) toast.error(error.message); else { toast.success('Gelöscht'); load(); }
  };

  const submitTraining = async () => {
    if (!trainOpen || !trainUtterance) return;
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from('ac_bot_training_log' as any).insert({
      intent_id: trainOpen.id, utterance: trainUtterance, correct_response: trainResponse,
      trained_by: userData.user?.id,
    });
    if (error) { toast.error(error.message); return; }
    // Add utterance to intent's training phrases
    const newPhrases = [...(trainOpen.training_phrases ?? []), trainUtterance];
    await supabase.from('ac_bot_intents' as any).update({ training_phrases: newPhrases }).eq('id', trainOpen.id);
    toast.success('Trainingsdaten hinzugefügt');
    setTrainOpen(null); setTrainUtterance(''); setTrainResponse(''); load();
  };

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      <PageHeader title="Conversational AI Studio" subtitle="Intents, Flows und Live-Training für den Alix-Bot" icon={Bot} noBreadcrumbs
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-2" />Neuer Intent</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Neuer Intent</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Intent-Name (z.B. rechnung_status)" value={form.name ?? ''} onChange={e => setForm({ ...form, name: e.target.value })} />
                <Input placeholder="Beschreibung" value={form.description ?? ''} onChange={e => setForm({ ...form, description: e.target.value })} />
                <Textarea rows={4} placeholder="Trainingsphrasen — eine pro Zeile" value={Array.isArray(form.training_phrases) ? form.training_phrases.join('\n') : ''} onChange={e => setForm({ ...form, training_phrases: e.target.value.split('\n') })} />
                <Textarea rows={3} placeholder="Antwort-Vorlage — verwende {variable}" value={form.response_template ?? ''} onChange={e => setForm({ ...form, response_template: e.target.value })} />
                <div className="flex items-center gap-4 text-sm">
                  <label className="flex items-center gap-2"><Switch checked={!!form.enabled} onCheckedChange={v => setForm({ ...form, enabled: v })} /> Aktiv</label>
                  <label className="flex items-center gap-2"><Switch checked={!!form.handoff_to_human} onCheckedChange={v => setForm({ ...form, handoff_to_human: v })} /> Handoff an Agent</label>
                </div>
              </div>
              <DialogFooter><Button onClick={save}>Speichern</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Card>
        <CardHeader><CardTitle className="text-base">Intents ({intents.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="text-sm text-muted-foreground">Lädt…</div> : intents.length === 0 ? (
            <div className="text-sm text-muted-foreground">Noch keine Intents. Erstelle den ersten oben rechts.</div>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Name</TableHead><TableHead>Phrasen</TableHead><TableHead>Kanäle</TableHead><TableHead>Aktiv</TableHead><TableHead>Handoff</TableHead><TableHead className="text-right">Aktionen</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {intents.map(i => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{i.name}<div className="text-xs text-muted-foreground">{i.description}</div></TableCell>
                      <TableCell>{(i.training_phrases ?? []).length}</TableCell>
                      <TableCell><div className="flex gap-1 flex-wrap">{(i.channels ?? []).map(c => <Badge key={c} variant="outline" className="text-xs">{c}</Badge>)}</div></TableCell>
                      <TableCell><Switch checked={i.enabled} onCheckedChange={() => toggle(i, 'enabled')} /></TableCell>
                      <TableCell><Switch checked={i.handoff_to_human} onCheckedChange={() => toggle(i, 'handoff_to_human')} /></TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setTrainOpen(i)}><GraduationCap className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => remove(i)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!trainOpen} onOpenChange={v => !v && setTrainOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Live-Training: {trainOpen?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Nutzer-Aussage (Beispiel)" value={trainUtterance} onChange={e => setTrainUtterance(e.target.value)} />
            <Textarea rows={3} placeholder="Korrekte Antwort" value={trainResponse} onChange={e => setTrainResponse(e.target.value)} />
          </div>
          <DialogFooter><Button onClick={submitTraining}>Antrainieren</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

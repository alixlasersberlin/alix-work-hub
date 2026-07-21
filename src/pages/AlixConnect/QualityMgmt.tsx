import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { ClipboardCheck, Plus, Loader2, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

type Criterion = { key: string; label: string; weight: number; max_score: number; description?: string };
type Scorecard = { id: string; name: string; channel: string; criteria: Criterion[]; is_active: boolean; description: string | null };
type Evaluation = { id: string; call_id: string | null; scorecard_id: string; agent_user_id: string | null; percent: number | null; coaching_required: boolean; status: string; ai_generated: boolean; created_at: string; notes: string | null; coaching_notes: string | null };

export default function QualityMgmt() {
  const [cards, setCards] = useState<Scorecard[]>([]);
  const [evals, setEvals] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ name: string; description: string; channel: string; criteria: Criterion[] }>({
    name: '', description: '', channel: 'call',
    criteria: [
      { key: 'begruessung', label: 'Begrüßung', weight: 1, max_score: 5, description: 'Freundliche, klare Begrüßung' },
      { key: 'loesung', label: 'Lösungsorientierung', weight: 2, max_score: 5, description: 'Problem verstanden und gelöst' },
      { key: 'compliance', label: 'Compliance', weight: 2, max_score: 5, description: 'Datenschutz + Prozesse eingehalten' },
      { key: 'ton', label: 'Ton & Empathie', weight: 1, max_score: 5, description: 'Wertschätzend und geduldig' },
    ],
  });
  const [saving, setSaving] = useState(false);
  const [scoringCall, setScoringCall] = useState('');
  const [scoringCard, setScoringCard] = useState('');
  const [scoring, setScoring] = useState(false);

  async function load() {
    setLoading(true);
    const [s, e] = await Promise.all([
      supabase.from('ac_qm_scorecards').select('*').order('created_at', { ascending: false }),
      supabase.from('ac_qm_evaluations').select('*').order('created_at', { ascending: false }).limit(30),
    ]);
    setCards((s.data ?? []) as any);
    setEvals((e.data ?? []) as any);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!form.name.trim() || form.criteria.length === 0) { toast.error('Name + Kriterien erforderlich'); return; }
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from('ac_qm_scorecards').insert({
      name: form.name, description: form.description || null, channel: form.channel, criteria: form.criteria,
      created_by: u.user?.id,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Scorecard gespeichert');
    setOpen(false); load();
  }

  async function autoScore() {
    if (!scoringCall || !scoringCard) { toast.error('Call-ID und Scorecard wählen'); return; }
    setScoring(true);
    const { data, error } = await supabase.functions.invoke('ac-qm-auto-score', { body: { call_id: scoringCall, scorecard_id: scoringCard } });
    setScoring(false);
    if (error || (data as any)?.error) { toast.error((error?.message) || (data as any)?.error || 'Fehler'); return; }
    toast.success(`AI-Score: ${(data as any).percent}%`);
    load();
  }

  async function markCoachingDone(id: string) {
    await supabase.from('ac_qm_evaluations').update({ coaching_done_at: new Date().toISOString(), coaching_required: false }).eq('id', id);
    load();
  }

  return (
    <div className="p-6 space-y-4 h-full overflow-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><ClipboardCheck className="w-5 h-5 text-primary" /> Quality Management</h2>
          <p className="text-xs text-muted-foreground">Scorecards, Call-Scoring (AI-gestützt), Coaching-Workflows.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1.5" />Neue Scorecard</Button></DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>Neue Scorecard</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Textarea placeholder="Beschreibung (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <select className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
                <option value="call">Call</option><option value="chat">Chat</option><option value="email">Email</option>
              </select>
              <div className="space-y-2 max-h-72 overflow-auto">
                {form.criteria.map((c, i) => (
                  <div key={i} className="grid grid-cols-12 gap-1 items-center">
                    <Input className="col-span-3" placeholder="key" value={c.key} onChange={(e) => { const n=[...form.criteria]; n[i].key=e.target.value; setForm({...form,criteria:n}); }} />
                    <Input className="col-span-4" placeholder="Label" value={c.label} onChange={(e) => { const n=[...form.criteria]; n[i].label=e.target.value; setForm({...form,criteria:n}); }} />
                    <Input type="number" className="col-span-2" placeholder="Gew." value={c.weight} onChange={(e) => { const n=[...form.criteria]; n[i].weight=Number(e.target.value); setForm({...form,criteria:n}); }} />
                    <Input type="number" className="col-span-2" placeholder="Max" value={c.max_score} onChange={(e) => { const n=[...form.criteria]; n[i].max_score=Number(e.target.value); setForm({...form,criteria:n}); }} />
                    <Button size="sm" variant="ghost" className="col-span-1" onClick={() => setForm({ ...form, criteria: form.criteria.filter((_, k) => k !== i) })}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                ))}
              </div>
              <Button size="sm" variant="outline" onClick={() => setForm({ ...form, criteria: [...form.criteria, { key: 'neu', label: 'Neues Kriterium', weight: 1, max_score: 5 }] })}>+ Kriterium</Button>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
              <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Speichern'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> AI Auto-Score</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2 items-center">
          <Input placeholder="Call-ID" value={scoringCall} onChange={(e) => setScoringCall(e.target.value)} className="max-w-xs" />
          <select className="h-9 rounded-md border border-border bg-background px-2 text-sm" value={scoringCard} onChange={(e) => setScoringCard(e.target.value)}>
            <option value="">Scorecard wählen…</option>
            {cards.filter((c) => c.is_active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <Button onClick={autoScore} disabled={scoring || !scoringCall || !scoringCard}>
            {scoring ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
            AI bewerten
          </Button>
          <span className="text-[11px] text-muted-foreground">Call muss ein Transkript haben (via Voice AI).</span>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin w-6 h-6" /></div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Scorecards</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {cards.length === 0 && <p className="text-xs text-muted-foreground">Noch keine Scorecards.</p>}
              {cards.map((c) => (
                <div key={c.id} className="border border-border/60 rounded p-2">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{c.name}</p>
                    <Badge variant="outline">{c.channel}</Badge>
                    {c.is_active && <Badge className="bg-emerald-500/15 text-emerald-500">aktiv</Badge>}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">{c.criteria?.length ?? 0} Kriterien</p>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Letzte Bewertungen</CardTitle></CardHeader>
            <CardContent className="space-y-2 max-h-[420px] overflow-auto">
              {evals.length === 0 && <p className="text-xs text-muted-foreground">Noch keine Bewertungen.</p>}
              {evals.map((e) => (
                <div key={e.id} className="border border-border/60 rounded p-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold ${(e.percent ?? 0) >= 85 ? 'text-emerald-500' : (e.percent ?? 0) >= 70 ? 'text-amber-500' : 'text-rose-500'}`}>{e.percent ?? '–'}%</span>
                    {e.ai_generated && <Badge variant="outline" className="text-[10px]">AI</Badge>}
                    <Badge variant="outline" className="text-[10px]">{e.status}</Badge>
                    {e.coaching_required && <Badge className="bg-amber-500/15 text-amber-500 text-[10px]">Coaching</Badge>}
                    <span className="text-[10px] text-muted-foreground ml-auto">{new Date(e.created_at).toLocaleString('de-DE')}</span>
                  </div>
                  {e.notes && <p className="text-xs text-muted-foreground mt-1">{e.notes}</p>}
                  {e.coaching_required && (
                    <Button size="sm" variant="secondary" className="mt-2 h-7 text-xs" onClick={() => markCoachingDone(e.id)}>Coaching erledigt</Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

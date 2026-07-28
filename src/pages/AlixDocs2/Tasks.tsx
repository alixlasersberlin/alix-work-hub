import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ListChecks, Plus, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';

type Task = {
  id: string; doc_id: string | null; title: string; description: string | null;
  assignee: string | null; created_by: string | null; due_at: string | null;
  status: string; priority: string; created_at: string;
};

export default function AlixDocsTasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'mine' | 'all' | 'open' | 'done'>('mine');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: 'normal', due_at: '' });

  async function load() {
    setLoading(true);
    let q = supabase.from('alixdocs2_tasks').select('*').order('created_at', { ascending: false }).limit(200);
    if (filter === 'mine') q = q.or(`assignee.eq.${user?.id},created_by.eq.${user?.id}`);
    if (filter === 'open') q = q.neq('status', 'done');
    if (filter === 'done') q = q.eq('status', 'done');
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setTasks((data as Task[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter, user?.id]);

  async function create() {
    if (!form.title.trim()) { toast.error('Titel fehlt'); return; }
    const { error } = await supabase.from('alixdocs2_tasks').insert({
      title: form.title,
      description: form.description || null,
      priority: form.priority,
      due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
      created_by: user?.id,
      assignee: user?.id,
    });
    if (error) return toast.error(error.message);
    toast.success('Aufgabe erstellt');
    setOpen(false);
    setForm({ title: '', description: '', priority: 'normal', due_at: '' });
    load();
  }

  async function toggleDone(t: Task) {
    const newStatus = t.status === 'done' ? 'open' : 'done';
    const { error } = await supabase.from('alixdocs2_tasks').update({ status: newStatus }).eq('id', t.id);
    if (error) return toast.error(error.message);
    load();
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-display gold-text flex items-center gap-2">
            <ListChecks className="w-6 h-6" /> Aufgaben
          </h1>
          <p className="text-sm text-muted-foreground">
            Aufgaben zu Dokumenten, mir zugewiesen oder von mir erstellt.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-1" /> Neue Aufgabe</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Neue Aufgabe</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Titel" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              <Textarea placeholder="Beschreibung (optional)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Niedrig</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">Hoch</SelectItem>
                    <SelectItem value="urgent">Dringend</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="datetime-local" value={form.due_at} onChange={e => setForm({ ...form, due_at: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
              <Button onClick={create}>Erstellen</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2">
        {(['mine','open','done','all'] as const).map(f => (
          <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} onClick={() => setFilter(f)}>
            {f === 'mine' ? 'Meine' : f === 'open' ? 'Offen' : f === 'done' ? 'Erledigt' : 'Alle'}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">{tasks.length} Aufgaben</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          {loading && <p className="text-sm text-muted-foreground">Lade…</p>}
          {!loading && tasks.length === 0 && <p className="text-sm text-muted-foreground">Keine Aufgaben.</p>}
          {tasks.map(t => {
            const overdue = t.due_at && t.status !== 'done' && new Date(t.due_at) < new Date();
            return (
              <div key={t.id} className="flex items-center justify-between border-b py-2 last:border-0">
                <div className="flex items-start gap-3 min-w-0">
                  <button onClick={() => toggleDone(t)} className="mt-0.5">
                    <CheckCircle2 className={`w-5 h-5 ${t.status === 'done' ? 'text-green-500' : 'text-muted-foreground'}`} />
                  </button>
                  <div className="min-w-0">
                    <p className={`text-sm font-medium ${t.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                      {t.title}
                    </p>
                    {t.description && <p className="text-xs text-muted-foreground truncate">{t.description}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {t.priority === 'urgent' && <Badge variant="destructive">Dringend</Badge>}
                  {t.priority === 'high' && <Badge className="bg-amber-500">Hoch</Badge>}
                  {overdue && <span className="text-xs text-red-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />überfällig</span>}
                  {t.due_at && !overdue && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(t.due_at).toLocaleDateString('de-DE')}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

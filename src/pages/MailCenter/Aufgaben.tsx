import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckSquare, Plus } from 'lucide-react';
import { toast } from 'sonner';

const STATUS = [
  ['offen', 'Offen'], ['in_bearbeitung', 'In Bearbeitung'],
  ['wartet_kunde', 'Wartet auf Kunde'], ['erledigt', 'Erledigt'], ['abgebrochen', 'Abgebrochen'],
];
const DEPARTMENTS = ['finance', 'vertrieb', 'service', 'technik', 'marketing'];

export default function Aufgaben() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('alle');
  const [form, setForm] = useState<any>({ priority: 'normal', status: 'offen', department: 'vertrieb' });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('mail_tasks').select('*').order('due_date', { ascending: true, nullsFirst: false }).limit(300);
    setItems(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.title) { toast.error('Titel fehlt'); return; }
    const { data: user } = await supabase.auth.getUser();
    const { error } = await supabase.from('mail_tasks').insert({ ...form, created_by: user.user?.id, assigned_to: form.assigned_to || user.user?.id });
    if (error) { toast.error(error.message); return; }
    toast.success('Aufgabe erstellt');
    setOpen(false);
    setForm({ priority: 'normal', status: 'offen', department: 'vertrieb' });
    load();
  };

  const setStatus = async (id: string, status: string) => {
    const patch: any = { status };
    if (status === 'erledigt') { patch.completed_at = new Date().toISOString(); }
    const { error } = await supabase.from('mail_tasks').update(patch).eq('id', id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const filtered = filter === 'alle' ? items : items.filter(i => i.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold">Aufgaben</h2>
          <Badge variant="outline">{items.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle</SelectItem>
              {STATUS.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Neue Aufgabe</Button></DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader><DialogTitle>Aufgabe anlegen</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Titel *</Label><Input value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
                <div><Label>Beschreibung</Label><Textarea rows={3} value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Fälligkeit</Label><Input type="date" value={form.due_date || ''} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
                  <div>
                    <Label>Abteilung</Label>
                    <Select value={form.department} onValueChange={v => setForm({ ...form, department: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Priorität</Label>
                    <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{['low', 'normal', 'high', 'urgent'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUS.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Abbrechen</Button>
                <Button onClick={save}>Speichern</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="divide-y divide-border">
        {loading && <div className="p-6 text-center text-muted-foreground">Lade...</div>}
        {!loading && filtered.length === 0 && <div className="p-6 text-center text-muted-foreground">Keine Aufgaben</div>}
        {filtered.map(t => {
          const overdue = t.due_date && t.status !== 'erledigt' && t.status !== 'abgebrochen' && new Date(t.due_date) < new Date(new Date().toDateString());
          return (
            <div key={t.id} className="p-4 hover:bg-muted/30">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{t.title}</span>
                    <Badge variant="outline">{STATUS.find(([k]) => k === t.status)?.[1] || t.status}</Badge>
                    {t.priority !== 'normal' && <Badge variant={t.priority === 'urgent' ? 'destructive' : 'secondary'}>{t.priority}</Badge>}
                    {overdue && <Badge variant="destructive">überfällig</Badge>}
                    {t.department && <Badge variant="outline">{t.department}</Badge>}
                  </div>
                  {t.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{t.description}</p>}
                  {t.due_date && <p className="text-xs text-muted-foreground mt-1">Fällig: {t.due_date}</p>}
                </div>
                <Select value={t.status} onValueChange={v => setStatus(t.id, v)}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

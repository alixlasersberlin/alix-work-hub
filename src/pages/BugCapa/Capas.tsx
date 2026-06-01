import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/StatusBadge';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Section, CAPA_STATUS, statusLabel } from './_shared';

type Capa = {
  id: string;
  capa_number: string;
  title: string;
  trigger_type: string;
  status: string;
  due_date: string | null;
  responsible_id: string | null;
  created_at: string;
};

export default function Capas() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Capa[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: '', trigger_type: 'sonstiges',
    root_cause: '', immediate_action: '', corrective_action: '', preventive_action: '',
    due_date: '',
  });

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('capas').select('*').order('created_at', { ascending: false }).limit(500);
    if (error) toast.error('CAPA laden fehlgeschlagen: ' + error.message);
    setRows((data ?? []) as Capa[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function create() {
    if (!form.title.trim()) { toast.error('Titel erforderlich'); return; }
    if (!user) return;
    const { error } = await (supabase as any).from('capas').insert({
      title: form.title.trim(),
      trigger_type: form.trigger_type,
      root_cause: form.root_cause || null,
      immediate_action: form.immediate_action || null,
      corrective_action: form.corrective_action || null,
      preventive_action: form.preventive_action || null,
      due_date: form.due_date || null,
      responsible_id: user.id,
      created_by: user.id,
    });
    if (error) { toast.error('Anlegen fehlgeschlagen: ' + error.message); return; }
    toast.success('CAPA angelegt');
    setOpen(false);
    setForm({ title: '', trigger_type: 'sonstiges', root_cause: '', immediate_action: '', corrective_action: '', preventive_action: '', due_date: '' });
    load();
  }

  async function setStatus(id: string, status: string) {
    const { error } = await (supabase as any).from('capas').update({ status }).eq('id', id);
    if (error) { toast.error('Update fehlgeschlagen: ' + error.message); return; }
    load();
  }

  return (
    <Section
      title={`CAPA (${rows.length})`}
      action={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Neue CAPA</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Neue CAPA anlegen</DialogTitle></DialogHeader>
            <div className="grid gap-3 py-2 max-h-[70vh] overflow-y-auto pr-1">
              <div><Label>Titel *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
              <div>
                <Label>Auslöser</Label>
                <Select value={form.trigger_type} onValueChange={v => setForm({ ...form, trigger_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['bug', 'reklamation', 'audit', 'sonstiges'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Ursachenanalyse</Label><Textarea rows={3} value={form.root_cause} onChange={e => setForm({ ...form, root_cause: e.target.value })} /></div>
              <div><Label>Sofortmaßnahme</Label><Textarea rows={2} value={form.immediate_action} onChange={e => setForm({ ...form, immediate_action: e.target.value })} /></div>
              <div><Label>Korrekturmaßnahme</Label><Textarea rows={2} value={form.corrective_action} onChange={e => setForm({ ...form, corrective_action: e.target.value })} /></div>
              <div><Label>Vorbeugemaßnahme</Label><Textarea rows={2} value={form.preventive_action} onChange={e => setForm({ ...form, preventive_action: e.target.value })} /></div>
              <div><Label>Frist</Label><Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Abbrechen</Button>
              <Button onClick={create}>Speichern</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>CAPA-Nr.</TableHead>
              <TableHead>Titel</TableHead>
              <TableHead>Auslöser</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Frist</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Lade …</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Noch keine CAPAs.</TableCell></TableRow>
            ) : rows.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.capa_number}</TableCell>
                <TableCell className="font-medium">{r.title}</TableCell>
                <TableCell><StatusBadge status={r.trigger_type} /></TableCell>
                <TableCell><StatusBadge status={statusLabel(r.status)} /></TableCell>
                <TableCell className="text-sm">{r.due_date ?? '—'}</TableCell>
                <TableCell>
                  <Select value={r.status} onValueChange={v => setStatus(r.id, v)}>
                    <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>{CAPA_STATUS.map(s => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}</SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Section>
  );
}

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
import { Section, ACTION_STATUS, statusLabel } from './_shared';

type Row = {
  id: string; action_text: string; source: string; status: string;
  due_date: string | null; completed_at: string | null; evidence_text: string | null;
  created_at: string;
};

export default function Massnahmen() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ action_text: '', source: 'capa', due_date: '', evidence_text: '' });

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('capa_actions').select('*').order('created_at', { ascending: false }).limit(500);
    if (error) toast.error('Maßnahmen laden fehlgeschlagen: ' + error.message);
    setRows((data ?? []) as Row[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!form.action_text.trim()) { toast.error('Maßnahme erforderlich'); return; }
    if (!user) return;
    const { error } = await (supabase as any).from('capa_actions').insert({
      action_text: form.action_text.trim(),
      source: form.source,
      due_date: form.due_date || null,
      evidence_text: form.evidence_text || null,
      responsible_id: user.id,
      created_by: user.id,
    });
    if (error) { toast.error('Anlegen fehlgeschlagen: ' + error.message); return; }
    toast.success('Maßnahme erfasst');
    setOpen(false);
    setForm({ action_text: '', source: 'capa', due_date: '', evidence_text: '' });
    load();
  }

  async function setStatus(id: string, status: string) {
    const patch: any = { status };
    if (status === 'erledigt') patch.completed_at = new Date().toISOString().slice(0, 10);
    const { error } = await (supabase as any).from('capa_actions').update(patch).eq('id', id);
    if (error) { toast.error('Update fehlgeschlagen: ' + error.message); return; }
    load();
  }

  return (
    <Section
      title={`Maßnahmen (${rows.length})`}
      action={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />Neue Maßnahme</Button></DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>Neue Maßnahme</DialogTitle></DialogHeader>
            <div className="grid gap-3 py-2">
              <div><Label>Maßnahme *</Label><Textarea rows={3} value={form.action_text} onChange={e => setForm({ ...form, action_text: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Quelle</Label>
                  <Select value={form.source} onValueChange={v => setForm({ ...form, source: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{['capa', 'bug', 'audit', 'reklamation'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Frist</Label><Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
              </div>
              <div><Label>Nachweis</Label><Textarea rows={2} value={form.evidence_text} onChange={e => setForm({ ...form, evidence_text: e.target.value })} /></div>
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
              <TableHead>Maßnahme</TableHead>
              <TableHead>Quelle</TableHead>
              <TableHead>Frist</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Abschluss</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Lade …</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Noch keine Maßnahmen.</TableCell></TableRow>
            ) : rows.map(r => (
              <TableRow key={r.id}>
                <TableCell className="max-w-[420px]"><div className="whitespace-pre-wrap text-sm">{r.action_text}</div></TableCell>
                <TableCell><StatusBadge status={r.source} /></TableCell>
                <TableCell className="text-sm">{r.due_date ?? '—'}</TableCell>
                <TableCell><StatusBadge status={statusLabel(r.status)} /></TableCell>
                <TableCell className="text-sm">{r.completed_at ?? '—'}</TableCell>
                <TableCell>
                  <Select value={r.status} onValueChange={v => setStatus(r.id, v)}>
                    <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>{ACTION_STATUS.map(s => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}</SelectContent>
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

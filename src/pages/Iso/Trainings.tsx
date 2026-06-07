import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Section } from './_shared';

type Training = {
  id: string;
  title: string;
  description: string | null;
  standard: string | null;
  is_mandatory: boolean;
  validity_months: number | null;
  created_at: string;
};

type Record_ = {
  id: string;
  training_id: string;
  user_id: string;
  completed_at: string;
  expires_at: string | null;
  note: string | null;
};

export default function IsoTrainings() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Training[]>([]);
  const [records, setRecords] = useState<Record_[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [recOpen, setRecOpen] = useState<Training | null>(null);
  const [form, setForm] = useState({ title: '', description: '', standard: 'ISO 13485', is_mandatory: false, validity_months: '12' });
  const [recForm, setRecForm] = useState({ user_email: '', completed_at: new Date().toISOString().slice(0, 10), note: '' });

  async function load() {
    setLoading(true);
    const sb = supabase as any;
    const [t, r] = await Promise.all([
      sb.from('iso_trainings').select('*').order('created_at', { ascending: false }),
      sb.from('iso_training_records').select('*').order('completed_at', { ascending: false }).limit(1000),
    ]);
    if (t.error) toast.error('Laden fehlgeschlagen: ' + t.error.message);
    setRows((t.data ?? []) as Training[]);
    setRecords((r.data ?? []) as Record_[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!form.title.trim()) { toast.error('Titel erforderlich'); return; }
    const { error } = await (supabase as any).from('iso_trainings').insert({
      title: form.title.trim(),
      description: form.description || null,
      standard: form.standard || null,
      is_mandatory: form.is_mandatory,
      validity_months: form.validity_months ? Number(form.validity_months) : null,
      created_by: user?.id,
    });
    if (error) { toast.error('Anlegen fehlgeschlagen: ' + error.message); return; }
    toast.success('Schulung angelegt');
    setOpen(false);
    setForm({ title: '', description: '', standard: 'ISO 13485', is_mandatory: false, validity_months: '12' });
    load();
  }

  async function addRecord() {
    if (!recOpen) return;
    if (!recForm.user_email.trim()) { toast.error('E-Mail erforderlich'); return; }
    // Lookup user by email via user_profiles
    const { data: prof, error: e1 } = await (supabase as any)
      .from('user_profiles').select('id').eq('email', recForm.user_email.trim()).maybeSingle();
    if (e1 || !prof) { toast.error('Benutzer nicht gefunden'); return; }
    const expires = recOpen.validity_months
      ? new Date(new Date(recForm.completed_at).setMonth(new Date(recForm.completed_at).getMonth() + recOpen.validity_months))
          .toISOString().slice(0, 10)
      : null;
    const { error } = await (supabase as any).from('iso_training_records').insert({
      training_id: recOpen.id,
      user_id: prof.id,
      completed_at: recForm.completed_at,
      expires_at: expires,
      note: recForm.note || null,
      created_by: user?.id,
    });
    if (error) { toast.error('Eintragen fehlgeschlagen: ' + error.message); return; }
    toast.success('Teilnahme eingetragen');
    setRecForm({ user_email: '', completed_at: new Date().toISOString().slice(0, 10), note: '' });
    setRecOpen(null);
    load();
  }

  function countFor(id: string) {
    return records.filter(r => r.training_id === id).length;
  }

  return (
    <Section
      title={`Schulungen (${rows.length})`}
      action={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Neue Schulung</Button></DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>Neue Schulung</DialogTitle></DialogHeader>
            <div className="grid gap-3 py-2">
              <div><Label>Titel *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
              <div><Label>Beschreibung</Label><Textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Norm</Label><Input value={form.standard} onChange={e => setForm({ ...form, standard: e.target.value })} /></div>
                <div><Label>Gültigkeit (Monate)</Label><Input type="number" value={form.validity_months} onChange={e => setForm({ ...form, validity_months: e.target.value })} /></div>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={form.is_mandatory} onCheckedChange={v => setForm({ ...form, is_mandatory: v })} />
                <Label>Pflichtschulung</Label>
              </div>
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
              <TableHead>Titel</TableHead>
              <TableHead>Norm</TableHead>
              <TableHead>Pflicht</TableHead>
              <TableHead>Gültigkeit</TableHead>
              <TableHead>Teilnehmer</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Lade …</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Keine Schulungen.</TableCell></TableRow>
            ) : rows.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.title}</TableCell>
                <TableCell>{r.standard ?? '—'}</TableCell>
                <TableCell>{r.is_mandatory ? 'Ja' : 'Nein'}</TableCell>
                <TableCell>{r.validity_months ? `${r.validity_months} Monate` : '—'}</TableCell>
                <TableCell>{countFor(r.id)}</TableCell>
                <TableCell>
                  <Button size="sm" variant="outline" onClick={() => setRecOpen(r)}>
                    <Users className="h-4 w-4 mr-1" /> Teilnahme
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!recOpen} onOpenChange={(v) => !v && setRecOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Teilnahme: {recOpen?.title}</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div><Label>Mitarbeiter (E-Mail)</Label><Input value={recForm.user_email} onChange={e => setRecForm({ ...recForm, user_email: e.target.value })} /></div>
            <div><Label>Abschluss-Datum</Label><Input type="date" value={recForm.completed_at} onChange={e => setRecForm({ ...recForm, completed_at: e.target.value })} /></div>
            <div><Label>Notiz</Label><Textarea rows={2} value={recForm.note} onChange={e => setRecForm({ ...recForm, note: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRecOpen(null)}>Abbrechen</Button>
            <Button onClick={addRecord}>Eintragen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  );
}

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
import { Plus, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { Section } from './_shared';

type Change = {
  id: string;
  title: string;
  area: string | null;
  description: string | null;
  reason: string | null;
  risk_class: string | null;
  status: string;
  requested_by: string | null;
  approved_at: string | null;
  effective_date: string | null;
};

const AREAS = ['Produkt', 'Prozess', 'Dokument', 'Lieferant', 'IT'];
const RISKS = ['niedrig', 'mittel', 'hoch'];
const STATUSES = ['eingereicht', 'bewertung', 'genehmigt', 'abgelehnt', 'umgesetzt', 'geschlossen'];

export default function IsoChanges() {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole('Super Admin') || hasRole('Admin');
  const [rows, setRows] = useState<Change[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: '', area: 'Prozess', description: '', reason: '', risk_class: 'mittel', effective_date: '',
  });

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase as any).from('iso_change_controls')
      .select('*').order('created_at', { ascending: false }).limit(500);
    if (error) toast.error('Laden fehlgeschlagen: ' + error.message);
    setRows((data ?? []) as Change[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!form.title.trim()) { toast.error('Titel erforderlich'); return; }
    const { error } = await (supabase as any).from('iso_change_controls').insert({
      title: form.title.trim(),
      area: form.area,
      description: form.description || null,
      reason: form.reason || null,
      risk_class: form.risk_class,
      effective_date: form.effective_date || null,
      requested_by: user?.id,
    });
    if (error) { toast.error('Anlegen fehlgeschlagen: ' + error.message); return; }
    toast.success('Änderungsantrag angelegt');
    setOpen(false);
    setForm({ title: '', area: 'Prozess', description: '', reason: '', risk_class: 'mittel', effective_date: '' });
    load();
  }

  async function setStatus(id: string, status: string) {
    const patch: any = { status };
    if (status === 'genehmigt' || status === 'abgelehnt') {
      patch.approved_by = user?.id;
      patch.approved_at = new Date().toISOString();
    }
    const { error } = await (supabase as any).from('iso_change_controls').update(patch).eq('id', id);
    if (error) { toast.error('Update fehlgeschlagen: ' + error.message); return; }
    load();
  }

  return (
    <Section
      title={`Änderungsanträge (${rows.length})`}
      action={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Neuer Antrag</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Neuer Änderungsantrag</DialogTitle></DialogHeader>
            <div className="grid gap-3 py-2">
              <div><Label>Titel *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Bereich</Label>
                  <Select value={form.area} onValueChange={v => setForm({ ...form, area: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{AREAS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Risikoklasse</Label>
                  <Select value={form.risk_class} onValueChange={v => setForm({ ...form, risk_class: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{RISKS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Wirksam ab</Label><Input type="date" value={form.effective_date} onChange={e => setForm({ ...form, effective_date: e.target.value })} /></div>
              </div>
              <div><Label>Beschreibung</Label><Textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
              <div><Label>Begründung</Label><Textarea rows={2} value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Abbrechen</Button>
              <Button onClick={create}>Einreichen</Button>
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
              <TableHead>Bereich</TableHead>
              <TableHead>Risiko</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Wirksam ab</TableHead>
              <TableHead>Genehmigt</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Lade …</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Keine Anträge.</TableCell></TableRow>
            ) : rows.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.title}</TableCell>
                <TableCell>{r.area ?? '—'}</TableCell>
                <TableCell>{r.risk_class ? <StatusBadge status={r.risk_class} /> : '—'}</TableCell>
                <TableCell>
                  <Select value={r.status} onValueChange={v => setStatus(r.id, v)}>
                    <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </TableCell>
                <TableCell>{r.effective_date ?? '—'}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.approved_at ? new Date(r.approved_at).toLocaleDateString('de-DE') : '—'}</TableCell>
                <TableCell>
                  {isAdmin && r.status === 'bewertung' && (
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-500" onClick={() => setStatus(r.id, 'genehmigt')}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setStatus(r.id, 'abgelehnt')}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Section>
  );
}

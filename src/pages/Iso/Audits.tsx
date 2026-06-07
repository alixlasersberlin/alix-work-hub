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
import { Section } from './_shared';

type Audit = {
  id: string;
  title: string;
  audit_type: string;
  standard: string;
  auditor: string | null;
  audit_date: string | null;
  status: string;
  result: string | null;
  scope: string | null;
  summary: string | null;
};

const TYPES = ['internal', 'external', 'supplier', 'regulatory'];
const STANDARDS = ['ISO 13485', 'MDR', 'ISO 9001', 'ISO 14971'];
const STATUSES = ['geplant', 'laufend', 'abgeschlossen', 'nachbearbeitung'];
const RESULTS = ['bestanden', 'mit_abweichungen', 'nicht_bestanden'];

export default function IsoAudits() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: '', audit_type: 'internal', standard: 'ISO 13485',
    auditor: '', audit_date: '', scope: '', status: 'geplant', summary: '',
  });

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase as any).from('iso_audits')
      .select('*').order('audit_date', { ascending: false, nullsFirst: false }).limit(500);
    if (error) toast.error('Laden fehlgeschlagen: ' + error.message);
    setRows((data ?? []) as Audit[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!form.title.trim()) { toast.error('Titel erforderlich'); return; }
    const { error } = await (supabase as any).from('iso_audits').insert({
      title: form.title.trim(),
      audit_type: form.audit_type,
      standard: form.standard,
      auditor: form.auditor || null,
      audit_date: form.audit_date || null,
      scope: form.scope || null,
      status: form.status,
      summary: form.summary || null,
      created_by: user?.id,
    });
    if (error) { toast.error('Anlegen fehlgeschlagen: ' + error.message); return; }
    toast.success('Audit angelegt');
    setOpen(false);
    setForm({ title: '', audit_type: 'internal', standard: 'ISO 13485', auditor: '', audit_date: '', scope: '', status: 'geplant', summary: '' });
    load();
  }

  async function setStatus(id: string, status: string) {
    const { error } = await (supabase as any).from('iso_audits').update({ status }).eq('id', id);
    if (error) { toast.error('Update fehlgeschlagen: ' + error.message); return; }
    load();
  }

  async function setResult(id: string, result: string) {
    const { error } = await (supabase as any).from('iso_audits').update({ result }).eq('id', id);
    if (error) { toast.error('Update fehlgeschlagen: ' + error.message); return; }
    load();
  }

  return (
    <Section
      title={`Audits (${rows.length})`}
      action={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Neues Audit</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Neues Audit anlegen</DialogTitle></DialogHeader>
            <div className="grid gap-3 py-2">
              <div><Label>Titel *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Typ</Label>
                  <Select value={form.audit_type} onValueChange={v => setForm({ ...form, audit_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Norm</Label>
                  <Select value={form.standard} onValueChange={v => setForm({ ...form, standard: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STANDARDS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Auditor</Label><Input value={form.auditor} onChange={e => setForm({ ...form, auditor: e.target.value })} /></div>
                <div><Label>Datum</Label><Input type="date" value={form.audit_date} onChange={e => setForm({ ...form, audit_date: e.target.value })} /></div>
              </div>
              <div><Label>Scope</Label><Input value={form.scope} onChange={e => setForm({ ...form, scope: e.target.value })} /></div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Zusammenfassung</Label><Textarea rows={3} value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} /></div>
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
              <TableHead>Typ</TableHead>
              <TableHead>Norm</TableHead>
              <TableHead>Auditor</TableHead>
              <TableHead>Datum</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ergebnis</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Lade …</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Keine Audits.</TableCell></TableRow>
            ) : rows.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.title}</TableCell>
                <TableCell>{r.audit_type}</TableCell>
                <TableCell>{r.standard}</TableCell>
                <TableCell>{r.auditor ?? '—'}</TableCell>
                <TableCell>{r.audit_date ?? '—'}</TableCell>
                <TableCell>
                  <Select value={r.status} onValueChange={v => setStatus(r.id, v)}>
                    <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select value={r.result ?? ''} onValueChange={v => setResult(r.id, v)}>
                    <SelectTrigger className="h-8 w-44"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{RESULTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
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

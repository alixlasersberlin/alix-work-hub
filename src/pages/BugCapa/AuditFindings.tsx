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
import { Section, FINDING_TYPES, statusLabel } from './_shared';

type Row = {
  id: string; finding_number: string; audit_name: string; audit_date: string | null;
  auditor: string | null; area: string | null; finding_type: string; description: string;
  status: string; capa_id: string | null; created_at: string;
};

export default function AuditFindings() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    audit_name: '', audit_date: '', auditor: '', area: '',
    finding_type: 'beobachtung', description: '', reference: '',
  });

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('audit_findings').select('*').order('created_at', { ascending: false }).limit(500);
    if (error) toast.error('Feststellungen laden fehlgeschlagen: ' + error.message);
    setRows((data ?? []) as Row[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!form.audit_name.trim() || !form.description.trim()) { toast.error('Audit-Name und Beschreibung erforderlich'); return; }
    if (!user) return;
    const { error } = await (supabase as any).from('audit_findings').insert({
      audit_name: form.audit_name.trim(),
      audit_date: form.audit_date || null,
      auditor: form.auditor || null,
      area: form.area || null,
      finding_type: form.finding_type,
      description: form.description.trim(),
      reference: form.reference || null,
      created_by: user.id,
    });
    if (error) { toast.error('Anlegen fehlgeschlagen: ' + error.message); return; }
    toast.success('Feststellung erfasst');
    setOpen(false);
    setForm({ audit_name: '', audit_date: '', auditor: '', area: '', finding_type: 'beobachtung', description: '', reference: '' });
    load();
  }

  async function createCapaFromFinding(r: Row) {
    if (!user) return;
    if (r.capa_id) { toast.info('CAPA existiert bereits'); return; }
    const { data, error } = await (supabase as any).from('capas').insert({
      title: `CAPA aus Audit ${r.finding_number}: ${r.audit_name}`,
      trigger_type: 'audit',
      audit_finding_id: r.id,
      created_by: user.id,
      responsible_id: user.id,
    }).select('id').single();
    if (error) { toast.error('CAPA anlegen fehlgeschlagen: ' + error.message); return; }
    await (supabase as any).from('audit_findings').update({ capa_id: data.id }).eq('id', r.id);
    toast.success('CAPA aus Feststellung erstellt');
    load();
  }

  return (
    <Section
      title={`Audit-Feststellungen (${rows.length})`}
      action={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />Neue Feststellung</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Neue Audit-Feststellung</DialogTitle></DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Audit *</Label><Input value={form.audit_name} onChange={e => setForm({ ...form, audit_name: e.target.value })} /></div>
                <div><Label>Datum</Label><Input type="date" value={form.audit_date} onChange={e => setForm({ ...form, audit_date: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Auditor</Label><Input value={form.auditor} onChange={e => setForm({ ...form, auditor: e.target.value })} /></div>
                <div><Label>Bereich</Label><Input value={form.area} onChange={e => setForm({ ...form, area: e.target.value })} /></div>
              </div>
              <div>
                <Label>Typ</Label>
                <Select value={form.finding_type} onValueChange={v => setForm({ ...form, finding_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FINDING_TYPES.map(t => <SelectItem key={t} value={t}>{statusLabel(t)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Beschreibung *</Label><Textarea rows={4} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
              <div><Label>Referenz / Norm</Label><Input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} /></div>
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
              <TableHead>Nr.</TableHead>
              <TableHead>Audit</TableHead>
              <TableHead>Datum</TableHead>
              <TableHead>Bereich</TableHead>
              <TableHead>Typ</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>CAPA</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Lade …</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Noch keine Feststellungen.</TableCell></TableRow>
            ) : rows.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.finding_number}</TableCell>
                <TableCell className="font-medium">{r.audit_name}</TableCell>
                <TableCell className="text-sm">{r.audit_date ?? '—'}</TableCell>
                <TableCell className="text-sm">{r.area ?? '—'}</TableCell>
                <TableCell><StatusBadge status={statusLabel(r.finding_type)} /></TableCell>
                <TableCell><StatusBadge status={r.status} /></TableCell>
                <TableCell className="text-xs">{r.capa_id ? '✓' : '—'}</TableCell>
                <TableCell>
                  <Button size="sm" variant="outline" disabled={!!r.capa_id} onClick={() => createCapaFromFinding(r)}>
                    In CAPA überführen
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Section>
  );
}

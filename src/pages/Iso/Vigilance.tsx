import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/StatusBadge';
import { Plus, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Section } from './_shared';

type Report = {
  id: string;
  device_name: string | null;
  serial_number: string | null;
  udi: string | null;
  incident_date: string | null;
  reported_at: string;
  severity: string;
  incident_description: string;
  patient_harm: boolean;
  immediate_action: string | null;
  root_cause: string | null;
  authority_status: string;
  authority_reference: string | null;
};

const SEVERITIES = ['gering', 'mittel', 'schwer', 'tödlich'];
const AUTH_STATUSES = ['intern', 'gemeldet', 'rückfrage', 'abgeschlossen'];

export default function IsoVigilance() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    device_name: '', serial_number: '', udi: '', incident_date: '',
    severity: 'gering', incident_description: '', patient_harm: false,
    immediate_action: '', root_cause: '',
  });

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase as any).from('mdr_vigilance_reports')
      .select('*').order('reported_at', { ascending: false }).limit(500);
    if (error) toast.error('Laden fehlgeschlagen: ' + error.message);
    setRows((data ?? []) as Report[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!form.incident_description.trim()) { toast.error('Vorfallsbeschreibung erforderlich'); return; }
    const { error } = await (supabase as any).from('mdr_vigilance_reports').insert({
      device_name: form.device_name || null,
      serial_number: form.serial_number || null,
      udi: form.udi || null,
      incident_date: form.incident_date || null,
      severity: form.severity,
      incident_description: form.incident_description.trim(),
      patient_harm: form.patient_harm,
      immediate_action: form.immediate_action || null,
      root_cause: form.root_cause || null,
      reported_by: user?.id,
    });
    if (error) { toast.error('Anlegen fehlgeschlagen: ' + error.message); return; }
    toast.success('MDR-Meldung erfasst');
    setOpen(false);
    setForm({ device_name: '', serial_number: '', udi: '', incident_date: '', severity: 'gering', incident_description: '', patient_harm: false, immediate_action: '', root_cause: '' });
    load();
  }

  async function setStatus(id: string, authority_status: string) {
    const { error } = await (supabase as any).from('mdr_vigilance_reports').update({ authority_status }).eq('id', id);
    if (error) { toast.error('Update fehlgeschlagen: ' + error.message); return; }
    load();
  }

  return (
    <Section
      title={`MDR Vigilanz-Meldungen (${rows.length})`}
      action={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Neue Meldung</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Neue MDR-Vigilanzmeldung</DialogTitle></DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Gerät</Label><Input value={form.device_name} onChange={e => setForm({ ...form, device_name: e.target.value })} /></div>
                <div><Label>Seriennummer</Label><Input value={form.serial_number} onChange={e => setForm({ ...form, serial_number: e.target.value })} /></div>
                <div><Label>UDI</Label><Input value={form.udi} onChange={e => setForm({ ...form, udi: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Vorfallsdatum</Label><Input type="date" value={form.incident_date} onChange={e => setForm({ ...form, incident_date: e.target.value })} /></div>
                <div>
                  <Label>Schweregrad</Label>
                  <Select value={form.severity} onValueChange={v => setForm({ ...form, severity: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SEVERITIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Vorfallsbeschreibung *</Label><Textarea rows={4} value={form.incident_description} onChange={e => setForm({ ...form, incident_description: e.target.value })} /></div>
              <div className="flex items-center gap-3">
                <Switch checked={form.patient_harm} onCheckedChange={v => setForm({ ...form, patient_harm: v })} />
                <Label>Patientenschaden</Label>
              </div>
              <div><Label>Sofortmaßnahme</Label><Textarea rows={2} value={form.immediate_action} onChange={e => setForm({ ...form, immediate_action: e.target.value })} /></div>
              <div><Label>Ursache</Label><Textarea rows={2} value={form.root_cause} onChange={e => setForm({ ...form, root_cause: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Abbrechen</Button>
              <Button onClick={create}>Erfassen</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Gemeldet</TableHead>
              <TableHead>Gerät / SN</TableHead>
              <TableHead>Schwere</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead>Beschreibung</TableHead>
              <TableHead>Behörden-Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Lade …</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Keine Meldungen.</TableCell></TableRow>
            ) : rows.map(r => (
              <TableRow key={r.id}>
                <TableCell className="text-xs">{r.reported_at}</TableCell>
                <TableCell>{[r.device_name, r.serial_number].filter(Boolean).join(' / ') || '—'}</TableCell>
                <TableCell><StatusBadge status={r.severity} /></TableCell>
                <TableCell>{r.patient_harm ? <span className="inline-flex items-center gap-1 text-destructive"><AlertTriangle className="h-3 w-3" /> Ja</span> : 'Nein'}</TableCell>
                <TableCell className="max-w-xs truncate text-sm text-muted-foreground" title={r.incident_description}>{r.incident_description}</TableCell>
                <TableCell>
                  <Select value={r.authority_status} onValueChange={v => setStatus(r.id, v)}>
                    <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>{AUTH_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
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

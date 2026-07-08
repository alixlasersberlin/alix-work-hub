import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useDepartments } from '@/hooks/esc/useDepartments';
import { DepartmentBadge } from '@/components/esc/DepartmentBadge';
import type { EscDepartment } from '@/lib/esc/types';
import { toast } from 'sonner';

const emptyForm: Omit<EscDepartment, 'id'> = {
  name: '', color: 'hsl(var(--primary))', icon: 'Circle', description: '', active: true, publicBookable: false,
  defaultDurationMinutes: 60, defaultEmailTemplate: '', responsibleEmployeeIds: [], internalVisible: true, externallyBookable: false,
};

export default function EscDepartments() {
  const { departments, createDepartment, updateDepartment, deleteDepartment } = useDepartments();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EscDepartment | null>(null);
  const [form, setForm] = useState<Omit<EscDepartment, 'id'>>(emptyForm);

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (d: EscDepartment) => { setEditing(d); const { id, ...rest } = d; setForm(rest); setOpen(true); };

  const submit = async () => {
    if (!form.name.trim()) { toast.error('Bitte Name angeben'); return; }
    if (editing) { await updateDepartment(editing.id, form); toast.success('Abteilung aktualisiert'); }
    else { await createDepartment(form); toast.success('Abteilung angelegt'); }
    setOpen(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Abteilungen</h1>
        <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Neue Abteilung</Button>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Abteilung</TableHead>
              <TableHead>Beschreibung</TableHead>
              <TableHead>Dauer</TableHead>
              <TableHead>Öffentlich buchbar</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {departments.map((d) => (
              <TableRow key={d.id}>
                <TableCell><DepartmentBadge dept={d} size="md" /></TableCell>
                <TableCell className="text-muted-foreground text-[12px]">{d.description}</TableCell>
                <TableCell className="text-[12px]">{d.defaultDurationMinutes} min</TableCell>
                <TableCell className="text-[12px]">{d.publicBookable ? 'Ja' : 'Nein'}</TableCell>
                <TableCell className="text-[12px]">{d.active ? 'Aktiv' : 'Inaktiv'}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(d)}><Edit className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={async () => { await deleteDepartment(d.id); toast.success('Gelöscht'); }}><Trash2 className="w-4 h-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Abteilung bearbeiten' : 'Neue Abteilung'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-2">
            <div className="md:col-span-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Farbe</Label><Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} placeholder="hsl(var(--primary))" /></div>
            <div><Label>Icon (Lucide-Name)</Label><Input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="Wrench" /></div>
            <div className="md:col-span-2"><Label>Beschreibung</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div><Label>Standarddauer (min)</Label><Input type="number" value={form.defaultDurationMinutes} onChange={(e) => setForm({ ...form, defaultDurationMinutes: Number(e.target.value) })} /></div>
            <div><Label>Standard-E-Mail-Vorlage</Label><Input value={form.defaultEmailTemplate || ''} onChange={(e) => setForm({ ...form, defaultEmailTemplate: e.target.value })} /></div>
            <div className="md:col-span-2 flex flex-wrap gap-4 pt-1 border-t">
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: !!v })} />Aktiv</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.publicBookable} onCheckedChange={(v) => setForm({ ...form, publicBookable: !!v })} />Öffentlich buchbar</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.internalVisible} onCheckedChange={(v) => setForm({ ...form, internalVisible: !!v })} />Intern sichtbar</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.externallyBookable} onCheckedChange={(v) => setForm({ ...form, externallyBookable: !!v })} />Extern buchbar</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={submit}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

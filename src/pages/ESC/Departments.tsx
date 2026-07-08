import { type MouseEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Trash2, X } from 'lucide-react';
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

  const openNew = () => { setEditing(null); setForm({ ...emptyForm }); setOpen(true); };
  const openEdit = (d: EscDepartment) => {
    const { id, ...rest } = d;
    setEditing(d);
    setForm({
      ...emptyForm,
      ...rest,
      responsibleEmployeeIds: rest.responsibleEmployeeIds ?? [],
    });
    setOpen(true);
  };

  const handleEditClick = (event: MouseEvent<HTMLButtonElement>, department: EscDepartment) => {
    event.preventDefault();
    event.stopPropagation();
    openEdit(department);
  };


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
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={`${d.name} bearbeiten`}
                    onClick={(e) => handleEditClick(e, d)}
                  >
                    <Edit className="w-4 h-4" />
                    Bearbeiten
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="Löschen"
                    className="text-destructive"
                    onClick={async (e) => { e.preventDefault(); e.stopPropagation(); await deleteDepartment(d.id); toast.success('Gelöscht'); }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>

              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="esc-department-dialog-title"
            aria-describedby="esc-department-dialog-description"
            className="relative grid w-full max-w-lg gap-4 rounded-lg border bg-card p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Fenster schließen"
              className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex flex-col space-y-1.5 text-left">
              <h2 id="esc-department-dialog-title" className="text-lg font-semibold leading-none tracking-tight">
                {editing ? 'Abteilung bearbeiten' : 'Neue Abteilung'}
              </h2>
              <p id="esc-department-dialog-description" className="text-sm text-muted-foreground">
                Ändern Sie die Stammdaten und Buchbarkeit dieser Abteilung.
              </p>
            </div>

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

            <footer className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={() => setOpen(false)}>Abbrechen</Button>
              <Button onClick={submit}>Speichern</Button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}

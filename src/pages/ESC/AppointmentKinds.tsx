import { type MouseEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Trash2, X, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { useAppointmentKinds } from '@/hooks/esc/useAppointmentKinds';
import { useDepartments } from '@/hooks/esc/useDepartments';
import type { EscAppointmentKind } from '@/lib/esc/appointment-kinds';

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
  '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#64748b',
];

const emptyForm: Omit<EscAppointmentKind, 'id'> = {
  name: '', description: '', color: '#3b82f6', icon: 'Tag',
  defaultDurationMinutes: 60, active: true, publicBookable: false, departmentIds: [],
};

export default function EscAppointmentKindsPage() {
  const { kinds, createKind, updateKind, deleteKind } = useAppointmentKinds();
  const { departments } = useDepartments();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EscAppointmentKind | null>(null);
  const [form, setForm] = useState<Omit<EscAppointmentKind, 'id'>>(emptyForm);

  const openNew = () => { setEditing(null); setForm({ ...emptyForm }); setOpen(true); };
  const openEdit = (k: EscAppointmentKind) => {
    const { id, ...rest } = k;
    setEditing(k);
    setForm({ ...emptyForm, ...rest, departmentIds: rest.departmentIds ?? [] });
    setOpen(true);
  };
  const handleEditClick = (e: MouseEvent<HTMLButtonElement>, k: EscAppointmentKind) => {
    e.preventDefault(); e.stopPropagation(); openEdit(k);
  };

  const submit = async () => {
    if (!form.name.trim()) { toast.error('Bitte Name angeben'); return; }
    if (editing) { await updateKind(editing.id, form); toast.success('Terminart aktualisiert'); }
    else { await createKind(form); toast.success('Terminart angelegt'); }
    setOpen(false);
  };

  const toggleDept = (deptId: string) => {
    setForm((f) => ({
      ...f,
      departmentIds: f.departmentIds.includes(deptId)
        ? f.departmentIds.filter((x) => x !== deptId)
        : [...f.departmentIds, deptId],
    }));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2"><Tag className="w-5 h-5 text-primary" /> Terminarten</h1>
          <p className="text-[12px] text-muted-foreground">Zentrale Verwaltung – wird im Kalender-Dialog und im öffentlichen Buchungsportal genutzt.</p>
        </div>
        <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Neue Terminart</Button>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Terminart</TableHead>
              <TableHead>Beschreibung</TableHead>
              <TableHead>Dauer</TableHead>
              <TableHead>Abteilungen</TableHead>
              <TableHead>Öffentlich</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {kinds.map((k) => (
              <TableRow key={k.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-3 h-3 rounded-full" style={{ background: k.color }} />
                    <span className="font-medium text-[13px]">{k.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-[12px] max-w-xs truncate">{k.description}</TableCell>
                <TableCell className="text-[12px]">{k.defaultDurationMinutes} min</TableCell>
                <TableCell className="text-[11.5px]">
                  {k.departmentIds.length === 0
                    ? <span className="text-muted-foreground">Alle</span>
                    : <div className="flex flex-wrap gap-1">
                        {k.departmentIds.map((id) => {
                          const d = departments.find((x) => x.id === id);
                          return <Badge key={id} variant="outline" className="text-[10px]">{d?.name || id}</Badge>;
                        })}
                      </div>}
                </TableCell>
                <TableCell className="text-[12px]">{k.publicBookable ? 'Ja' : 'Nein'}</TableCell>
                <TableCell className="text-[12px]">{k.active ? 'Aktiv' : 'Inaktiv'}</TableCell>
                <TableCell className="text-right">
                  <Button type="button" size="sm" variant="ghost" onClick={(e) => handleEditClick(e, k)}>
                    <Edit className="w-4 h-4" /> Bearbeiten
                  </Button>
                  <Button
                    type="button" size="icon" variant="ghost" className="text-destructive"
                    onClick={async (e) => { e.preventDefault(); e.stopPropagation(); await deleteKind(k.id); toast.success('Gelöscht'); }}
                    aria-label="Löschen"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {kinds.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8 text-[13px]">Noch keine Terminarten angelegt.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {open && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <section
            role="dialog" aria-modal="true"
            className="relative grid w-full max-w-lg gap-4 rounded-lg border bg-card p-6 shadow-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" aria-label="Schließen" className="absolute right-4 top-4 opacity-70 hover:opacity-100" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </button>
            <div>
              <h2 className="text-lg font-semibold">{editing ? 'Terminart bearbeiten' : 'Neue Terminart'}</h2>
              <p className="text-sm text-muted-foreground">Diese Terminart erscheint im Kalender-Dialog und – wenn „Öffentlich buchbar" – im Buchungsportal.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>Beschreibung</Label><Textarea rows={2} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>

              <div>
                <Label>Farbe</Label>
                <div className="flex items-center gap-2">
                  <input type="color" className="h-9 w-12 cursor-pointer rounded border bg-background p-1" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
                  <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {PRESET_COLORS.map((c) => (
                    <button key={c} type="button" aria-label={c} onClick={() => setForm({ ...form, color: c })}
                      className={`h-6 w-6 rounded-full border-2 ${form.color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                      style={{ background: c }} />
                  ))}
                </div>
              </div>
              <div>
                <Label>Standarddauer (min)</Label>
                <Input type="number" min={5} step={5} value={form.defaultDurationMinutes}
                  onChange={(e) => setForm({ ...form, defaultDurationMinutes: Number(e.target.value) })} />
                <Label className="mt-3 block">Icon (lucide-react)</Label>
                <Input value={form.icon || ''} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="Tag" />
              </div>

              <div className="md:col-span-2">
                <Label>Für Abteilungen (leer = alle)</Label>
                <div className="mt-1 flex flex-wrap gap-1.5 rounded border p-2 max-h-40 overflow-y-auto">
                  {departments.map((d) => (
                    <label key={d.id} className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] cursor-pointer ${form.departmentIds.includes(d.id) ? 'border-primary bg-primary/10' : ''}`}>
                      <Checkbox checked={form.departmentIds.includes(d.id)} onCheckedChange={() => toggleDept(d.id)} />
                      <span className="inline-block w-2 h-2 rounded-full" style={{ background: d.color }} />
                      {d.name}
                    </label>
                  ))}
                  {departments.length === 0 && <span className="text-muted-foreground text-[12px]">Keine Abteilungen vorhanden.</span>}
                </div>
              </div>

              <div className="md:col-span-2 flex flex-wrap gap-4 pt-1 border-t">
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: !!v })} />Aktiv</label>
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.publicBookable} onCheckedChange={(v) => setForm({ ...form, publicBookable: !!v })} />Öffentlich buchbar (Buchungsportal)</label>
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

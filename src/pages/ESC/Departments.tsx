import { type MouseEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Plus, Edit, Trash2, X,
  Circle, Wrench, Stethoscope, Scissors, Hammer, Briefcase, Building2, Users,
  Calendar, Clock, Heart, Star, Truck, Package, Phone, Mail, Camera, Home,
  Car, Coffee, ShoppingCart, Settings, Shield, Zap, Sparkles, Award, Target,
  Activity, Pill, Syringe, Baby,
} from 'lucide-react';
import { useDepartments } from '@/hooks/esc/useDepartments';
import { DepartmentBadge } from '@/components/esc/DepartmentBadge';
import type { EscDepartment } from '@/lib/esc/types';
import { toast } from 'sonner';

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
  '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#64748b',
  '#0f172a', '#ffffff',
];

const ICON_OPTIONS = [
  { name: 'Circle', Icon: Circle }, { name: 'Wrench', Icon: Wrench },
  { name: 'Stethoscope', Icon: Stethoscope }, { name: 'Scissors', Icon: Scissors },
  { name: 'Hammer', Icon: Hammer }, { name: 'Briefcase', Icon: Briefcase },
  { name: 'Building2', Icon: Building2 }, { name: 'Users', Icon: Users },
  { name: 'Calendar', Icon: Calendar }, { name: 'Clock', Icon: Clock },
  { name: 'Heart', Icon: Heart }, { name: 'Star', Icon: Star },
  { name: 'Truck', Icon: Truck }, { name: 'Package', Icon: Package },
  { name: 'Phone', Icon: Phone }, { name: 'Mail', Icon: Mail },
  { name: 'Camera', Icon: Camera }, { name: 'Home', Icon: Home },
  { name: 'Car', Icon: Car }, { name: 'Coffee', Icon: Coffee },
  { name: 'ShoppingCart', Icon: ShoppingCart }, { name: 'Settings', Icon: Settings },
  { name: 'Shield', Icon: Shield }, { name: 'Zap', Icon: Zap },
  { name: 'Sparkles', Icon: Sparkles }, { name: 'Award', Icon: Award },
  { name: 'Target', Icon: Target }, { name: 'Activity', Icon: Activity },
  { name: 'Pill', Icon: Pill }, { name: 'Syringe', Icon: Syringe },
  { name: 'Baby', Icon: Baby },
];

function hslOrHexToHex(v: string): string {
  if (!v) return '#3b82f6';
  if (v.startsWith('#')) return v.length === 7 ? v : '#3b82f6';
  return '#3b82f6';
}

const emptyForm: Omit<EscDepartment, 'id'> = {
  name: '', color: '#3b82f6', icon: 'Circle', description: '', active: true, publicBookable: false,
  defaultDurationMinutes: 60, defaultEmailTemplate: '', responsibleEmployeeIds: [], internalVisible: true, externallyBookable: false,
  sortOrder: 100,
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
              <div>
                <Label>Farbe</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    className="h-9 w-12 cursor-pointer rounded border bg-background p-1"
                    value={hslOrHexToHex(form.color)}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    aria-label="Farbe wählen"
                  />
                  <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} placeholder="#3b82f6" />
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Farbe ${c}`}
                      onClick={() => setForm({ ...form, color: c })}
                      className={`h-6 w-6 rounded-full border-2 transition ${form.color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
              <div>
                <Label>Icon</Label>
                <Input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="Wrench" />
                <div className="mt-2 grid grid-cols-8 gap-1.5 max-h-40 overflow-y-auto rounded border p-2">
                  {ICON_OPTIONS.map(({ name, Icon }) => (
                    <button
                      key={name}
                      type="button"
                      aria-label={name}
                      title={name}
                      onClick={() => setForm({ ...form, icon: name })}
                      className={`flex h-8 w-8 items-center justify-center rounded border transition hover:bg-accent ${form.icon === name ? 'border-primary bg-accent' : 'border-transparent'}`}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  ))}
                </div>
              </div>
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

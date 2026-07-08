import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useEmployees } from '@/hooks/esc/useEmployees';
import { useDepartments } from '@/hooks/esc/useDepartments';
import { DepartmentBadge } from '@/components/esc/DepartmentBadge';
import { toast } from 'sonner';

export default function EscEmployees() {
  const { employees, upsertEmployee, deleteEmployee } = useEmployees();
  const { departments } = useDepartments();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ id: '' as string | undefined, name: '', email: '', phone: '', role: '', location: '', active: true, publicBookable: false, departmentIds: [] as string[] });

  const openNew = () => { setForm({ id: undefined, name: '', email: '', phone: '', role: '', location: '', active: true, publicBookable: false, departmentIds: [] }); setOpen(true); };
  const openEdit = (e: any) => { setForm({ id: e.id, name: e.name, email: e.email, phone: e.phone || '', role: e.role, location: e.location || '', active: e.active, publicBookable: e.publicBookable, departmentIds: e.departmentIds }); setOpen(true); };

  const toggleDept = (id: string) => {
    setForm((f) => ({ ...f, departmentIds: f.departmentIds.includes(id) ? f.departmentIds.filter((x) => x !== id) : [...f.departmentIds, id] }));
  };

  const submit = async () => {
    if (!form.name || !form.email) { toast.error('Name und E-Mail sind Pflicht'); return; }
    await upsertEmployee(form as any);
    toast.success('Mitarbeiter gespeichert');
    setOpen(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Mitarbeiter</h1>
        <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Neuer Mitarbeiter</Button>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Rolle</TableHead>
              <TableHead>Abteilungen</TableHead>
              <TableHead>Standort</TableHead>
              <TableHead>Öff. buchbar</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.map((e) => (
              <TableRow key={e.id}>
                <TableCell>
                  <div className="text-[13px] font-medium">{e.name}</div>
                  <div className="text-[11px] text-muted-foreground">{e.email}</div>
                </TableCell>
                <TableCell className="text-[12px]">{e.role}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {e.departmentIds.map((did) => {
                      const d = departments.find((x) => x.id === did);
                      return d ? <DepartmentBadge key={did} dept={d} /> : null;
                    })}
                  </div>
                </TableCell>
                <TableCell className="text-[12px]">{e.location || '—'}</TableCell>
                <TableCell className="text-[12px]">{e.publicBookable ? 'Ja' : 'Nein'}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(e)}><Edit className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={async () => { await deleteEmployee(e.id); toast.success('Gelöscht'); }}><Trash2 className="w-4 h-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form.id ? 'Mitarbeiter bearbeiten' : 'Neuer Mitarbeiter'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-2">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>E-Mail</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Telefon</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>Rolle</Label><Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} /></div>
            <div><Label>Standort</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
            <div className="flex items-end gap-4">
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: !!v })} />Aktiv</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.publicBookable} onCheckedChange={(v) => setForm({ ...form, publicBookable: !!v })} />Öffentlich buchbar</label>
            </div>
            <div className="md:col-span-2">
              <Label>Abteilungen</Label>
              <div className="flex flex-wrap gap-2 pt-1">
                {departments.map((d) => (
                  <label key={d.id} className="flex items-center gap-1.5 text-[12px] border rounded px-2 py-1 cursor-pointer">
                    <Checkbox checked={form.departmentIds.includes(d.id)} onCheckedChange={() => toggleDept(d.id)} />
                    {d.name}
                  </label>
                ))}
              </div>
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

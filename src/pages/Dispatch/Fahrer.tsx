import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Users, Plus, Pencil } from 'lucide-react';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';

const emptyForm = { full_name: '', department: '', mobile: '', email: '', license_classes: '', cost_per_hour: '', cost_per_km: '' };
const num = (v: string) => (v === '' ? null : Number(v));

export default function DispatchFahrer() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const { data, isPending } = useQuery({
    queryKey: ['dispatch', 'drivers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('drivers').select('*').order('full_name');
      if (error) throw error;
      return data ?? [];
    },
  });

  const openNew = () => { setEditId(null); setForm({ ...emptyForm }); setOpen(true); };
  const openEdit = (d: any) => {
    setEditId(d.id);
    setForm({
      full_name: d.full_name ?? '', department: d.department ?? '', mobile: d.mobile ?? '',
      email: d.email ?? '', license_classes: (d.license_classes ?? []).join(', '),
      cost_per_hour: d.cost_per_hour?.toString() ?? '', cost_per_km: d.cost_per_km?.toString() ?? '',
    });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {
        full_name: form.full_name.trim(),
        department: form.department.trim() || null,
        mobile: form.mobile.trim() || null,
        email: form.email.trim() || null,
        license_classes: form.license_classes ? form.license_classes.split(',').map(s => s.trim()).filter(Boolean) : null,
        cost_per_hour: num(form.cost_per_hour),
        cost_per_km: num(form.cost_per_km),
      };
      const { error } = editId
        ? await supabase.from('drivers').update(payload).eq('id', editId)
        : await supabase.from('drivers').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(editId ? 'Fahrer aktualisiert' : 'Fahrer angelegt');
      setOpen(false); setEditId(null); setForm({ ...emptyForm });
      qc.invalidateQueries({ queryKey: ['dispatch', 'drivers'] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Fehler beim Speichern'),
  });

  return (
    <div className="p-6 lg:p-8 animate-fade-in space-y-4">
      <PageHeader
        title="Fahrer"
        subtitle="Fahrerstammdaten, Führerscheinklassen, Qualifikationen und Kostensätze"
        icon={Users}
        actions={<Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Fahrer</Button>}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? 'Fahrer bearbeiten' : 'Neuer Fahrer'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name *</Label><Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></div>
            <div><Label>Abteilung</Label><Input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Mobil</Label><Input value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })} /></div>
              <div><Label>E-Mail</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            </div>
            <div><Label>Führerscheinklassen</Label><Input placeholder="B, BE, C1" value={form.license_classes} onChange={e => setForm({ ...form, license_classes: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Stundensatz (€)</Label><Input type="number" step="0.01" value={form.cost_per_hour} onChange={e => setForm({ ...form, cost_per_hour: e.target.value })} /></div>
              <div><Label>Kilometerpauschale (€)</Label><Input type="number" step="0.01" value={form.cost_per_km} onChange={e => setForm({ ...form, cost_per_km: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button disabled={!form.full_name.trim() || save.isPending} onClick={() => save.mutate()}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Abteilung</TableHead>
              <TableHead>Mobil</TableHead>
              <TableHead>E-Mail</TableHead>
              <TableHead>Klassen</TableHead>
              <TableHead className="text-right">€/Std</TableHead>
              <TableHead className="text-right">€/km</TableHead>
              <TableHead>Aktiv</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Lädt…</TableCell></TableRow>}
            {!isPending && (data ?? []).length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Noch keine Fahrer erfasst.</TableCell></TableRow>}
            {(data ?? []).map((d: any) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.full_name}</TableCell>
                <TableCell>{d.department ?? '—'}</TableCell>
                <TableCell>{d.mobile ?? '—'}</TableCell>
                <TableCell>{d.email ?? '—'}</TableCell>
                <TableCell>{(d.license_classes ?? []).join(', ') || '—'}</TableCell>
                <TableCell className="text-right">{d.cost_per_hour != null ? `${Number(d.cost_per_hour).toFixed(2)} €` : '—'}</TableCell>
                <TableCell className="text-right">{d.cost_per_km != null ? `${Number(d.cost_per_km).toFixed(2)} €` : '—'}</TableCell>
                <TableCell>{d.active ? 'Ja' : 'Nein'}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(d)}><Pencil className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

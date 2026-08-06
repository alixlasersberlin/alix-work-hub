import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Users, Plus } from 'lucide-react';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';

export default function DispatchFahrer() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: '', department: '', mobile: '', email: '', license_classes: '' });

  const { data, isPending } = useQuery({
    queryKey: ['dispatch', 'drivers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('drivers').select('*').order('full_name');
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('drivers').insert({
        full_name: form.full_name.trim(),
        department: form.department.trim() || null,
        mobile: form.mobile.trim() || null,
        email: form.email.trim() || null,
        license_classes: form.license_classes ? form.license_classes.split(',').map(s => s.trim()).filter(Boolean) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Fahrer angelegt');
      setOpen(false);
      setForm({ full_name: '', department: '', mobile: '', email: '', license_classes: '' });
      qc.invalidateQueries({ queryKey: ['dispatch', 'drivers'] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Fehler beim Anlegen'),
  });

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <PageHeader
        title="Fahrer"
        subtitle="Fahrerstammdaten, Führerscheinklassen und Qualifikationen"
        icon={Users}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Fahrer</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Neuer Fahrer</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Name *</Label><Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></div>
                <div><Label>Abteilung</Label><Input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Mobil</Label><Input value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })} /></div>
                  <div><Label>E-Mail</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
                </div>
                <div><Label>Führerscheinklassen</Label><Input placeholder="B, BE, C1" value={form.license_classes} onChange={e => setForm({ ...form, license_classes: e.target.value })} /></div>
              </div>
              <DialogFooter>
                <Button disabled={!form.full_name.trim() || create.isPending} onClick={() => create.mutate()}>Speichern</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Abteilung</TableHead>
              <TableHead>Mobil</TableHead>
              <TableHead>E-Mail</TableHead>
              <TableHead>Klassen</TableHead>
              <TableHead>Aktiv</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Lädt…</TableCell></TableRow>}
            {!isPending && (data ?? []).length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Noch keine Fahrer erfasst.</TableCell></TableRow>}
            {(data ?? []).map((d: any) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.full_name}</TableCell>
                <TableCell>{d.department ?? '—'}</TableCell>
                <TableCell>{d.mobile ?? '—'}</TableCell>
                <TableCell>{d.email ?? '—'}</TableCell>
                <TableCell>{(d.license_classes ?? []).join(', ') || '—'}</TableCell>
                <TableCell>{d.active ? 'Ja' : 'Nein'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, X } from 'lucide-react';
import { useResources } from '@/hooks/esc/useResources';
import { toast } from 'sonner';
import type { EscResource } from '@/lib/esc/types';

export default function EscResources() {
  const { resources, upsertResource, deleteResource } = useResources();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ id?: string; name: string; type: EscResource['type']; location: string; capacity?: number; active: boolean }>({
    name: '', type: 'room', location: '', active: true,
  });

  const openNew = () => { setForm({ name: '', type: 'room', location: '', active: true }); setOpen(true); };
  const openEdit = (r: EscResource) => { setForm({ id: r.id, name: r.name, type: r.type, location: r.location || '', capacity: r.capacity, active: r.active }); setOpen(true); };

  const submit = async () => {
    if (!form.name) { toast.error('Bitte Name angeben'); return; }
    await upsertResource(form as any);
    toast.success('Ressource gespeichert');
    setOpen(false);
  };

  return (
    <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Ressourcen</h1>
          <Button size="sm" type="button" onClick={openNew}>
            <Plus className="w-4 h-4 mr-1" /> Neue Ressource
          </Button>
        </div>
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Standort</TableHead>
                <TableHead>Kapazität</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resources.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                    Noch keine Ressourcen angelegt.
                  </TableCell>
                </TableRow>
              ) : resources.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-[13px] font-medium">{r.name}</TableCell>
                  <TableCell className="text-[12px]">{r.type}</TableCell>
                  <TableCell className="text-[12px]">{r.location || '—'}</TableCell>
                  <TableCell className="text-[12px]">{r.capacity ?? '—'}</TableCell>
                  <TableCell className="text-[12px]">{r.active ? 'Aktiv' : 'Inaktiv'}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Edit className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={async () => { await deleteResource(r.id); toast.success('Gelöscht'); }}><Trash2 className="w-4 h-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {open && (
          <div className="fixed inset-0 z-[2147483645] flex items-center justify-center overflow-y-auto bg-background/85 p-4 backdrop-blur-sm sm:p-6" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
            <div className="relative my-auto grid w-[calc(100dvw-2rem)] max-w-lg max-h-[calc(100dvh-2rem)] gap-4 overflow-y-auto rounded-lg border bg-background p-6 shadow-lg" role="dialog" aria-modal="true" aria-labelledby="resource-dialog-title" aria-describedby="resource-dialog-description">
              <button type="button" className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
                <span className="sr-only">Schließen</span>
              </button>
              <div className="flex flex-col space-y-1.5 text-center sm:text-left">
                <h2 id="resource-dialog-title" className="text-lg font-semibold leading-none tracking-tight">{form.id ? 'Ressource bearbeiten' : 'Neue Ressource'}</h2>
                <p id="resource-dialog-description" className="text-sm text-muted-foreground">Ressource für Räume, Geräte, Fahrzeuge oder sonstige Planungseinheiten anlegen.</p>
              </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-2">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div>
              <Label>Typ</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as EscResource['type'] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="room">Raum</SelectItem>
                  <SelectItem value="device">Gerät</SelectItem>
                  <SelectItem value="vehicle">Fahrzeug</SelectItem>
                  <SelectItem value="other">Sonstiges</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Standort</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
            <div><Label>Kapazität</Label><Input type="number" value={form.capacity ?? ''} onChange={(e) => setForm({ ...form, capacity: e.target.value ? Number(e.target.value) : undefined })} /></div>
            <div className="md:col-span-2"><label className="flex items-center gap-2 text-sm"><Checkbox checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: !!v })} />Aktiv</label></div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={submit}>Speichern</Button>
          </div>
            </div>
          </div>
        )}
      </div>
  );
}

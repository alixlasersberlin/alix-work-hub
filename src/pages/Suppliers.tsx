import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Loader2, Pencil, Trash2, ArrowLeft, Users } from 'lucide-react';
import { toast } from 'sonner';
import { PageSizeSelector, usePagination, PaginationControls } from '@/components/PageSizeSelector';

interface Supplier {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string;
  email_secondary: string | null;
  notes: string | null;
}

export default function Suppliers() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState({ name: '', address: '', phone: '', email: '', email_secondary: '', notes: '' });
  const { pageSize, setPageSize, page, setPage, totalPages, paged, total } = usePagination(rows, 20);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('suppliers').select('*').order('name');
    if (error) toast.error(error.message);
    else setRows(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', address: '', phone: '', email: '', email_secondary: '', notes: '' });
    setOpen(true);
  };

  const openEdit = (s: Supplier) => {
    setEditing(s);
    setForm({
      name: s.name,
      address: s.address || '',
      phone: s.phone || '',
      email: s.email,
      email_secondary: s.email_secondary || '',
      notes: s.notes || '',
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      return toast.error('Name und E-Mail sind Pflicht');
    }
    const payload = {
      name: form.name.trim(),
      address: form.address.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim(),
      email_secondary: form.email_secondary.trim() || null,
      notes: form.notes.trim() || null,
    };
    const res = editing
      ? await supabase.from('suppliers').update(payload).eq('id', editing.id)
      : await supabase.from('suppliers').insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success(editing ? 'Zulieferer aktualisiert' : 'Zulieferer angelegt');
    setOpen(false);
    load();
  };

  const remove = async (s: Supplier) => {
    if (!confirm(`Zulieferer "${s.name}" löschen?`)) return;
    const { error } = await supabase.from('suppliers').delete().eq('id', s.id);
    if (error) return toast.error(error.message);
    toast.success('Gelöscht');
    load();
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/order')} className="mb-2">
            <ArrowLeft className="w-4 h-4 mr-1" /> Zurück
          </Button>
          <h1 className="text-2xl font-display font-bold gold-text flex items-center gap-2">
            <Users className="w-6 h-6" /> Zulieferer
          </h1>
        </div>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" /> Zulieferer anlegen</Button>
      </div>

      <div className="flex justify-end">
        <PageSizeSelector value={pageSize} onChange={setPageSize} />
      </div>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">Noch keine Zulieferer angelegt.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr className="text-left">
                <th className="p-3">Name</th>
                <th className="p-3">E-Mail</th>
                <th className="p-3">Telefon</th>
                <th className="p-3">Anschrift</th>
                <th className="p-3 text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {paged.map(s => (
                <tr key={s.id} className="border-b border-border hover:bg-muted/30">
                  <td className="p-3 font-medium">{s.name}</td>
                  <td className="p-3">{s.email}</td>
                  <td className="p-3">{s.phone || '—'}</td>
                  <td className="p-3 text-muted-foreground text-xs whitespace-pre-line">{s.address || '—'}</td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(s)}><Pencil className="w-4 h-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(s)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} total={total} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Zulieferer bearbeiten' : 'Neuer Zulieferer'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>E-Mail *</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Zweite E-Mail (optional)</Label><Input type="email" value={form.email_secondary} onChange={e => setForm({ ...form, email_secondary: e.target.value })} placeholder="Versand erfolgt parallel an beide Adressen" /></div>
            <div><Label>Telefon</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>Anschrift</Label><Textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} rows={3} /></div>
            <div><Label>Notizen</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={save}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

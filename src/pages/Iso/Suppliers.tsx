import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/StatusBadge';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Section } from './_shared';

type Eval = {
  id: string;
  supplier_name: string;
  evaluation_year: number;
  quality_score: number | null;
  delivery_score: number | null;
  service_score: number | null;
  overall_score: number | null;
  classification: string | null;
  remarks: string | null;
  evaluated_at: string;
};

const CLASSES = ['A', 'B', 'C', 'gesperrt'];

export default function IsoSuppliers() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Eval[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    supplier_name: '', evaluation_year: String(new Date().getFullYear()),
    quality_score: '', delivery_score: '', service_score: '',
    classification: 'A', remarks: '',
  });

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase as any).from('iso_supplier_evaluations')
      .select('*').order('evaluation_year', { ascending: false }).order('supplier_name').limit(500);
    if (error) toast.error('Laden fehlgeschlagen: ' + error.message);
    setRows((data ?? []) as Eval[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!form.supplier_name.trim()) { toast.error('Lieferant erforderlich'); return; }
    const q = Number(form.quality_score) || 0;
    const d = Number(form.delivery_score) || 0;
    const s = Number(form.service_score) || 0;
    const overall = (q + d + s) / 3;
    const { error } = await (supabase as any).from('iso_supplier_evaluations').insert({
      supplier_name: form.supplier_name.trim(),
      evaluation_year: Number(form.evaluation_year),
      quality_score: q,
      delivery_score: d,
      service_score: s,
      overall_score: overall,
      classification: form.classification,
      remarks: form.remarks || null,
      evaluated_by: user?.id,
    });
    if (error) { toast.error('Anlegen fehlgeschlagen: ' + error.message); return; }
    toast.success('Bewertung gespeichert');
    setOpen(false);
    setForm({ supplier_name: '', evaluation_year: String(new Date().getFullYear()), quality_score: '', delivery_score: '', service_score: '', classification: 'A', remarks: '' });
    load();
  }

  return (
    <Section
      title={`Lieferantenbewertungen (${rows.length})`}
      action={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Neue Bewertung</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Lieferantenbewertung</DialogTitle></DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Lieferant *</Label><Input value={form.supplier_name} onChange={e => setForm({ ...form, supplier_name: e.target.value })} /></div>
                <div><Label>Jahr</Label><Input type="number" value={form.evaluation_year} onChange={e => setForm({ ...form, evaluation_year: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Qualität (0-100)</Label><Input type="number" value={form.quality_score} onChange={e => setForm({ ...form, quality_score: e.target.value })} /></div>
                <div><Label>Lieferung (0-100)</Label><Input type="number" value={form.delivery_score} onChange={e => setForm({ ...form, delivery_score: e.target.value })} /></div>
                <div><Label>Service (0-100)</Label><Input type="number" value={form.service_score} onChange={e => setForm({ ...form, service_score: e.target.value })} /></div>
              </div>
              <div>
                <Label>Klassifikation</Label>
                <Select value={form.classification} onValueChange={v => setForm({ ...form, classification: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CLASSES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Bemerkungen</Label><Textarea rows={3} value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Abbrechen</Button>
              <Button onClick={create}>Speichern</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lieferant</TableHead>
              <TableHead>Jahr</TableHead>
              <TableHead>Qualität</TableHead>
              <TableHead>Lieferung</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Gesamt</TableHead>
              <TableHead>Klasse</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Lade …</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Keine Bewertungen.</TableCell></TableRow>
            ) : rows.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.supplier_name}</TableCell>
                <TableCell>{r.evaluation_year}</TableCell>
                <TableCell>{r.quality_score ?? '—'}</TableCell>
                <TableCell>{r.delivery_score ?? '—'}</TableCell>
                <TableCell>{r.service_score ?? '—'}</TableCell>
                <TableCell className="font-semibold">{r.overall_score ? Number(r.overall_score).toFixed(1) : '—'}</TableCell>
                <TableCell>{r.classification ? <StatusBadge status={r.classification} /> : '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Section>
  );
}

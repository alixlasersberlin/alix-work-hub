import { useEffect, useState } from 'react';
import { Landmark, Plus, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useFinancePermissions } from '@/hooks/useFinancePermissions';

const fmt = (n: number) => (n || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

export default function Bankbuchungen() {
  const { canWrite } = useFinancePermissions();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const empty = { posting_type: 'eingang', amount: 0, counterparty: '', iban: '', purpose: '', reference: '' };
  const [form, setForm] = useState(empty);

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase as any).from('finance_bank_postings').select('*').order('posting_date', { ascending: false }).limit(500);
    if (error) toast.error(error.message); else setRows(data || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    const { error } = await (supabase as any).from('finance_bank_postings').insert({
      ...form,
      user_id: (await supabase.auth.getUser()).data.user?.id,
    });
    if (error) toast.error(error.message); else { toast.success('Buchung gespeichert'); setOpen(false); setForm(empty); load(); }
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <PageHeader icon={Landmark} title="Bankbuchungen" subtitle="Manuelle Erfassung von Bankbewegungen"
        actions={<div className="flex gap-2">
          <Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" /></Button>
          {canWrite && <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />Neu</Button>}
        </div>} />

      <Card>
        <CardHeader><CardTitle>Buchungen ({rows.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead><TableHead>Typ</TableHead><TableHead>Gegenpartei</TableHead>
                <TableHead>Verwendungszweck</TableHead><TableHead className="text-right">Betrag</TableHead>
                <TableHead>Referenz</TableHead><TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? <TableRow><TableCell colSpan={7}>Lädt…</TableCell></TableRow>
                : rows.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Keine Bankbuchungen</TableCell></TableRow>
                : rows.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>{r.posting_date}</TableCell>
                    <TableCell><Badge variant="outline">{r.posting_type}</Badge></TableCell>
                    <TableCell>{r.counterparty}</TableCell>
                    <TableCell className="max-w-xs truncate">{r.purpose}</TableCell>
                    <TableCell className="text-right font-semibold">{fmt(r.amount)}</TableCell>
                    <TableCell className="font-mono text-xs">{r.reference}</TableCell>
                    <TableCell><Badge variant={r.status === 'aktiv' ? 'outline' : 'destructive'}>{r.status}</Badge></TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Neue Bankbuchung</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Typ</Label>
              <Select value={form.posting_type} onValueChange={v => setForm({ ...form, posting_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['eingang','ausgang','lastschrift','ruecklastschrift','erstattung'].map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Betrag (€)</Label><Input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} /></div>
            <div className="col-span-2"><Label>Gegenpartei</Label><Input value={form.counterparty} onChange={e => setForm({ ...form, counterparty: e.target.value })} /></div>
            <div><Label>IBAN</Label><Input value={form.iban} onChange={e => setForm({ ...form, iban: e.target.value })} /></div>
            <div><Label>Referenz</Label><Input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} /></div>
            <div className="col-span-2"><Label>Verwendungszweck</Label><Textarea value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })} /></div>
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

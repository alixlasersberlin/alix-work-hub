import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PackageX, Plus, Loader2, Search, FileDown, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { downloadReturnNotePdf } from '@/lib/dispatch/return-note-pdf';

const TYPES: Record<string, string> = {
  rueckholung: 'Rückholung',
  geraetetausch: 'Gerätetausch',
  werkstatt: 'Werkstatt',
  ersatzgeraet_rueck: 'Ersatzgerät zurück',
};
const STATUSES: Record<string, string> = {
  offen: 'Offen',
  eingeplant: 'Eingeplant',
  abgeholt: 'Abgeholt',
  eingegangen: 'Wareneingang',
  werkstatt: 'In Werkstatt',
  abgeschlossen: 'Abgeschlossen',
};
const statusVariant = (s: string) => (s === 'abgeschlossen' ? 'default' : s === 'offen' ? 'destructive' : 'secondary');

const EMPTY = {
  return_type: 'rueckholung',
  status: 'offen',
  order_number: '',
  customer_name: '',
  company_name: '',
  device_name: '',
  serial_number: '',
  replacement_device: '',
  replacement_serial: '',
  condition: '',
  accessories: '',
  reason: '',
  target_location: '',
  pickup_date: '',
  notes: '',
};

export default function DispatchRetouren() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('alle');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [mailRow, setMailRow] = useState<any>(null);
  const [mailTo, setMailTo] = useState('');


  const { data: rows, isPending } = useQuery({
    queryKey: ['dispatch', 'returns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_returns')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    let list = rows ?? [];
    if (statusFilter !== 'alle') list = list.filter((r: any) => r.status === statusFilter);
    if (!s) return list;
    return list.filter((r: any) =>
      [r.return_number, r.order_number, r.customer_name, r.company_name, r.device_name, r.serial_number]
        .some(v => String(v ?? '').toLowerCase().includes(s)));
  }, [rows, search, statusFilter]);


  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const payload: any = { ...form, created_by: u.user?.id ?? null };
      if (!payload.pickup_date) payload.pickup_date = null;
      const { error } = await supabase.from('delivery_returns').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Retoure angelegt');
      setOpen(false);
      setForm({ ...EMPTY });
      qc.invalidateQueries({ queryKey: ['dispatch', 'returns'] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Anlegen fehlgeschlagen'),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const patch: any = { status };
      if (status === 'eingegangen') patch.received_at = new Date().toISOString();
      const { error } = await supabase.from('delivery_returns').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dispatch', 'returns'] }),
    onError: (e: any) => toast.error(e.message ?? 'Aktualisierung fehlgeschlagen'),
  });

  const sendMail = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('return-note-send', {
        body: { return_id: mailRow?.id, email: mailTo.trim() },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
    },
    onSuccess: () => {
      toast.success('Abholavis versendet');
      setMailRow(null);
      setMailTo('');
    },
    onError: (e: any) => toast.error(e.message ?? 'Versand fehlgeschlagen'),
  });

  const f = (k: keyof typeof EMPTY) => ({

    value: (form as any)[k],
    onChange: (e: any) => setForm({ ...form, [k]: e.target.value }),
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Retouren & Gerätetausch"
        subtitle="Rückholungen, Tauschgeräte und Werkstattübergaben verwalten"
        icon={PackageX}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Neue Retoure</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Neue Retoure anlegen</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Art</Label>
                  <Select value={form.return_type} onValueChange={v => setForm({ ...form, return_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(TYPES).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Auftragsnummer</Label><Input {...f('order_number')} /></div>
                <div><Label>Kunde</Label><Input {...f('customer_name')} /></div>
                <div><Label>Firma</Label><Input {...f('company_name')} /></div>
                <div><Label>Gerät</Label><Input {...f('device_name')} /></div>
                <div><Label>Seriennummer</Label><Input {...f('serial_number')} /></div>
                <div><Label>Tauschgerät</Label><Input {...f('replacement_device')} /></div>
                <div><Label>Serie Tauschgerät</Label><Input {...f('replacement_serial')} /></div>
                <div><Label>Zustand</Label><Input {...f('condition')} /></div>
                <div><Label>Zubehör</Label><Input {...f('accessories')} /></div>
                <div><Label>Ziel (Lager/Werkstatt)</Label><Input {...f('target_location')} /></div>
                <div><Label>Abholdatum</Label><Input type="date" {...f('pickup_date')} /></div>
                <div className="col-span-2"><Label>Grund</Label><Textarea rows={2} {...f('reason')} /></div>
                <div className="col-span-2"><Label>Notiz</Label><Textarea rows={2} {...f('notes')} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
                <Button onClick={() => create.mutate()} disabled={create.isPending}>
                  {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Anlegen
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-3 md:grid-cols-4">
        {[
          { label: 'Offen', value: (rows ?? []).filter((r: any) => r.status === 'offen').length },
          { label: 'Eingeplant / unterwegs', value: (rows ?? []).filter((r: any) => ['eingeplant', 'abgeholt'].includes(r.status)).length },
          { label: 'In Werkstatt', value: (rows ?? []).filter((r: any) => r.status === 'werkstatt').length },
          { label: 'Abgeschlossen', value: (rows ?? []).filter((r: any) => r.status === 'abgeschlossen').length },
        ].map(k => (
          <Card key={k.label} className="p-4">
            <div className="text-xs text-muted-foreground">{k.label}</div>
            <div className="text-2xl font-semibold">{k.value}</div>
          </Card>
        ))}
      </div>

      <Card className="p-3 flex flex-wrap items-center gap-2">

        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Nummer, Auftrag, Kunde, Serie …" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle Status</SelectItem>
            {Object.entries(STATUSES).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nummer</TableHead>
              <TableHead>Art</TableHead>
              <TableHead>Kunde</TableHead>
              <TableHead>Gerät / Serie</TableHead>
              <TableHead>Ziel</TableHead>
              <TableHead>Abholung</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-44">Aktion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending && <TableRow><TableCell colSpan={8} className="text-center py-8"><Loader2 className="h-4 w-4 animate-spin mx-auto" /></TableCell></TableRow>}
            {!isPending && filtered.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Keine Retouren vorhanden</TableCell></TableRow>
            )}
            {filtered.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.return_number}</TableCell>
                <TableCell>{TYPES[r.return_type] ?? r.return_type}</TableCell>
                <TableCell>{r.company_name || r.customer_name || '—'}<div className="text-xs text-muted-foreground">{r.order_number}</div></TableCell>
                <TableCell>{[r.device_name, r.serial_number].filter(Boolean).join(' / ') || '—'}</TableCell>
                <TableCell>{r.target_location || '—'}</TableCell>
                <TableCell>{r.pickup_date ? format(new Date(r.pickup_date), 'dd.MM.yyyy') : '—'}</TableCell>
                <TableCell><Badge variant={statusVariant(r.status) as any}>{STATUSES[r.status] ?? r.status}</Badge></TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Select value={r.status} onValueChange={v => setStatus.mutate({ id: r.id, status: v })}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(STATUSES).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button size="icon" variant="outline" className="h-8 w-8 shrink-0" title="Retourenschein (PDF)"
                      onClick={() => { downloadReturnNotePdf(r); toast.success('Retourenschein erstellt'); }}>
                      <FileDown className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="outline" className="h-8 w-8 shrink-0" title="Abholavis per E-Mail"
                      onClick={() => { setMailRow(r); setMailTo(''); }}>
                      <Mail className="h-4 w-4" />
                    </Button>
                  </div>

                </TableCell>

              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!mailRow} onOpenChange={o => !o && setMailRow(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Abholavis senden – {mailRow?.return_number}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>E-Mail des Kunden</Label>
            <Input type="email" placeholder="kunde@example.com" value={mailTo} onChange={e => setMailTo(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              Enthält Retouren-Nr., Gerät, Seriennummer und Abholdatum. Eine Kopie geht per BCC ins Archiv.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMailRow(null)}>Abbrechen</Button>
            <Button onClick={() => sendMail.mutate()} disabled={sendMail.isPending || !mailTo.trim()}>
              {sendMail.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Senden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

  );
}

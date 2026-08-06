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
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Truck, Plus, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const ASSIGN_STATUS: Record<string, string> = {
  angefragt: 'Angefragt',
  beauftragt: 'Beauftragt',
  bestaetigt: 'Bestätigt',
  unterwegs: 'Unterwegs',
  zugestellt: 'Zugestellt',
  abgerechnet: 'Abgerechnet',
  storniert: 'Storniert',
};

const EMPTY_CARRIER = {
  name: '', contact_name: '', email: '', phone: '', street: '', zip: '', city: '', country: 'DE',
  vat_id: '', base_price: '', price_per_km: '', notes: '', is_active: true,
};

export default function DispatchSpediteure() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_CARRIER });

  const { data: carriers, isPending } = useQuery({
    queryKey: ['dispatch', 'carriers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('delivery_carriers').select('*').order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: assignments } = useQuery({
    queryKey: ['dispatch', 'carrier-assignments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_carrier_assignments')
        .select('*, delivery_carriers(name)')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return carriers ?? [];
    return (carriers ?? []).filter((c: any) => [c.name, c.city, c.email, c.contact_name].some(v => String(v ?? '').toLowerCase().includes(s)));
  }, [carriers, search]);

  const create = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error('Name ist erforderlich');
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from('delivery_carriers').insert({
        ...form,
        base_price: form.base_price ? Number(form.base_price) : null,
        price_per_km: form.price_per_km ? Number(form.price_per_km) : null,
        created_by: u.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Spediteur angelegt');
      setOpen(false);
      setForm({ ...EMPTY_CARRIER });
      qc.invalidateQueries({ queryKey: ['dispatch', 'carriers'] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Anlegen fehlgeschlagen'),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from('delivery_carriers').update({ is_active: active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dispatch', 'carriers'] }),
    onError: (e: any) => toast.error(e.message ?? 'Aktualisierung fehlgeschlagen'),
  });

  const setAssignStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('delivery_carrier_assignments').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dispatch', 'carrier-assignments'] }),
    onError: (e: any) => toast.error(e.message ?? 'Aktualisierung fehlgeschlagen'),
  });

  const f = (k: keyof typeof EMPTY_CARRIER) => ({
    value: (form as any)[k] as string,
    onChange: (e: any) => setForm({ ...form, [k]: e.target.value }),
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Externe Spediteure"
        subtitle="Fremdfahrer und Speditionen, Auftragsvergabe und Leistungsnachweis"
        icon={Truck}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Spediteur</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Spediteur anlegen</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Label>Name *</Label><Input {...f('name')} /></div>
                <div><Label>Ansprechpartner</Label><Input {...f('contact_name')} /></div>
                <div><Label>E-Mail</Label><Input type="email" {...f('email')} /></div>
                <div><Label>Telefon</Label><Input {...f('phone')} /></div>
                <div><Label>USt-IdNr.</Label><Input {...f('vat_id')} /></div>
                <div className="col-span-2"><Label>Straße</Label><Input {...f('street')} /></div>
                <div><Label>PLZ</Label><Input {...f('zip')} /></div>
                <div><Label>Ort</Label><Input {...f('city')} /></div>
                <div><Label>Land</Label><Input {...f('country')} /></div>
                <div><Label>Grundpreis (€)</Label><Input type="number" step="0.01" {...f('base_price')} /></div>
                <div><Label>Preis je km (€)</Label><Input type="number" step="0.01" {...f('price_per_km')} /></div>
                <div className="col-span-2"><Label>Notiz</Label><Textarea rows={2} {...f('notes')} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
                <Button onClick={() => create.mutate()} disabled={create.isPending}>
                  {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Speichern
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Tabs defaultValue="carriers">
        <TabsList>
          <TabsTrigger value="carriers">Spediteure</TabsTrigger>
          <TabsTrigger value="assignments">Vergebene Aufträge</TabsTrigger>
        </TabsList>

        <TabsContent value="carriers" className="space-y-3">
          <Card className="p-3">
            <div className="relative max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Suchen …" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </Card>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Kontakt</TableHead>
                  <TableHead>Ort</TableHead>
                  <TableHead>Grundpreis</TableHead>
                  <TableHead>je km</TableHead>
                  <TableHead>Aktiv</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isPending && <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-4 w-4 animate-spin mx-auto" /></TableCell></TableRow>}
                {!isPending && filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Keine Spediteure erfasst</TableCell></TableRow>}
                {filtered.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.contact_name || '—'}<div className="text-xs text-muted-foreground">{c.email || c.phone}</div></TableCell>
                    <TableCell>{[c.zip, c.city].filter(Boolean).join(' ') || '—'}</TableCell>
                    <TableCell>{c.base_price != null ? `${Number(c.base_price).toFixed(2)} €` : '—'}</TableCell>
                    <TableCell>{c.price_per_km != null ? `${Number(c.price_per_km).toFixed(2)} €` : '—'}</TableCell>
                    <TableCell><Switch checked={!!c.is_active} onCheckedChange={v => toggleActive.mutate({ id: c.id, active: v })} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="assignments">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nummer</TableHead>
                  <TableHead>Spediteur</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>Preis</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-44">Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(assignments ?? []).length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Noch keine Vergaben</TableCell></TableRow>}
                {(assignments ?? []).map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-xs">{a.assignment_number}</TableCell>
                    <TableCell>{a.delivery_carriers?.name ?? '—'}</TableCell>
                    <TableCell>{a.service_date ? format(new Date(a.service_date), 'dd.MM.yyyy') : '—'}</TableCell>
                    <TableCell>{a.agreed_price != null ? `${Number(a.agreed_price).toFixed(2)} €` : '—'}</TableCell>
                    <TableCell><Badge variant={a.status === 'zugestellt' || a.status === 'abgerechnet' ? 'default' : 'secondary'}>{ASSIGN_STATUS[a.status] ?? a.status}</Badge></TableCell>
                    <TableCell>
                      <Select value={a.status} onValueChange={v => setAssignStatus.mutate({ id: a.id, status: v })}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(ASSIGN_STATUS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

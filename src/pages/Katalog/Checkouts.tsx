import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ClipboardList, Truck } from 'lucide-react';

interface Checkout {
  id: string;
  inquiry_id: string | null;
  customer_id: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  customer_reference: string | null;
  desired_date: string | null;
  delivery_address: any;
  notes: string | null;
  status: string;
  created_at: string;
}

const STATUSES = ['submitted', 'in_review', 'accepted', 'rejected', 'converted'];

export default function KatalogCheckouts() {
  const c = supabase as any;
  const { toast } = useToast();
  const [rows, setRows] = useState<Checkout[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const load = async () => {
    let q = c.from('catalog_portal_checkouts').select('*').order('created_at', { ascending: false }).limit(200);
    if (statusFilter !== 'all') q = q.eq('status', statusFilter);
    const { data } = await q;
    setRows(data ?? []);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [statusFilter]);

  const setStatus = async (r: Checkout, s: string) => {
    const { error } = await c.from('catalog_portal_checkouts').update({ status: s }).eq('id', r.id);
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    setRows(prev => prev.map(x => x.id === r.id ? { ...x, status: s } : x));
  };

  const addrStr = (a: any) => {
    if (!a || typeof a !== 'object') return '—';
    return [a.street, a.zip, a.city, a.country].filter(Boolean).join(', ') || '—';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-semibold">Portal-Sammelanfragen (Checkouts)</h2>
        <Badge variant="outline" className="ml-2 text-xs">{rows.length}</Badge>
        <div className="ml-auto w-56">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Status</SelectItem>
              {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Truck className="h-4 w-4" />Eingegangene Checkouts</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Eingang</TableHead>
                <TableHead>Kontakt</TableHead>
                <TableHead>Referenz</TableHead>
                <TableHead>Wunschtermin</TableHead>
                <TableHead>Lieferadresse</TableHead>
                <TableHead>Notizen</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleString('de-DE')}</TableCell>
                  <TableCell>
                    <div className="font-medium">{r.contact_name ?? '—'}</div>
                    <div className="text-xs text-muted-foreground">{r.contact_email ?? '—'} {r.contact_phone ? `· ${r.contact_phone}` : ''}</div>
                  </TableCell>
                  <TableCell className="text-xs font-mono">{r.customer_reference ?? '—'}</TableCell>
                  <TableCell className="text-xs">{r.desired_date ?? '—'}</TableCell>
                  <TableCell className="text-xs max-w-[260px]">{addrStr(r.delivery_address)}</TableCell>
                  <TableCell className="text-xs max-w-[220px] whitespace-pre-wrap">{r.notes ?? '—'}</TableCell>
                  <TableCell>
                    <Select value={r.status} onValueChange={(v) => setStatus(r, v)}>
                      <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Keine Checkouts.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

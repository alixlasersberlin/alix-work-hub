import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2 } from 'lucide-react';

const MODES = [
  { v: 'uvp_minus_pct', l: 'UVP minus %' },
  { v: 'uvp_plus_pct', l: 'UVP plus %' },
  { v: 'uvp_factor', l: 'UVP × Faktor' },
  { v: 'fixed', l: 'Fester Wert' },
  { v: 'rounding', l: 'Nur Rundung' },
];

export default function KatalogPreisregeln() {
  const { toast } = useToast();
  const client = supabase as any;
  const [rows, setRows] = useState<any[]>([]);
  const [f, setF] = useState<any>({ code: '', name: '', mode: 'uvp_minus_pct', percent_value: 0, factor_value: 1, fixed_value: 0, rounding: 0.01 });

  const load = async () => {
    const { data, error } = await client.from('catalog_price_rules').select('*').order('code');
    if (error) return toast({ title: 'Zugriff verweigert', description: 'Nur Preis-Berechtigte sehen Regeln.', variant: 'destructive' });
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!f.code || !f.name) return toast({ title: 'Code und Name erforderlich' });
    const { error } = await client.from('catalog_price_rules').insert(f);
    if (error) return toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    setF({ code: '', name: '', mode: 'uvp_minus_pct', percent_value: 0, factor_value: 1, fixed_value: 0, rounding: 0.01 });
    load();
  };

  const del = async (id: string) => {
    if (!confirm('Regel löschen?')) return;
    const { error } = await client.from('catalog_price_rules').delete().eq('id', id);
    if (error) return toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    load();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Neue Preisregel (auf UVP-Basis)</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div><Label>Code</Label><Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></div>
          <div><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div>
            <Label>Modus</Label>
            <Select value={f.mode} onValueChange={(v) => setF({ ...f, mode: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{MODES.map((m) => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Prozent</Label><Input type="number" step="0.01" value={f.percent_value} onChange={(e) => setF({ ...f, percent_value: Number(e.target.value) })} /></div>
          <div><Label>Faktor</Label><Input type="number" step="0.0001" value={f.factor_value} onChange={(e) => setF({ ...f, factor_value: Number(e.target.value) })} /></div>
          <div className="flex items-end"><Button onClick={add}><Plus className="h-4 w-4 mr-1" />Anlegen</Button></div>
        </CardContent>
      </Card>
      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Modus</TableHead><TableHead>%</TableHead><TableHead>Faktor</TableHead><TableHead>Aktiv</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono">{r.code}</TableCell><TableCell>{r.name}</TableCell><TableCell>{r.mode}</TableCell>
                <TableCell>{r.percent_value ?? '—'}</TableCell><TableCell>{r.factor_value ?? '—'}</TableCell>
                <TableCell>{r.is_active ? '✓' : ''}</TableCell>
                <TableCell><Button variant="ghost" size="sm" onClick={() => del(r.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Keine Regeln definiert.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

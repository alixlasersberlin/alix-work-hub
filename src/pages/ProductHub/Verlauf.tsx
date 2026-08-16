import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { History } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { phLabel } from '@/lib/producthub/config';

const db = supabase as any;

export default function ProductHubVerlauf() {
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [onlyCritical, setOnlyCritical] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await db.from('ph_field_history').select('*, ph_products(name)')
        .order('created_at', { ascending: false }).limit(1000);
      setRows(data || []);
    })();
  }, []);

  const filtered = useMemo(() => rows.filter(h =>
    (!onlyCritical || h.is_critical) &&
    (!q || `${h.ph_products?.name} ${h.field_name} ${h.new_value}`.toLowerCase().includes(q.toLowerCase()))
  ), [rows, q, onlyCritical]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader title="Product Hub · Änderungsverlauf" subtitle="Vollständige, unlöschbare Historie aller Feldänderungen" icon={History} />
      <Card><CardContent className="p-3 flex gap-2 items-center">
        <Input className="max-w-xs" placeholder="Suche…" value={q} onChange={e => setQ(e.target.value)} />
        <Badge variant={onlyCritical ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setOnlyCritical(v => !v)}>nur kritische Felder</Badge>
      </CardContent></Card>
      <Card><CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Datum</TableHead><TableHead>Gerät</TableHead><TableHead>Feld</TableHead>
            <TableHead>Vorher</TableHead><TableHead>Nachher</TableHead><TableHead>Quelle</TableHead><TableHead>Kanal</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Keine Einträge.</TableCell></TableRow>}
            {filtered.map(h => (
              <TableRow key={h.id} className={h.is_critical ? 'bg-amber-500/5' : ''}>
                <TableCell className="text-xs whitespace-nowrap">{new Date(h.created_at).toLocaleString('de-DE')}</TableCell>
                <TableCell className="text-xs">{h.ph_products?.name || '—'}</TableCell>
                <TableCell className="text-xs">{phLabel(h.field_name)}{h.is_critical && ' ⚠'}</TableCell>
                <TableCell className="text-xs max-w-[200px] truncate">{h.old_value ?? '—'}</TableCell>
                <TableCell className="text-xs max-w-[200px] truncate">{h.new_value ?? '—'}</TableCell>
                <TableCell className="text-xs">{h.source}</TableCell>
                <TableCell className="text-xs">{h.channel_code || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}

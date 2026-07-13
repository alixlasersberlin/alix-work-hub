import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export default function KatalogProtokolle() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from('catalog_change_log')
        .select('*')
        .order('performed_at', { ascending: false })
        .limit(500);
      setRows(data ?? []);
    })();
  }, []);
  return (
    <Card><CardContent className="pt-6">
      <Table>
        <TableHeader><TableRow><TableHead>Zeit</TableHead><TableHead>Aktion</TableHead><TableHead>Objekt</TableHead><TableHead>Feld</TableHead><TableHead>Quelle</TableHead></TableRow></TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="text-xs">{new Date(r.performed_at).toLocaleString('de-DE')}</TableCell>
              <TableCell><Badge variant="secondary">{r.action}</Badge></TableCell>
              <TableCell className="text-xs font-mono">{r.entity_type}:{String(r.entity_id).slice(0, 8)}</TableCell>
              <TableCell>{r.field_name ?? '—'}</TableCell>
              <TableCell>{r.source ?? '—'}</TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Noch keine Einträge.</TableCell></TableRow>}
        </TableBody>
      </Table>
    </CardContent></Card>
  );
}

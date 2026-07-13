import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export default function KatalogNiederlassungen() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).from('catalog_branches').select('*').order('sort_order');
      setRows(data ?? []);
    })();
  }, []);
  return (
    <Card><CardContent className="pt-6">
      <Table>
        <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Gesellschaft</TableHead><TableHead>Währung</TableHead><TableHead>Sprache</TableHead><TableHead>Aktiv</TableHead></TableRow></TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-mono">{r.code}</TableCell>
              <TableCell className="font-medium">{r.name}</TableCell>
              <TableCell>{r.company_name ?? '—'}</TableCell>
              <TableCell>{r.currency_code}</TableCell>
              <TableCell>{r.default_language}</TableCell>
              <TableCell>{r.is_active ? <Badge>aktiv</Badge> : <Badge variant="secondary">inaktiv</Badge>}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </CardContent></Card>
  );
}

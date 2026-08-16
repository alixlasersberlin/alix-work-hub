import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PH_DOC_VISIBILITY } from '@/lib/producthub/config';

const db = supabase as any;

export default function ProductHubDokumente() {
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [vis, setVis] = useState('all');

  useEffect(() => {
    (async () => {
      const { data } = await db.from('ph_documents').select('*, ph_products(name)').order('created_at', { ascending: false });
      setRows(data || []);
    })();
  }, []);

  const filtered = useMemo(() => rows.filter(d =>
    (vis === 'all' || d.visibility === vis) &&
    (!q || `${d.ph_products?.name} ${d.title} ${d.doc_type}`.toLowerCase().includes(q.toLowerCase()))
  ), [rows, q, vis]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader title="Product Hub · Dokumente" subtitle="Handbücher, Technical Files, Zertifikate – mit Sichtbarkeitssteuerung" icon={FileText} />
      <Card><CardContent className="p-3 flex flex-wrap gap-2 items-center">
        <Input className="max-w-xs" placeholder="Suche…" value={q} onChange={e => setQ(e.target.value)} />
        <Badge variant={vis === 'all' ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setVis('all')}>alle</Badge>
        {PH_DOC_VISIBILITY.map(v => (
          <Badge key={v} variant={vis === v ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setVis(v)}>{v}</Badge>
        ))}
      </CardContent></Card>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Gerät</TableHead><TableHead>Titel</TableHead><TableHead>Typ</TableHead><TableHead>Sichtbarkeit</TableHead><TableHead>Version</TableHead><TableHead>Kanäle</TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Keine Dokumente.</TableCell></TableRow>}
            {filtered.map(d => (
              <TableRow key={d.id}>
                <TableCell>{d.ph_products?.name}</TableCell>
                <TableCell>{d.url ? <a href={d.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{d.title}</a> : d.title}</TableCell>
                <TableCell className="text-xs">{d.doc_type}</TableCell>
                <TableCell><Badge variant="outline">{d.visibility}</Badge></TableCell>
                <TableCell className="text-xs">{d.version || '—'}</TableCell>
                <TableCell className="text-xs">{(d.channels || []).join(', ') || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}

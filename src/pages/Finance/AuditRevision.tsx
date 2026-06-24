import { useEffect, useState } from 'react';
import { ShieldCheck, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function AuditRevision() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tbl, setTbl] = useState('alle');

  async function load() {
    setLoading(true);
    let q: any = (supabase as any).from('finance_audit_trail').select('*').order('created_at', { ascending: false }).limit(500);
    if (tbl !== 'alle') q = q.eq('entity_table', tbl);
    const { data, error } = await q;
    if (error) toast.error(error.message); else setRows(data || []);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-line */ }, [tbl]);

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <PageHeader icon={ShieldCheck} title="Audit & Revision" subtitle="Vollständiges Änderungsprotokoll aller Kassen- und Journalbuchungen"
        actions={<Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" /></Button>} />

      <Card>
        <CardHeader><CardTitle>Filter</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px]"><Label>Tabelle</Label>
            <Select value={tbl} onValueChange={setTbl}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['alle','finance_cashbook','finance_journal','finance_bank_postings','finance_cashbook_closures'].map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Einträge ({rows.length})</CardTitle></CardHeader>
        <CardContent className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Zeitpunkt</TableHead><TableHead>Tabelle</TableHead><TableHead>Aktion</TableHead>
                <TableHead>Entity-ID</TableHead><TableHead>User</TableHead><TableHead>Diff</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? <TableRow><TableCell colSpan={6}>Lädt…</TableCell></TableRow>
                : rows.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Keine Einträge</TableCell></TableRow>
                : rows.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{new Date(r.created_at).toLocaleString('de-DE')}</TableCell>
                    <TableCell className="font-mono text-xs">{r.entity_table}</TableCell>
                    <TableCell><Badge variant="outline">{r.action}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{r.entity_id?.slice(0, 8)}</TableCell>
                    <TableCell className="font-mono text-xs">{r.user_id?.slice(0, 8) || '–'}</TableCell>
                    <TableCell>
                      <details>
                        <summary className="cursor-pointer text-xs text-muted-foreground">anzeigen</summary>
                        <pre className="mt-2 max-w-2xl overflow-auto rounded bg-muted p-2 text-[10px]">{JSON.stringify({ old: r.old_data, new: r.new_data }, null, 2)}</pre>
                      </details>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

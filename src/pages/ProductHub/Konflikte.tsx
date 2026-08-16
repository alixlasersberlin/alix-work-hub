import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { phLabel } from '@/lib/producthub/config';
import { useAuth } from '@/hooks/useAuth';

const db = supabase as any;

export default function ProductHubKonflikte() {
  const { roles } = useAuth();
  const canWrite = (roles || []).some((r: string) => ['Super Admin', 'Admin'].includes(r));
  const [rows, setRows] = useState<any[]>([]);

  const load = async () => {
    const { data } = await db.from('ph_conflicts')
      .select('*, ph_products(name, model)').is('resolved_at', null).order('created_at', { ascending: false });
    setRows(data || []);
  };
  useEffect(() => { load(); }, []);

  const resolve = async (id: string, resolution: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    await db.from('ph_conflicts').update({
      resolution, resolved_at: resolution === 'later' ? null : new Date().toISOString(), resolved_by: user?.id ?? null,
    }).eq('id', id);
    toast.success('Konflikt aktualisiert');
    load();
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader title="Product Hub · Konflikte" subtitle="Abweichungen ALIXWORK MASTER ↔ COM ↔ DE" icon={AlertTriangle} />
      <Card><CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Gerät</TableHead><TableHead>Kanal</TableHead><TableHead>Feld</TableHead>
            <TableHead>Master</TableHead><TableHead>Website</TableHead><TableHead>Aktion</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Keine offenen Konflikte.</TableCell></TableRow>}
            {rows.map(c => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.ph_products?.name || '—'}</TableCell>
                <TableCell><Badge variant="outline">{c.channel_code.toUpperCase()}</Badge></TableCell>
                <TableCell>{phLabel(c.field_name)}</TableCell>
                <TableCell className="text-emerald-500 text-xs max-w-[220px] truncate">{c.master_value ?? '—'}</TableCell>
                <TableCell className="text-amber-500 text-xs max-w-[220px] truncate">{c.channel_value ?? '—'}</TableCell>
                <TableCell className="space-x-1">
                  {canWrite && <>
                    <Button size="sm" variant="outline" onClick={() => resolve(c.id, 'master')}>Master übernehmen</Button>
                    <Button size="sm" variant="outline" onClick={() => resolve(c.id, 'website')}>Website behalten</Button>
                    <Button size="sm" variant="ghost" onClick={() => resolve(c.id, 'later')}>Später</Button>
                  </>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

const db = supabase as any;
const FLOW: Record<string, string> = { draft: 'review', review: 'approved', approved: 'published' };

export default function ProductHubFreigaben() {
  const { roles } = useAuth();
  const canWrite = (roles || []).some((r: string) => ['Super Admin', 'Admin'].includes(r));
  const [rows, setRows] = useState<any[]>([]);

  const load = async () => {
    const { data } = await db.from('ph_products').select('*').neq('status', 'archived').order('updated_at', { ascending: false });
    setRows((data || []).filter((p: any) => p.status !== 'published'));
  };
  useEffect(() => { load(); }, []);

  const advance = async (p: any) => {
    const next = FLOW[p.status] || 'review';
    await db.from('ph_products').update({ status: next }).eq('id', p.id);
    toast.success(`Status → ${next}`);
    load();
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader title="Product Hub · Freigaben" subtitle="Workflow draft → review → approved → published" icon={ShieldCheck} />
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Gerät</TableHead><TableHead>Status</TableHead><TableHead>Kritische Felder</TableHead><TableHead>Aktion</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Keine offenen Freigaben.</TableCell></TableRow>}
            {rows.map(p => (
              <TableRow key={p.id}>
                <TableCell><Link to={`/product-hub/geraete/${p.id}`} className="text-primary hover:underline">{p.name}</Link></TableCell>
                <TableCell><Badge variant="outline">{p.status}</Badge></TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {[!p.mdr_status && 'MDR', !p.ce_status && 'CE', !p.intended_use && 'Zweckbestimmung', !p.laser_class && 'Laserklasse']
                    .filter(Boolean).join(', ') || 'vollständig'}
                </TableCell>
                <TableCell>{canWrite && <Button size="sm" onClick={() => advance(p)}>Weiter → {FLOW[p.status] || 'review'}</Button>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}

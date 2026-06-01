import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Section } from './_shared';
import { ExternalLink } from 'lucide-react';

type Row = {
  id: string;
  production_order_number: string | null;
  order_number: string | null;
  status: string;
  approval_status: string;
  modellname: string | null;
  reclamation_reason: string | null;
  customer_name_snapshot: string | null;
  created_at: string;
};

export default function Reklamationen() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('production_orders')
        .select('id, production_order_number, order_number, status, approval_status, modellname, reclamation_reason, customer_name_snapshot, created_at')
        .eq('is_reclamation', true)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) toast.error('Reklamationen laden fehlgeschlagen: ' + error.message);
      setRows((data ?? []) as any);
      setLoading(false);
    })();
  }, []);

  return (
    <Section title={`Produktions-Reklamationen (${rows.length})`}>
      <p className="text-sm text-muted-foreground">
        Reklamationen werden aus dem bestehenden Bestell-Modul gespiegelt (`production_orders` mit „Reklamation"). Eine CAPA kann
        unter „CAPA" mit Auslöser <span className="font-medium">reklamation</span> verknüpft werden.
      </p>
      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produktions-Nr.</TableHead>
              <TableHead>Auftrag</TableHead>
              <TableHead>Kunde</TableHead>
              <TableHead>Modell</TableHead>
              <TableHead>Grund</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Freigabe</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Lade …</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Keine Reklamationen.</TableCell></TableRow>
            ) : rows.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.production_order_number ?? '—'}</TableCell>
                <TableCell>{r.order_number ?? '—'}</TableCell>
                <TableCell>{r.customer_name_snapshot ?? '—'}</TableCell>
                <TableCell>{r.modellname ?? '—'}</TableCell>
                <TableCell className="max-w-[260px] truncate" title={r.reclamation_reason ?? ''}>{r.reclamation_reason ?? '—'}</TableCell>
                <TableCell><StatusBadge status={r.status} /></TableCell>
                <TableCell><StatusBadge status={r.approval_status} /></TableCell>
                <TableCell>
                  <Button asChild variant="ghost" size="sm">
                    <Link to={`/order/reklamation/${r.id}`}><ExternalLink className="h-4 w-4 mr-1" />Öffnen</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Section>
  );
}

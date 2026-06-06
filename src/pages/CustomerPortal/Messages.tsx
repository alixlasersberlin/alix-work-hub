import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Mail, Loader2 } from 'lucide-react';

type Ctx = { customerId: string };

export default function CustomerPortalMessages() {
  const ctx = useOutletContext<Ctx>();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('mail_messages')
        .select('id, subject, from_email, from_name, sent_at, created_at, status, direction, is_read, opened_at')
        .eq('customer_id', ctx.customerId)
        .order('created_at', { ascending: false })
        .limit(200);
      setRows(data ?? []);
      setLoading(false);
    })();
  }, [ctx.customerId]);

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Mail className="w-5 h-5" /> Nachrichten</CardTitle></CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-10 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <p className="text-center py-10 text-muted-foreground">Noch keine Nachrichten.</p>
        ) : (
          <div className="border border-border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Betreff</TableHead>
                  <TableHead>Absender</TableHead>
                  <TableHead>Richtung</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.subject ?? '(ohne Betreff)'}</TableCell>
                    <TableCell className="text-xs">{r.from_name ?? r.from_email}</TableCell>
                    <TableCell><Badge variant="outline">{r.direction === 'inbound' ? 'Eingang' : 'Ausgang'}</Badge></TableCell>
                    <TableCell className="text-xs">{new Date(r.sent_at ?? r.created_at).toLocaleString('de-DE')}</TableCell>
                    <TableCell><Badge>{r.is_read ? 'Gelesen' : 'Neu'}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

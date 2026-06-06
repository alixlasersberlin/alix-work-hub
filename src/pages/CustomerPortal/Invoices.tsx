import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Receipt, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type Ctx = { customerId: string };

export default function CustomerPortalInvoices() {
  const ctx = useOutletContext<Ctx>();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('mail_attachments')
        .select('id, file_name, sent_at, created_at, status, storage_bucket, storage_path, order_id')
        .eq('customer_id', ctx.customerId)
        .eq('document_type', 'Rechnung')
        .order('created_at', { ascending: false });
      setRows(data ?? []);
      setLoading(false);
    })();
  }, [ctx.customerId]);

  const download = async (r: any) => {
    const { data, error } = await supabase.storage.from(r.storage_bucket).createSignedUrl(r.storage_path, 60);
    if (error || !data?.signedUrl) return toast.error(error?.message ?? 'Fehler');
    window.open(data.signedUrl, '_blank');
  };

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Receipt className="w-5 h-5" /> Rechnungen</CardTitle></CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <p className="text-center py-10 text-muted-foreground">Aktuell keine Rechnungen.</p>
        ) : (
          <div className="border border-border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rechnung</TableHead><TableHead>Datum</TableHead>
                  <TableHead>Status</TableHead><TableHead className="text-right">PDF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.file_name}</TableCell>
                    <TableCell className="text-xs">{new Date(r.sent_at ?? r.created_at).toLocaleDateString('de-DE')}</TableCell>
                    <TableCell><Badge>{r.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => download(r)}>
                        <Download className="w-4 h-4 mr-1" /> Download
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-4">
          Online-Zahlung wird vorbereitet. Bitte überweisen Sie bis dahin gemäß den Zahlungsdaten auf der Rechnung.
        </p>
      </CardContent>
    </Card>
  );
}

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileCheck2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type Row = {
  id: string;
  document_type: string;
  file_name: string;
  status: string;
  sent_at: string | null;
  opened_at: string | null;
  downloaded_at: string | null;
  download_count: number;
  mail_messages?: { to_email: string | null; subject: string | null } | null;
};

export default function Versandnachweise() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('mail_attachments')
        .select('id,document_type,file_name,status,sent_at,opened_at,downloaded_at,download_count,mail_messages(to_email,subject)')
        .not('sent_at', 'is', null)
        .order('sent_at', { ascending: false })
        .limit(500);
      if (error) toast.error(error.message);
      setRows((data as any) ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FileCheck2 className="w-5 h-5" /> Versandnachweise</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Lade Versandnachweise...
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Noch keine versendeten Dokumente.
          </div>
        ) : (
          <div className="border border-border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Typ</TableHead>
                  <TableHead>Datei</TableHead>
                  <TableHead>Empfänger</TableHead>
                  <TableHead>Betreff</TableHead>
                  <TableHead>Versendet</TableHead>
                  <TableHead>Geöffnet</TableHead>
                  <TableHead>Heruntergeladen</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell><Badge variant="outline">{r.document_type}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{r.file_name}</TableCell>
                    <TableCell className="text-xs">{r.mail_messages?.to_email ?? '—'}</TableCell>
                    <TableCell className="text-xs max-w-[280px] truncate">{r.mail_messages?.subject ?? '—'}</TableCell>
                    <TableCell className="text-xs">{r.sent_at ? new Date(r.sent_at).toLocaleString('de-DE') : '—'}</TableCell>
                    <TableCell className="text-xs">{r.opened_at ? new Date(r.opened_at).toLocaleString('de-DE') : '—'}</TableCell>
                    <TableCell className="text-xs">{r.downloaded_at ? `${r.download_count}×` : '—'}</TableCell>
                    <TableCell><Badge variant="secondary">{r.status}</Badge></TableCell>
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

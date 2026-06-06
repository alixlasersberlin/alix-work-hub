import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type Ctx = { customerId: string };
const TYPES = ['Alle','Rechnung','Angebot','Lieferschein','Reparaturbericht','Servicebericht','Vertrag','Schulungszertifikat','Mahnung'];

export default function CustomerPortalDocuments() {
  const ctx = useOutletContext<Ctx>();
  const [rows, setRows] = useState<any[]>([]);
  const [type, setType] = useState('Alle');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('mail_attachments')
      .select('id, document_type, file_name, status, sent_at, created_at, storage_bucket, storage_path, download_count')
      .eq('customer_id', ctx.customerId)
      .order('created_at', { ascending: false });
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [ctx.customerId]);

  const filtered = type === 'Alle' ? rows : rows.filter(r => r.document_type === type);

  const download = async (r: any) => {
    const { data, error } = await supabase.storage.from(r.storage_bucket).createSignedUrl(r.storage_path, 60);
    if (error || !data?.signedUrl) return toast.error(error?.message ?? 'Fehler');
    window.open(data.signedUrl, '_blank');
    await supabase.from('customer_portal_document_downloads').insert({
      customer_id: ctx.customerId,
      attachment_id: r.id,
      document_type: r.document_type,
      storage_bucket: r.storage_bucket,
      storage_path: r.storage_path,
    });
    await supabase.from('mail_attachments').update({
      downloaded_at: new Date().toISOString(),
      download_count: (r.download_count ?? 0) + 1,
      status: 'heruntergeladen',
    }).eq('id', r.id);
    load();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5" /> Dokumente</CardTitle>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-10 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-center py-10 text-muted-foreground">Noch keine Dokumente.</p>
        ) : (
          <div className="border border-border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Typ</TableHead><TableHead>Datei</TableHead>
                  <TableHead>Datum</TableHead><TableHead>Status</TableHead>
                  <TableHead className="text-right">Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell><Badge variant="outline">{r.document_type}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{r.file_name}</TableCell>
                    <TableCell className="text-xs">{new Date(r.sent_at ?? r.created_at).toLocaleDateString('de-DE')}</TableCell>
                    <TableCell><Badge>{r.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => download(r)}>
                        <Download className="w-4 h-4" />
                      </Button>
                    </TableCell>
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

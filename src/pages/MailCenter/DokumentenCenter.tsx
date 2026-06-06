import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Download, Eye, Search, Loader2, Send, FileCheck2 } from 'lucide-react';
import { toast } from 'sonner';

const TYPES = ['Alle','Rechnung','Angebot','Lieferschein','Reparaturbericht','Servicebericht','Vertrag','Schulungszertifikat','Mahnung','Sonstiges'];
const STATUSES = ['Alle','erstellt','versendet','geoeffnet','heruntergeladen','signiert','fehler'];

type Row = {
  id: string;
  document_type: string;
  file_name: string;
  storage_bucket: string;
  storage_path: string;
  status: string;
  sent_at: string | null;
  opened_at: string | null;
  downloaded_at: string | null;
  download_count: number;
  created_at: string;
  customer_id: string | null;
  order_id: string | null;
  repair_order_id: string | null;
  production_order_id: string | null;
};

const statusColor: Record<string, string> = {
  erstellt: 'bg-muted text-foreground',
  versendet: 'bg-blue-500/15 text-blue-400',
  geoeffnet: 'bg-yellow-500/15 text-yellow-400',
  heruntergeladen: 'bg-emerald-500/15 text-emerald-400',
  signiert: 'bg-primary/15 text-primary',
  fehler: 'bg-red-500/15 text-red-400',
};

export default function DokumentenCenter() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState('Alle');
  const [status, setStatus] = useState('Alle');
  const [q, setQ] = useState('');

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('mail_attachments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) toast.error(error.message);
    setRows((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => rows.filter((r) => {
    if (type !== 'Alle' && r.document_type !== type) return false;
    if (status !== 'Alle' && r.status !== status) return false;
    if (q && !r.file_name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [rows, type, status, q]);

  const stats = useMemo(() => ({
    total: rows.length,
    sent: rows.filter(r => r.sent_at).length,
    opened: rows.filter(r => r.opened_at).length,
    downloaded: rows.filter(r => r.download_count > 0).length,
  }), [rows]);

  const download = async (r: Row) => {
    const { data, error } = await supabase.storage.from(r.storage_bucket).createSignedUrl(r.storage_path, 60);
    if (error || !data?.signedUrl) { toast.error(error?.message ?? 'Fehler'); return; }
    window.open(data.signedUrl, '_blank');
    await supabase.from('mail_attachments').update({
      downloaded_at: new Date().toISOString(),
      download_count: (r.download_count ?? 0) + 1,
      status: r.status === 'versendet' || r.status === 'geoeffnet' ? 'heruntergeladen' : r.status,
    }).eq('id', r.id);
    load();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Dokumente gesamt', value: stats.total, icon: FileText },
          { label: 'Versendet', value: stats.sent, icon: Send },
          { label: 'Geöffnet', value: stats.opened, icon: Eye },
          { label: 'Heruntergeladen', value: stats.downloaded, icon: Download },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="pt-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-bold">{s.value}</p>
                </div>
                <Icon className="w-5 h-5 text-primary" />
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5" /> Dokumenten-Center</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Dateiname suchen..." value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Lade Dokumente...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileCheck2 className="w-10 h-10 mx-auto mb-2 opacity-50" />
              Noch keine Dokumente im Center. Anhänge erscheinen hier, sobald E-Mails mit Anhängen versendet wurden.
            </div>
          ) : (
            <div className="border border-border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Typ</TableHead>
                    <TableHead>Datei</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Versendet</TableHead>
                    <TableHead>Geöffnet</TableHead>
                    <TableHead>Downloads</TableHead>
                    <TableHead className="text-right">Aktion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell><Badge variant="outline">{r.document_type}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{r.file_name}</TableCell>
                      <TableCell>
                        <Badge className={statusColor[r.status] ?? ''}>{r.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">{r.sent_at ? new Date(r.sent_at).toLocaleString('de-DE') : '—'}</TableCell>
                      <TableCell className="text-xs">{r.opened_at ? new Date(r.opened_at).toLocaleString('de-DE') : '—'}</TableCell>
                      <TableCell>{r.download_count}</TableCell>
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
    </div>
  );
}

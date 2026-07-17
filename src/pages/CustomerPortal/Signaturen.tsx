import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileSignature, Download, PenLine, Clock, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

type Row = {
  id: string;
  title: string;
  document_type: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  storage_path: string;
  request?: { id: string; expires_at: string; status: string; token: string } | null;
};

export default function CustomerPortalSignaturen() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('sig_documents')
        .select('id, title, document_type, status, created_at, completed_at, storage_path, sig_requests(id, expires_at, status, token)')
        .order('created_at', { ascending: false });
      const mapped = (data || []).map((d: any) => ({
        ...d,
        request: Array.isArray(d.sig_requests) ? d.sig_requests[0] : d.sig_requests,
      }));
      setRows(mapped);
      setLoading(false);
    })();
  }, []);

  const openSign = (r: Row) => {
    if (!r.request?.token) return toast.error('Kein Sign-Link verfügbar');
    window.open(`${window.location.origin}/sign/${r.request.token}`, '_blank', 'noopener');
  };

  const downloadFinal = async (r: Row) => {
    const { data, error } = await supabase.storage.from('sig-documents').createSignedUrl(r.storage_path, 300);
    if (error || !data?.signedUrl) return toast.error('Download nicht möglich');
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  const open = rows.filter((r) => r.status !== 'signiert' && r.status !== 'abgelehnt');
  const done = rows.filter((r) => r.status === 'signiert');
  const archive = rows.filter((r) => r.status === 'abgelehnt' || (r.status === 'signiert' && r.completed_at));

  const StatusBadge = ({ s }: { s: string }) => {
    const map: Record<string, string> = {
      offen: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
      teilweise_signiert: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300',
      signiert: 'bg-green-500/10 text-green-700 dark:text-green-300',
      abgelehnt: 'bg-red-500/10 text-red-700 dark:text-red-300',
    };
    return <Badge className={map[s] || 'bg-muted'}>{s}</Badge>;
  };

  const Table = ({ list, showSign }: { list: Row[]; showSign?: boolean }) => (
    <div className="divide-y">
      {list.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Keine Dokumente</p>}
      {list.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center gap-3 py-3">
          <div className="flex-1 min-w-[200px]">
            <div className="font-medium">{r.title}</div>
            <div className="text-xs text-muted-foreground">
              {r.document_type} · erstellt {new Date(r.created_at).toLocaleDateString('de-DE')}
              {r.request?.expires_at && ` · gültig bis ${new Date(r.request.expires_at).toLocaleDateString('de-DE')}`}
            </div>
          </div>
          <StatusBadge s={r.status} />
          {showSign && r.request?.token && (
            <Button size="sm" onClick={() => openSign(r)}>
              <PenLine className="w-3.5 h-3.5 mr-1" />Jetzt unterschreiben
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => downloadFinal(r)}>
            <Download className="w-3.5 h-3.5 mr-1" />PDF
          </Button>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <FileSignature className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">Meine Signaturen</h1>
          <p className="text-sm text-muted-foreground">Offene und abgeschlossene Unterschriften-Anfragen</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Lade…</p>
          ) : (
            <Tabs defaultValue="open">
              <TabsList>
                <TabsTrigger value="open"><Clock className="w-4 h-4 mr-1" />Offen ({open.length})</TabsTrigger>
                <TabsTrigger value="done"><CheckCircle2 className="w-4 h-4 mr-1" />Erledigt ({done.length})</TabsTrigger>
                <TabsTrigger value="archive">Archiv ({archive.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="open"><Table list={open} showSign /></TabsContent>
              <TabsContent value="done"><Table list={done} /></TabsContent>
              <TabsContent value="archive"><Table list={archive} /></TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

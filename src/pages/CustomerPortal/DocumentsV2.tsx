import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Files, Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { logPortalAudit } from '@/lib/portal/audit';

type Ctx = { customerId: string };

export default function CustomerPortalDocumentsV2() {
  const ctx = useOutletContext<Ctx>();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('Alle');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('customer_portal_documents')
        .select('*').eq('customer_id', ctx.customerId).eq('customer_visible', true)
        .order('published_at', { ascending: false, nullsFirst: false });
      setRows(data ?? []);
      setLoading(false);
    })();
  }, [ctx.customerId]);

  const types = useMemo(() => ['Alle', ...Array.from(new Set(rows.map((r) => r.document_type).filter(Boolean)))], [rows]);
  const filtered = filter === 'Alle' ? rows : rows.filter((r) => r.document_type === filter);

  const download = async (r: any) => {
    const { data, error } = await supabase.storage.from(r.storage_bucket).createSignedUrl(r.storage_path, 60);
    if (error || !data?.signedUrl) return toast.error(error?.message ?? 'Download nicht möglich');
    window.open(data.signedUrl, '_blank');
    await supabase.from('customer_portal_documents').update({ download_count: (r.download_count ?? 0) + 1 }).eq('id', r.id);
    void logPortalAudit({ action: 'invoice_downloaded', customerId: ctx.customerId, objectType: 'portal_document', objectId: r.id });
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="flex items-center gap-2"><Files className="w-5 h-5" /> Dokumente</CardTitle>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>{types.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="text-center py-10 text-muted-foreground text-sm">Aktuell keine freigegebenen Dokumente.</p>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((r) => (
              <li key={r.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{r.title}</p>
                  <p className="text-xs text-muted-foreground">
                    <Badge variant="outline" className="mr-2">{r.document_type}</Badge>
                    {r.published_at && `veröffentlicht ${new Date(r.published_at).toLocaleDateString('de-DE')}`}
                    {r.document_number && ` · ${r.document_number}`}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => download(r)}><Download className="w-4 h-4 mr-1" />Öffnen</Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

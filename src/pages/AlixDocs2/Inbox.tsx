import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, FileText, Inbox as InboxIcon } from 'lucide-react';

type Doc = {
  id: string; title?: string; nc_path: string; status: string; doc_type?: string;
  size_bytes?: number; mime?: string; ai_tags: string[]; created_at: string;
};

const statusColor: Record<string, string> = {
  neu: 'bg-blue-500/20 text-blue-500 border-blue-500/50',
  importiert: 'bg-blue-500/20 text-blue-500 border-blue-500/50',
  analysiert: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50',
  zugeordnet: 'bg-purple-500/20 text-purple-500 border-purple-500/50',
  geprueft: 'bg-emerald-500/20 text-emerald-500 border-emerald-500/50',
  freigegeben: 'bg-green-500/20 text-green-500 border-green-500/50',
  archiviert: 'bg-gray-500/20 text-gray-400 border-gray-500/50',
  ocr_fehler: 'bg-red-500/20 text-red-500 border-red-500/50',
};

function humanSize(bytes?: number) {
  if (!bytes) return '';
  const kb = bytes / 1024; if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export default function AlixDocs2Inbox() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  const load = async () => {
    setLoading(true);
    let query = supabase.from('alixdocs2_documents')
      .select('id, title, nc_path, status, doc_type, size_bytes, mime, ai_tags, created_at')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(200);
    if (q.trim()) query = query.ilike('title', `%${q.trim()}%`);
    const { data } = await query;
    setDocs((data as Doc[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-display gold-text flex items-center gap-2">
          <InboxIcon className="w-6 h-6" /> ALIXDocs AI 2.0 — Posteingang
        </h1>
        <p className="text-sm text-muted-foreground">Alle aus Nextcloud importierten Dokumente. KI-Analyse folgt in Phase 3.</p>
      </div>

      <div className="flex gap-2">
        <Input placeholder="Suche im Titel…" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{loading ? 'Lade…' : `${docs.length} Dokument(e)`}</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> :
            docs.length === 0 ? <p className="italic text-sm text-muted-foreground text-center py-6">Noch keine Dokumente importiert. Zuerst einen Nextcloud-Ordner überwachen.</p> :
            docs.map(d => (
              <div key={d.id} className="flex items-center gap-3 p-2 rounded border hover:bg-muted/30 text-sm">
                <FileText className="w-4 h-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{d.title || d.nc_path}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {d.nc_path} · {d.mime} · {humanSize(d.size_bytes)} · {new Date(d.created_at).toLocaleString('de-DE')}
                  </div>
                </div>
                <Badge variant="outline" className={statusColor[d.status] ?? ''}>{d.status}</Badge>
                {d.doc_type && <Badge variant="secondary">{d.doc_type}</Badge>}
              </div>
            ))
          }
        </CardContent>
      </Card>
    </div>
  );
}

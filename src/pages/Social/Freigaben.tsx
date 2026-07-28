import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';

type Row = {
  id: string; post_id: string; decision: string; version: number; comment: string | null;
  created_at: string; requested_by: string | null;
  post: { id: string; title: string | null; body: string | null; platform: string; client_id: string } | null;
};

export default function SocialFreigaben() {
  const [rows, setRows] = useState<Row[]>([]);
  const [comment, setComment] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('social_approvals')
      .select('id,post_id,decision,version,comment,created_at,requested_by,post:social_posts(id,title,body,platform,client_id)')
      .eq('decision', 'pending')
      .order('created_at', { ascending: false });
    setRows((data ?? []) as any);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function decide(row: Row, decision: 'approved' | 'rejected') {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('social_approvals').update({
      decision, decided_by: user?.id ?? null, decided_at: new Date().toISOString(),
      comment: comment[row.id] || null,
    }).eq('id', row.id);
    if (error) return toast.error(error.message);
    if (row.post_id) {
      await supabase.from('social_posts').update({
        status: decision === 'approved' ? 'approved' : 'rejected',
      }).eq('id', row.post_id);
    }
    toast.success(decision === 'approved' ? 'Freigegeben' : 'Abgelehnt');
    load();
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Freigaben</h1>
        <p className="text-muted-foreground mt-1">Beiträge, die auf deine Entscheidung warten</p>
      </div>

      {loading && <div className="text-muted-foreground">Lade…</div>}
      {!loading && rows.length === 0 && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
          Keine offenen Freigaben.
        </CardContent></Card>
      )}

      {rows.map(r => (
        <Card key={r.id}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-400" />
              {r.post?.title ?? 'Ohne Titel'}
              <Badge variant="outline">{r.post?.platform}</Badge>
              <Badge variant="outline">v{r.version}</Badge>
            </CardTitle>
            <Link to={`/social/beitrag/${r.post_id}`} className="text-xs text-primary hover:underline">Öffnen →</Link>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm whitespace-pre-wrap rounded-lg bg-muted/40 p-3 border border-border/50">
              {r.post?.body ?? '—'}
            </div>
            <Textarea placeholder="Kommentar (optional)…" rows={2}
              value={comment[r.id] ?? ''} onChange={e => setComment({ ...comment, [r.id]: e.target.value })} />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => decide(r, 'rejected')}>
                <XCircle className="mr-2 h-4 w-4" />Ablehnen
              </Button>
              <Button onClick={() => decide(r, 'approved')}>
                <CheckCircle2 className="mr-2 h-4 w-4" />Freigeben
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

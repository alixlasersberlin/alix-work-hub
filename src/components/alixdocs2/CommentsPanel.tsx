import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { MessageSquare, Trash2 } from 'lucide-react';

export function CommentsPanel({ documentId }: { documentId: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [body, setBody] = useState('');
  const [kind, setKind] = useState<'comment' | 'note'>('comment');
  const [me, setMe] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await supabase.from('alixdocs2_comments')
      .select('*').eq('document_id', documentId).order('created_at', { ascending: false });
    setItems(data ?? []);
  }
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  async function add() {
    if (!body.trim() || !me) return;
    setBusy(true);
    const { error } = await supabase.from('alixdocs2_comments').insert({
      document_id: documentId, user_id: me, body: body.trim(), kind,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setBody(''); load();
  }
  async function del(id: string) {
    const { error } = await supabase.from('alixdocs2_comments').delete().eq('id', id);
    if (error) return toast.error(error.message);
    load();
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Kommentare & Notizen ({items.length})</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <div className="flex gap-2 text-xs">
            <button onClick={() => setKind('comment')} className={`px-2 py-1 rounded ${kind === 'comment' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>Kommentar</button>
            <button onClick={() => setKind('note')} className={`px-2 py-1 rounded ${kind === 'note' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>Notiz</button>
          </div>
          <Textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Kommentar oder Notiz…" rows={2} />
          <Button size="sm" onClick={add} disabled={busy || !body.trim()}>Hinzufügen</Button>
        </div>
        <div className="space-y-2 max-h-72 overflow-auto">
          {items.length === 0 && <p className="text-xs text-muted-foreground">Noch keine Einträge.</p>}
          {items.map(i => (
            <div key={i.id} className="border rounded p-2 text-sm">
              <div className="flex items-center justify-between mb-1">
                <Badge variant={i.kind === 'note' ? 'outline' : 'secondary'} className="text-[10px]">{i.kind}</Badge>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">{new Date(i.created_at).toLocaleString('de-DE')}</span>
                  {i.user_id === me && (
                    <button onClick={() => del(i.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-3 h-3" /></button>
                  )}
                </div>
              </div>
              <p className="whitespace-pre-wrap">{i.body}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

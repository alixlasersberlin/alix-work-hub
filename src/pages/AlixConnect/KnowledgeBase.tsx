import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Sparkles, Eye, EyeOff, Plus, Save } from 'lucide-react';
import { toast } from 'sonner';

type Article = { id: string; title: string; content: string; category: string | null; tags: string[]; status: string; public_visible: boolean; version: number; updated_at: string; submitted_for_review_at?: string | null; reviewed_by?: string | null; reviewed_at?: string | null; review_notes?: string | null };

export default function AlixConnectKnowledgeBase() {
  const [items, setItems] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Article | null>(null);
  const empty: Article = { id: '', title: '', content: '', category: '', tags: [], status: 'draft', public_visible: false, version: 1, updated_at: '' };

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('ac_kb_articles').select('*').order('updated_at', { ascending: false }).limit(200);
    setItems((data as any) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing || !editing.title.trim()) return toast.error('Titel fehlt');
    const payload = { title: editing.title, content: editing.content, category: editing.category, tags: editing.tags, status: editing.status, public_visible: editing.public_visible };
    let id = editing.id;
    if (id) {
      const { error } = await supabase.from('ac_kb_articles').update({ ...payload, version: editing.version + 1 }).eq('id', id);
      if (error) return toast.error(error.message);
    } else {
      const { data, error } = await supabase.from('ac_kb_articles').insert(payload).select().single();
      if (error) return toast.error(error.message);
      id = (data as any).id;
    }
    // Embed
    try { await supabase.functions.invoke('ac-kb-embed', { body: { article_id: id } }); } catch (_) {}
    toast.success('Gespeichert & indiziert');
    setEditing(null); load();
  };

  const submitForReview = async (a: Article) => {
    const { error } = await supabase.from('ac_kb_articles').update({ status: 'review', submitted_for_review_at: new Date().toISOString() }).eq('id', a.id);
    if (error) return toast.error(error.message);
    toast.success('Zur Prüfung eingereicht'); load();
  };
  const approveArticle = async (a: Article, notes?: string) => {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from('ac_kb_articles').update({ status: 'published', reviewed_by: u.user?.id ?? null, reviewed_at: new Date().toISOString(), review_notes: notes ?? null }).eq('id', a.id);
    if (error) return toast.error(error.message);
    toast.success('Freigegeben & veröffentlicht'); load();
  };
  const rejectArticle = async (a: Article) => {
    const notes = prompt('Ablehnungsgrund (optional):') ?? '';
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from('ac_kb_articles').update({ status: 'draft', reviewed_by: u.user?.id ?? null, reviewed_at: new Date().toISOString(), review_notes: notes }).eq('id', a.id);
    if (error) return toast.error(error.message);
    toast.success('Zurück auf Entwurf'); load();
  };

  const filtered = items.filter(i => !q || i.title.toLowerCase().includes(q.toLowerCase()) || (i.content ?? '').toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="h-full overflow-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><BookOpen className="h-4 w-4 text-primary" /> Knowledge Base 2.0 <Badge variant="outline">AI-Search</Badge></h2>
          <p className="text-sm text-muted-foreground">Redaktion, Versionen, semantische Suche (Embeddings).</p>
        </div>
        <Button size="sm" onClick={() => setEditing(empty)}><Plus className="h-4 w-4 mr-1" />Neuer Artikel</Button>
      </div>

      <Input placeholder="Suche…" value={q} onChange={e => setQ(e.target.value)} className="max-w-md" />

      {editing && (
        <Card className="p-4 space-y-3 border-primary">
          <div className="text-sm font-semibold flex items-center justify-between">
            <span>{editing.id ? `Artikel bearbeiten (v${editing.version})` : 'Neuer Artikel'}</span>
            <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Abbrechen</Button>
          </div>
          <Input placeholder="Titel" value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Kategorie" value={editing.category ?? ''} onChange={e => setEditing({ ...editing, category: e.target.value })} />
            <Input placeholder="Tags (komma-getrennt)" value={editing.tags.join(', ')} onChange={e => setEditing({ ...editing, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })} />
          </div>
          <Textarea rows={10} placeholder="Inhalt (Markdown erlaubt)" value={editing.content} onChange={e => setEditing({ ...editing, content: e.target.value })} />
          <div className="flex items-center gap-3">
            <select className="border rounded px-2 py-1.5 text-sm bg-background" value={editing.status} onChange={e => setEditing({ ...editing, status: e.target.value })}>
              <option value="draft">Entwurf</option>
              <option value="review">Review</option>
              <option value="published">Veröffentlicht</option>
              <option value="archived">Archiviert</option>
            </select>
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={editing.public_visible} onChange={e => setEditing({ ...editing, public_visible: e.target.checked })} />öffentlich sichtbar</label>
            {editing.id && editing.status === 'draft' && <Button size="sm" variant="outline" onClick={() => submitForReview(editing)}>Zur Prüfung einreichen</Button>}
            {editing.id && editing.status === 'review' && (<><Button size="sm" variant="outline" onClick={() => rejectArticle(editing)}>Ablehnen</Button><Button size="sm" onClick={() => approveArticle(editing)}>Freigeben</Button></>)}
            <Button size="sm" className="ml-auto" onClick={save}><Save className="h-4 w-4 mr-1" />Speichern & Indizieren</Button>
          </div>
        </Card>
      )}

      {loading ? <div className="text-xs text-muted-foreground">Lade…</div> : (
        <div className="grid md:grid-cols-2 gap-3">
          {filtered.map(a => (
            <Card key={a.id} className="p-4 cursor-pointer hover:border-primary" onClick={() => setEditing(a)}>
              <div className="flex items-center justify-between mb-1">
                <div className="font-medium text-sm">{a.title}</div>
                <div className="flex gap-1">
                  <Badge variant={a.status === 'published' ? 'default' : 'outline'}>{a.status}</Badge>
                  {a.public_visible ? <Eye className="h-3.5 w-3.5 text-primary" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                </div>
              </div>
              {a.category && <div className="text-xs text-muted-foreground">{a.category}</div>}
              <div className="text-xs mt-2 line-clamp-3 text-muted-foreground">{a.content}</div>
              <div className="flex items-center gap-1 mt-2 flex-wrap">{a.tags?.slice(0, 5).map(t => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}</div>
            </Card>
          ))}
          {filtered.length === 0 && <div className="text-xs text-muted-foreground col-span-2">Keine Artikel.</div>}
        </div>
      )}

      {/* Review-Queue */}
      {items.some(i => i.status === 'review') && (
        <Card className="p-4 border-primary/40">
          <div className="text-sm font-semibold mb-2">📋 Review-Queue ({items.filter(i => i.status === 'review').length})</div>
          <div className="space-y-2">
            {items.filter(i => i.status === 'review').map(a => (
              <div key={a.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                <div>
                  <div className="text-sm font-medium">{a.title}</div>
                  <div className="text-xs text-muted-foreground">Eingereicht {a.submitted_for_review_at ? new Date(a.submitted_for_review_at).toLocaleString('de-DE') : '—'}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing(a)}>Ansehen</Button>
                  <Button size="sm" variant="outline" onClick={() => rejectArticle(a)}>Ablehnen</Button>
                  <Button size="sm" onClick={() => approveArticle(a)}>Freigeben</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-3 text-xs text-muted-foreground flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-primary" /> Beim Speichern werden Titel &amp; Inhalt automatisch als Vektor indiziert und im Copilot &amp; Self-Service-Portal per semantischer Suche gefunden.
      </Card>
    </div>
  );
}

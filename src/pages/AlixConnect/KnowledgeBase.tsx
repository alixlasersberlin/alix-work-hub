import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BookOpen, Sparkles, Eye, EyeOff, Plus, Save, Wand2, History } from 'lucide-react';
import { toast } from 'sonner';

type Article = { id: string; title: string; content: string; category: string | null; tags: string[]; status: string; public_visible: boolean; version: number; updated_at: string; submitted_for_review_at?: string | null; reviewed_by?: string | null; reviewed_at?: string | null; review_notes?: string | null; visible_segment_ids?: string[] | null; auto_publish_threshold?: number | null };

function diffLines(a = '', b = '') {
  const A = a.split('\n'), B = b.split('\n');
  const out: { type: 'ctx' | 'add' | 'del'; text: string }[] = [];
  const max = Math.max(A.length, B.length);
  for (let i = 0; i < max; i++) {
    if (A[i] === B[i]) out.push({ type: 'ctx', text: A[i] ?? '' });
    else { if (A[i] != null) out.push({ type: 'del', text: A[i] }); if (B[i] != null) out.push({ type: 'add', text: B[i] }); }
  }
  return out;
}

export default function AlixConnectKnowledgeBase() {
  const [items, setItems] = useState<Article[]>([]);
  const [segments, setSegments] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Article | null>(null);
  const [versionsFor, setVersionsFor] = useState<Article | null>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [selVer, setSelVer] = useState<any>(null);
  const empty: Article = { id: '', title: '', content: '', category: '', tags: [], status: 'draft', public_visible: false, version: 1, updated_at: '', visible_segment_ids: [], auto_publish_threshold: null };

  const load = async () => {
    setLoading(true);
    const [a, s] = await Promise.all([
      supabase.from('ac_kb_articles').select('*').order('updated_at', { ascending: false }).limit(200),
      supabase.from('ac_journey_segments').select('id, name').order('name'),
    ]);
    setItems((a.data as any) ?? []);
    setSegments((s.data as any) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openVersions = async (a: Article) => {
    setVersionsFor(a); setSelVer(null);
    const { data } = await supabase.from('ac_kb_article_versions').select('*').eq('article_id', a.id).order('version', { ascending: false });
    setVersions((data as any) ?? []);
  };

  const save = async () => {
    if (!editing || !editing.title.trim()) return toast.error('Titel fehlt');
    const payload: any = {
      title: editing.title, content: editing.content, category: editing.category, tags: editing.tags,
      status: editing.status, public_visible: editing.public_visible,
      visible_segment_ids: editing.visible_segment_ids ?? [],
      auto_publish_threshold: editing.auto_publish_threshold,
    };
    let id = editing.id;
    if (id) {
      const { error } = await supabase.from('ac_kb_articles').update(payload).eq('id', id);
      if (error) return toast.error(error.message);
    } else {
      const { data, error } = await supabase.from('ac_kb_articles').insert(payload).select().single();
      if (error) return toast.error(error.message);
      id = (data as any).id;
    }
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
    const autoPublic = (a.auto_publish_threshold ?? 0) > 0;
    const { error } = await supabase.from('ac_kb_articles').update({
      status: 'published', public_visible: autoPublic || a.public_visible,
      reviewed_by: u.user?.id ?? null, reviewed_at: new Date().toISOString(), review_notes: notes ?? null,
    }).eq('id', a.id);
    if (error) return toast.error(error.message);
    toast.success(autoPublic ? 'Freigegeben & auto-veröffentlicht' : 'Freigegeben'); load();
  };
  const rejectArticle = async (a: Article) => {
    const notes = prompt('Ablehnungsgrund (optional):') ?? '';
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from('ac_kb_articles').update({ status: 'draft', reviewed_by: u.user?.id ?? null, reviewed_at: new Date().toISOString(), review_notes: notes }).eq('id', a.id);
    if (error) return toast.error(error.message);
    toast.success('Zurück auf Entwurf'); load();
  };

  const filtered = items.filter(i => !q || i.title.toLowerCase().includes(q.toLowerCase()) || (i.content ?? '').toLowerCase().includes(q.toLowerCase()));
  const diff = selVer && editing ? diffLines(selVer.content ?? '', editing.content ?? '') : selVer && versionsFor ? diffLines(selVer.content ?? '', versionsFor.content ?? '') : [];

  return (
    <div className="h-full overflow-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><BookOpen className="h-4 w-4 text-primary" /> Knowledge Base 2.0 <Badge variant="outline">AI-Search · Versions</Badge></h2>
          <p className="text-sm text-muted-foreground">Redaktion, Versionen mit Diff, Auto-Publish, Segment-Sichtbarkeit.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={async () => {
            const t = toast.loading('AI erzeugt Entwürfe…');
            const { data, error } = await supabase.functions.invoke('ac-kb-ai-draft', { body: { limit: 5, days_back: 7 } });
            toast.dismiss(t);
            if (error) return toast.error(error.message);
            toast.success(`${(data as any)?.drafts?.length ?? 0} Entwürfe erzeugt`); load();
          }}><Wand2 className="h-4 w-4 mr-1" />AI-Draft</Button>
          <Button size="sm" onClick={() => setEditing(empty)}><Plus className="h-4 w-4 mr-1" />Neuer Artikel</Button>
        </div>
      </div>

      <Input placeholder="Suche…" value={q} onChange={e => setQ(e.target.value)} className="max-w-md" />

      {editing && (
        <Card className="p-4 space-y-3 border-primary">
          <div className="text-sm font-semibold flex items-center justify-between">
            <span>{editing.id ? `Artikel bearbeiten (v${editing.version})` : 'Neuer Artikel'}</span>
            <div className="flex gap-2">
              {editing.id && <Button size="sm" variant="outline" onClick={() => openVersions(editing)}><History className="h-4 w-4 mr-1" />Versionen</Button>}
              <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Abbrechen</Button>
            </div>
          </div>
          <Input placeholder="Titel" value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Kategorie" value={editing.category ?? ''} onChange={e => setEditing({ ...editing, category: e.target.value })} />
            <Input placeholder="Tags (komma-getrennt)" value={editing.tags.join(', ')} onChange={e => setEditing({ ...editing, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })} />
          </div>
          <Textarea rows={10} placeholder="Inhalt (Markdown)" value={editing.content} onChange={e => setEditing({ ...editing, content: e.target.value })} />

          <div className="grid md:grid-cols-2 gap-3 border-t pt-3">
            <div>
              <div className="text-xs font-medium mb-1">Sichtbare Segmente (leer = alle)</div>
              <select multiple className="border rounded px-2 py-1.5 text-xs bg-background w-full h-24"
                value={editing.visible_segment_ids ?? []}
                onChange={e => setEditing({ ...editing, visible_segment_ids: Array.from(e.target.selectedOptions).map(o => o.value) })}>
                {segments.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <div className="text-xs font-medium mb-1">Auto-Publish-Schwelle (Score)</div>
              <Input type="number" step="0.1" placeholder="z. B. 0.8 – bei Approval wird auto-öffentlich" value={editing.auto_publish_threshold ?? ''} onChange={e => setEditing({ ...editing, auto_publish_threshold: e.target.value ? Number(e.target.value) : null })} />
              <div className="text-[10px] text-muted-foreground mt-1">Bei Wert &gt; 0 wird der Artikel beim Freigeben automatisch veröffentlicht.</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <select className="border rounded px-2 py-1.5 text-sm bg-background" value={editing.status} onChange={e => setEditing({ ...editing, status: e.target.value })}>
              <option value="draft">Entwurf</option><option value="review">Review</option><option value="published">Veröffentlicht</option><option value="archived">Archiviert</option>
            </select>
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={editing.public_visible} onChange={e => setEditing({ ...editing, public_visible: e.target.checked })} />öffentlich sichtbar</label>
            {editing.id && editing.status === 'draft' && <Button size="sm" variant="outline" onClick={() => submitForReview(editing)}>Zur Prüfung</Button>}
            {editing.id && editing.status === 'review' && (<><Button size="sm" variant="outline" onClick={() => rejectArticle(editing)}>Ablehnen</Button><Button size="sm" onClick={() => approveArticle(editing)}>Freigeben</Button></>)}
            <Button size="sm" className="ml-auto" onClick={save}><Save className="h-4 w-4 mr-1" />Speichern</Button>
          </div>
        </Card>
      )}

      {loading ? <div className="text-xs text-muted-foreground">Lade…</div> : (
        <div className="grid md:grid-cols-2 gap-3">
          {filtered.map(a => (
            <Card key={a.id} className="p-4 cursor-pointer hover:border-primary" onClick={() => setEditing(a)}>
              <div className="flex items-center justify-between mb-1">
                <div className="font-medium text-sm">{a.title}</div>
                <div className="flex gap-1 items-center">
                  <Badge variant={a.status === 'published' ? 'default' : 'outline'}>{a.status}</Badge>
                  {(a.auto_publish_threshold ?? 0) > 0 && <Badge variant="secondary" className="text-[10px]">auto</Badge>}
                  {a.public_visible ? <Eye className="h-3.5 w-3.5 text-primary" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                </div>
              </div>
              {a.category && <div className="text-xs text-muted-foreground">{a.category}</div>}
              <div className="text-xs mt-2 line-clamp-3 text-muted-foreground">{a.content}</div>
              <div className="flex items-center gap-1 mt-2 flex-wrap">
                {a.tags?.slice(0, 5).map(t => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}
                {(a.visible_segment_ids?.length ?? 0) > 0 && <Badge variant="outline" className="text-[10px]">{a.visible_segment_ids!.length} Segmente</Badge>}
                <Badge variant="outline" className="text-[10px] ml-auto">v{a.version}</Badge>
              </div>
            </Card>
          ))}
          {filtered.length === 0 && <div className="text-xs text-muted-foreground col-span-2">Keine Artikel.</div>}
        </div>
      )}

      {items.some(i => i.status === 'review') && (
        <Card className="p-4 border-primary/40">
          <div className="text-sm font-semibold mb-2">📋 Review-Queue ({items.filter(i => i.status === 'review').length})</div>
          <div className="space-y-2">
            {items.filter(i => i.status === 'review').map(a => (
              <div key={a.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                <div>
                  <div className="text-sm font-medium">{a.title}</div>
                  <div className="text-xs text-muted-foreground">Eingereicht {a.submitted_for_review_at ? new Date(a.submitted_for_review_at).toLocaleString('de-DE') : '—'}{(a.auto_publish_threshold ?? 0) > 0 && ' · auto-publish aktiv'}</div>
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
        <Sparkles className="h-3.5 w-3.5 text-primary" /> Beim Speichern automatisch als Vektor indiziert. Segment-Sichtbarkeit filtert Portal-Anzeige, Auto-Publish veröffentlicht bei Approval sofort.
      </Card>

      <Dialog open={!!versionsFor} onOpenChange={o => !o && setVersionsFor(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Versionshistorie – {versionsFor?.title}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-[200px_1fr] gap-3 max-h-[70vh]">
            <div className="border-r pr-2 overflow-auto space-y-1">
              {versions.length === 0 && <div className="text-xs text-muted-foreground">Keine älteren Versionen.</div>}
              {versions.map(v => (
                <button key={v.id} onClick={() => setSelVer(v)} className={`w-full text-left px-2 py-1 rounded text-xs hover:bg-muted ${selVer?.id === v.id ? 'bg-muted' : ''}`}>
                  <div className="font-medium">v{v.version}</div>
                  <div className="text-muted-foreground">{new Date(v.created_at).toLocaleString('de-DE')}</div>
                </button>
              ))}
            </div>
            <div className="overflow-auto">
              {!selVer ? <div className="text-xs text-muted-foreground">Version links wählen für Diff.</div> : (
                <div className="font-mono text-[11px] leading-relaxed">
                  {diff.map((d, i) => (
                    <div key={i} className={d.type === 'add' ? 'bg-green-500/10 text-green-700 dark:text-green-400' : d.type === 'del' ? 'bg-red-500/10 text-red-700 dark:text-red-400' : ''}>
                      <span className="opacity-50 mr-1">{d.type === 'add' ? '+' : d.type === 'del' ? '−' : ' '}</span>{d.text || ' '}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

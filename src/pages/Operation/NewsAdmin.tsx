import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AccessDenied from '@/pages/AccessDenied';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/components/ui/use-toast';
import {
  Megaphone, Plus, Pencil, Trash2, Loader2, ImagePlus, Eye, EyeOff, ExternalLink,
} from 'lucide-react';

type NewsRow = {
  id: string;
  title: string;
  body: string;
  image_path: string | null;
  link_url: string | null;
  link_label: string | null;
  published: boolean;
  priority: number;
  require_ack: boolean;
  publish_at: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

const EMPTY: Partial<NewsRow> = {
  title: '',
  body: '',
  image_path: null,
  link_url: '',
  link_label: '',
  published: false,
  priority: 0,
  require_ack: true,
  publish_at: new Date().toISOString(),
  expires_at: null,
};

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(v: string): string | null {
  if (!v) return null;
  return new Date(v).toISOString();
}

export default function NewsAdmin() {
  const { hasRole, user } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');
  const [rows, setRows] = useState<NewsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<NewsRow> | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<NewsRow | null>(null);
  const [imgUrls, setImgUrls] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('news_posts')
      .select('*')
      .order('published', { ascending: false })
      .order('priority', { ascending: false })
      .order('publish_at', { ascending: false });
    setLoading(false);
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      return;
    }
    setRows((data ?? []) as NewsRow[]);
  }, []);

  useEffect(() => { if (isSuperAdmin) void load(); }, [isSuperAdmin, load]);

  // Signed URLs für Thumbnails
  useEffect(() => {
    (async () => {
      const map: Record<string, string> = {};
      for (const r of rows) {
        if (r.image_path && !imgUrls[r.image_path]) {
          const { data } = await supabase.storage
            .from('news-images')
            .createSignedUrl(r.image_path, 60 * 60);
          if (data?.signedUrl) map[r.image_path] = data.signedUrl;
        }
      }
      if (Object.keys(map).length) setImgUrls((s) => ({ ...s, ...map }));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  if (!isSuperAdmin) return <AccessDenied />;

  const openNew = () => { setEditing({ ...EMPTY }); setPreviewUrl(null); };
  const openEdit = async (r: NewsRow) => {
    setEditing({ ...r });
    if (r.image_path) {
      const { data } = await supabase.storage
        .from('news-images')
        .createSignedUrl(r.image_path, 60 * 60);
      setPreviewUrl(data?.signedUrl ?? null);
    } else {
      setPreviewUrl(null);
    }
  };

  const uploadImage = async (file: File) => {
    if (!editing) return;
    setUploading(true);
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from('news-images')
      .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });
    setUploading(false);
    if (error) {
      toast({ title: 'Upload fehlgeschlagen', description: error.message, variant: 'destructive' });
      return;
    }
    // altes Bild aufräumen
    if (editing.image_path) {
      await supabase.storage.from('news-images').remove([editing.image_path]).catch(() => {});
    }
    setEditing({ ...editing, image_path: path });
    const { data } = await supabase.storage.from('news-images').createSignedUrl(path, 60 * 60);
    setPreviewUrl(data?.signedUrl ?? null);
  };

  const removeImage = async () => {
    if (!editing?.image_path) return;
    await supabase.storage.from('news-images').remove([editing.image_path]).catch(() => {});
    setEditing({ ...editing, image_path: null });
    setPreviewUrl(null);
  };

  const save = async () => {
    if (!editing?.title?.trim()) {
      toast({ title: 'Titel fehlt', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload = {
      title: editing.title!.trim(),
      body: editing.body ?? '',
      image_path: editing.image_path ?? null,
      link_url: editing.link_url?.trim() || null,
      link_label: editing.link_label?.trim() || null,
      published: !!editing.published,
      priority: Number(editing.priority ?? 0) || 0,
      require_ack: editing.require_ack !== false,
      publish_at: editing.publish_at || new Date().toISOString(),
      expires_at: editing.expires_at || null,
      updated_by: user?.id ?? null,
    };
    let error;
    if (editing.id) {
      ({ error } = await supabase.from('news_posts').update(payload).eq('id', editing.id));
    } else {
      ({ error } = await supabase.from('news_posts').insert({ ...payload, created_by: user?.id ?? null }));
    }
    setSaving(false);
    if (error) {
      toast({ title: 'Fehler beim Speichern', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'News gespeichert' });
    setEditing(null);
    setPreviewUrl(null);
    void load();
  };

  const togglePublish = async (r: NewsRow) => {
    const { error } = await supabase
      .from('news_posts')
      .update({ published: !r.published, updated_by: user?.id ?? null })
      .eq('id', r.id);
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      return;
    }
    void load();
  };

  const doDelete = async () => {
    if (!toDelete) return;
    const { error } = await supabase.from('news_posts').delete().eq('id', toDelete.id);
    if (error) {
      toast({ title: 'Löschen fehlgeschlagen', description: error.message, variant: 'destructive' });
      return;
    }
    if (toDelete.image_path) {
      await supabase.storage.from('news-images').remove([toDelete.image_path]).catch(() => {});
    }
    setToDelete(null);
    void load();
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-6">
      <PageHeader
        icon={Megaphone}
        title="News & Begrüßung"
        subtitle="Inhalte für das Login-Popup pflegen. Nur Super Admin."
        noBreadcrumbs
      />

      <div className="flex justify-end">
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" /> Neue News
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          Noch keine News angelegt.
        </CardContent></Card>
      ) : (
        <div className="grid gap-4">
          {rows.map((r) => (
            <Card key={r.id} className={r.published ? '' : 'opacity-70'}>
              <CardHeader className="flex flex-row items-start gap-4 space-y-0">
                {r.image_path && imgUrls[r.image_path] && (
                  <img
                    src={imgUrls[r.image_path]}
                    alt=""
                    className="w-24 h-24 rounded-md object-cover border border-border shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <CardTitle className="text-lg truncate">{r.title}</CardTitle>
                    {r.published
                      ? <Badge variant="default">Veröffentlicht</Badge>
                      : <Badge variant="secondary">Entwurf</Badge>}
                    {r.require_ack && <Badge variant="outline">Bestätigung erforderlich</Badge>}
                    {r.priority !== 0 && <Badge variant="outline">Prio {r.priority}</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 whitespace-pre-wrap">
                    {r.body || <em>Kein Text</em>}
                  </p>
                  {r.link_url && (
                    <a
                      href={r.link_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary mt-2 underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {r.link_label || r.link_url}
                    </a>
                  )}
                  <div className="text-xs text-muted-foreground mt-2">
                    Veröffentlicht ab {new Date(r.publish_at).toLocaleString('de-DE')}
                    {r.expires_at ? ` · läuft ab am ${new Date(r.expires_at).toLocaleString('de-DE')}` : ''}
                  </div>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <Button variant="outline" size="sm" onClick={() => togglePublish(r)}>
                    {r.published ? <><EyeOff className="h-4 w-4 mr-2" />Verbergen</> : <><Eye className="h-4 w-4 mr-2" />Veröffentlichen</>}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openEdit(r)}>
                    <Pencil className="h-4 w-4 mr-2" /> Bearbeiten
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => setToDelete(r)}>
                    <Trash2 className="h-4 w-4 mr-2" /> Löschen
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {/* Edit-Dialog */}
      <Dialog open={!!editing} onOpenChange={(v) => { if (!v) { setEditing(null); setPreviewUrl(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'News bearbeiten' : 'Neue News anlegen'}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Titel *</Label>
                <Input
                  id="title"
                  value={editing.title ?? ''}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="body">Text</Label>
                <Textarea
                  id="body"
                  rows={8}
                  value={editing.body ?? ''}
                  onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                  placeholder="Nachricht für die Mitarbeiter…"
                />
              </div>

              <div className="space-y-2">
                <Label>Bild</Label>
                {previewUrl && (
                  <div className="flex items-start gap-3">
                    <img src={previewUrl} alt="" className="max-h-40 rounded-md border border-border" />
                    <Button variant="outline" size="sm" onClick={removeImage}>
                      <Trash2 className="h-4 w-4 mr-2" /> Entfernen
                    </Button>
                  </div>
                )}
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadImage(f);
                      e.currentTarget.value = '';
                    }}
                  />
                  <Button asChild variant="outline" size="sm" disabled={uploading}>
                    <span>
                      {uploading
                        ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Lade hoch…</>
                        : <><ImagePlus className="h-4 w-4 mr-2" /> Bild hochladen</>}
                    </span>
                  </Button>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="link_url">Link-URL</Label>
                  <Input
                    id="link_url"
                    value={editing.link_url ?? ''}
                    onChange={(e) => setEditing({ ...editing, link_url: e.target.value })}
                    placeholder="https://…"
                  />
                </div>
                <div>
                  <Label htmlFor="link_label">Link-Beschriftung</Label>
                  <Input
                    id="link_label"
                    value={editing.link_label ?? ''}
                    onChange={(e) => setEditing({ ...editing, link_label: e.target.value })}
                    placeholder="Mehr erfahren"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="publish_at">Veröffentlichen ab</Label>
                  <Input
                    id="publish_at"
                    type="datetime-local"
                    value={toLocalInput(editing.publish_at)}
                    onChange={(e) => setEditing({ ...editing, publish_at: fromLocalInput(e.target.value) ?? new Date().toISOString() })}
                  />
                </div>
                <div>
                  <Label htmlFor="expires_at">Läuft ab (optional)</Label>
                  <Input
                    id="expires_at"
                    type="datetime-local"
                    value={toLocalInput(editing.expires_at)}
                    onChange={(e) => setEditing({ ...editing, expires_at: fromLocalInput(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor="priority">Priorität (höher = zuerst)</Label>
                  <Input
                    id="priority"
                    type="number"
                    value={editing.priority ?? 0}
                    onChange={(e) => setEditing({ ...editing, priority: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label className="text-base">Bestätigung erforderlich</Label>
                  <p className="text-sm text-muted-foreground">
                    Popup bleibt offen, bis Mitarbeiter angekreuzt hat.
                  </p>
                </div>
                <Switch
                  checked={editing.require_ack !== false}
                  onCheckedChange={(v) => setEditing({ ...editing, require_ack: v })}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label className="text-base">Veröffentlicht</Label>
                  <p className="text-sm text-muted-foreground">
                    Nur veröffentlichte News werden Mitarbeitern angezeigt.
                  </p>
                </div>
                <Switch
                  checked={!!editing.published}
                  onCheckedChange={(v) => setEditing({ ...editing, published: v })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditing(null); setPreviewUrl(null); }}>
              Abbrechen
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Speichern…</> : 'Speichern'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(v) => { if (!v) setToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>News löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              „{toDelete?.title}" wird endgültig entfernt. Bereits gesetzte Bestätigungen gehen verloren.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete}>Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

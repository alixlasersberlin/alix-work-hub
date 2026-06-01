import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Paperclip, Send, Download, Trash2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

export type QmEntityType = 'bug' | 'capa' | 'audit_finding' | 'capa_action';

type Comment = {
  id: string;
  comment_text: string;
  created_at: string;
  created_by: string | null;
};

type Attachment = {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  uploaded_by: string | null;
  created_at: string;
};

export function QmDetailDrawer({
  open,
  onOpenChange,
  entityType,
  entityId,
  title,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entityType: QmEntityType;
  entityId: string | null;
  title: string;
}) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!entityId) return;
    const sb = supabase as any;
    const [c, a] = await Promise.all([
      sb.from('qm_comments').select('*').eq('entity_type', entityType).eq('entity_id', entityId).order('created_at', { ascending: true }),
      sb.from('qm_attachments').select('*').eq('entity_type', entityType).eq('entity_id', entityId).order('created_at', { ascending: false }),
    ]);
    setComments((c.data ?? []) as Comment[]);
    setAttachments((a.data ?? []) as Attachment[]);
  }, [entityType, entityId]);

  useEffect(() => { if (open) load(); }, [open, load]);

  async function addComment() {
    if (!text.trim() || !entityId || !user) return;
    setBusy(true);
    const { error } = await (supabase as any).from('qm_comments').insert({
      entity_type: entityType,
      entity_id: entityId,
      comment_text: text.trim(),
      created_by: user.id,
    });
    setBusy(false);
    if (error) { toast.error('Kommentar fehlgeschlagen: ' + error.message); return; }
    setText('');
    load();
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !entityId || !user) return;
    if (file.size > 25 * 1024 * 1024) { toast.error('Datei zu groß (max 25 MB)'); return; }
    setBusy(true);
    const path = `${entityType}/${entityId}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, '_')}`;
    const up = await supabase.storage.from('bug-capa-attachments').upload(path, file, { upsert: false });
    if (up.error) { setBusy(false); toast.error('Upload fehlgeschlagen: ' + up.error.message); return; }
    const { error } = await (supabase as any).from('qm_attachments').insert({
      entity_type: entityType,
      entity_id: entityId,
      file_name: file.name,
      file_path: path,
      file_type: file.type || null,
      uploaded_by: user.id,
    });
    setBusy(false);
    if (error) { toast.error('Speichern fehlgeschlagen: ' + error.message); return; }
    toast.success('Datei hochgeladen');
    load();
  }

  async function download(att: Attachment) {
    const { data, error } = await supabase.storage.from('bug-capa-attachments').createSignedUrl(att.file_path, 60);
    if (error || !data) { toast.error('Download fehlgeschlagen'); return; }
    window.open(data.signedUrl, '_blank');
  }

  async function removeAttachment(att: Attachment) {
    if (!confirm(`„${att.file_name}" wirklich löschen?`)) return;
    await supabase.storage.from('bug-capa-attachments').remove([att.file_path]);
    await (supabase as any).from('qm_attachments').delete().eq('id', att.id);
    load();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Anhänge ({attachments.length})</h3>
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
                <Paperclip className="h-4 w-4 mr-1" /> Hochladen
              </Button>
              <input ref={fileRef} type="file" className="hidden" onChange={onUpload} />
            </div>
            {attachments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Anhänge.</p>
            ) : (
              <ul className="space-y-1">
                {attachments.map(a => (
                  <li key={a.id} className="flex items-center justify-between gap-2 rounded border border-border p-2 text-sm">
                    <span className="flex items-center gap-2 truncate"><FileText className="h-4 w-4 shrink-0" /> <span className="truncate">{a.file_name}</span></span>
                    <span className="flex items-center gap-1 shrink-0">
                      <Button size="icon" variant="ghost" onClick={() => download(a)}><Download className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => removeAttachment(a)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <Separator />

          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Kommentare &amp; Verlauf ({comments.length})
            </h3>
            <div className="space-y-3 mb-3 max-h-[40vh] overflow-y-auto pr-1">
              {comments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Noch keine Kommentare.</p>
              ) : comments.map(c => (
                <div key={c.id} className="rounded-md border border-border p-3 bg-muted/30">
                  <div className="text-xs text-muted-foreground mb-1">
                    {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: de })}
                  </div>
                  <div className="text-sm whitespace-pre-wrap">{c.comment_text}</div>
                </div>
              ))}
            </div>
            <Textarea rows={3} value={text} onChange={e => setText(e.target.value)} placeholder="Kommentar hinzufügen…" />
            <div className="flex justify-end mt-2">
              <Button size="sm" onClick={addComment} disabled={busy || !text.trim()}>
                <Send className="h-4 w-4 mr-1" /> Senden
              </Button>
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

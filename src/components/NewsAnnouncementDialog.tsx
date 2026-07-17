import { useEffect, useState, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, Megaphone, ExternalLink } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

type NewsPost = {
  id: string;
  title: string;
  body: string;
  image_path: string | null;
  link_url: string | null;
  link_label: string | null;
  priority: number;
  require_ack: boolean;
  publish_at: string;
  expires_at: string | null;
};

/**
 * Globales Popup, das nach jedem Login (bzw. bei jedem Mount, solange
 * ungelesene News existieren) angezeigt wird. Der Mitarbeiter muss die
 * Bestätigung ankreuzen — sonst öffnet sich das Fenster erneut.
 */
export default function NewsAnnouncementDialog() {
  const { user } = useAuth();
  const [items, setItems] = useState<NewsPost[]>([]);
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [ack, setAck] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signedImageUrl, setSignedImageUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const nowIso = new Date().toISOString();
    const { data: posts, error } = await supabase
      .from('news_posts')
      .select('id,title,body,image_path,link_url,link_label,priority,require_ack,publish_at,expires_at')
      .eq('published', true)
      .lte('publish_at', nowIso)
      .order('priority', { ascending: false })
      .order('publish_at', { ascending: false });
    if (error || !posts?.length) { setItems([]); return; }
    const active = (posts as NewsPost[]).filter(
      (p) => !p.expires_at || new Date(p.expires_at).getTime() > Date.now(),
    );
    const ids = active.map((p) => p.id);
    if (!ids.length) { setItems([]); return; }
    const { data: acks } = await supabase
      .from('news_acknowledgements')
      .select('news_id')
      .eq('user_id', user.id)
      .in('news_id', ids);
    const ackSet = new Set((acks ?? []).map((a: any) => a.news_id));
    const pending = active.filter((p) => !ackSet.has(p.id));
    setItems(pending);
    setIndex(0);
    setAck(false);
    if (pending.length === 0) { setOpen(false); return; }
    // Warten bis kein anderer modaler Dialog (z.B. WelcomeDialog) mehr offen ist,
    // damit sich die Dialoge nicht stapeln und Pointer-Events blockieren.
    const tryOpen = () => {
      const others = document.querySelectorAll<HTMLElement>('[role="dialog"][data-state="open"]');
      if (others.length === 0) {
        setOpen(true);
      } else {
        window.setTimeout(tryOpen, 400);
      }
    };
    window.setTimeout(tryOpen, 500);
  }, [user?.id]);

  useEffect(() => { void load(); }, [load]);

  // Bild-URL (Signed URL, weil Bucket privat) für aktuelles Item laden.
  useEffect(() => {
    const cur = items[index];
    if (!cur?.image_path) { setSignedImageUrl(null); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.storage
        .from('news-images')
        .createSignedUrl(cur.image_path!, 60 * 60 * 6);
      if (!cancelled) setSignedImageUrl(data?.signedUrl ?? null);
    })();
    return () => { cancelled = true; };
  }, [items, index]);

  const current = items[index];

  const confirm = async () => {
    if (!current || !user?.id) return;
    setSaving(true);
    const { error } = await supabase.from('news_acknowledgements').insert({
      news_id: current.id,
      user_id: user.id,
    });
    setSaving(false);
    if (error && !error.message.toLowerCase().includes('duplicate')) {
      return;
    }
    if (index + 1 < items.length) {
      setIndex(index + 1);
      setAck(false);
    } else {
      setOpen(false);
      setItems([]);
    }
  };

  if (!current) return null;

  const mustAck = current.require_ack !== false;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        // Schließen nur zulassen, wenn keine Bestätigung erforderlich ist
        // ODER bereits bestätigt wurde.
        if (!v && mustAck) return;
        setOpen(v);
      }}
    >
      <DialogContent
        className="max-w-2xl"
        onEscapeKeyDown={(e) => { if (mustAck) e.preventDefault(); }}
        onPointerDownOutside={(e) => { if (mustAck) e.preventDefault(); }}
        onInteractOutside={(e) => { if (mustAck) e.preventDefault(); }}
      >
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <Megaphone className="h-5 w-5" />
            <Badge variant="secondary" className="text-xs">
              News {index + 1} / {items.length}
            </Badge>
          </div>
          <DialogTitle className="text-2xl leading-tight">{current.title}</DialogTitle>
          <DialogDescription className="sr-only">Wichtige Mitteilung – bitte lesen und bestätigen.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {signedImageUrl && (
            <img
              src={signedImageUrl}
              alt=""
              className="w-full rounded-lg border border-border object-cover max-h-72"
            />
          )}
          {current.body && (
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {current.body}
            </div>
          )}
          {current.link_url && (
            <a
              href={current.link_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-primary underline underline-offset-4 hover:opacity-80"
            >
              <ExternalLink className="h-4 w-4" />
              {current.link_label || current.link_url}
            </a>
          )}
        </div>

        <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <Checkbox
              checked={ack}
              onCheckedChange={(v) => setAck(v === true)}
              className="mt-0.5"
            />
            <span className="text-sm">
              Ich habe die News gesehen und verstanden.
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button
            onClick={confirm}
            disabled={saving || (mustAck && !ack)}
            className="min-w-40"
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Speichern…</>
            ) : (
              index + 1 < items.length ? 'Weiter zur nächsten News' : 'Bestätigen und schließen'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

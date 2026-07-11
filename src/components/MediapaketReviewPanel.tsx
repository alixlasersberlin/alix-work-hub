import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, MessageSquare, History as HistoryIcon, Lock, Mail } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_OPTIONS = [
  { value: 'not_started', label: 'Nicht begonnen' },
  { value: 'in_progress', label: 'In Bearbeitung' },
  { value: 'question_required', label: 'Rückfrage nötig' },
  { value: 'customer_correction', label: 'Korrektur beim Kunden' },
  { value: 'submitted', label: 'Eingereicht' },
  { value: 'in_review', label: 'In Prüfung' },
  { value: 'approval_pending', label: 'Freigabe ausstehend' },
  { value: 'in_production', label: 'In Produktion' },
  { value: 'completed', label: 'Abgeschlossen' },
];

export const SECTION_OPTIONS = [
  { value: 'services', label: 'Leistungsauswahl' },
  { value: 'studio', label: 'Studio-Daten' },
  { value: 'devices', label: 'Geräte' },
  { value: 'prices', label: 'Preisliste' },
  { value: 'contact', label: 'Kontaktdaten' },
  { value: 'hours', label: 'Öffnungszeiten' },
  { value: 'treatments', label: 'Fremdbehandlungen' },
  { value: 'team', label: 'Team / Über mich' },
  { value: 'branding', label: 'Branding / Anmerkungen' },
  { value: 'files', label: 'Dateien' },
  { value: 'consents', label: 'Einwilligungen' },
];

export const SECTION_LABEL: Record<string, string> = Object.fromEntries(
  SECTION_OPTIONS.map(o => [o.value, o.label])
);

interface Props {
  mpId: string;
  currentStatus: string;
  onChanged: () => void;
}

export default function MediapaketReviewPanel({ mpId, currentStatus, onChanged }: Props) {
  const [status, setStatus] = useState(currentStatus);
  const [savingStatus, setSavingStatus] = useState(false);

  const [comments, setComments] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [newSubject, setNewSubject] = useState('');
  const [newComment, setNewComment] = useState('');
  const [newSection, setNewSection] = useState<string>('__none__');
  const [internalOnly, setInternalOnly] = useState(false);
  const [posting, setPosting] = useState(false);

  const load = async () => {
    setLoading(true);
    const [c, h] = await Promise.all([
      supabase.from('media_package_comments').select('*').eq('media_package_id', mpId).order('created_at', { ascending: false }),
      supabase.from('media_package_history').select('*').eq('media_package_id', mpId).order('created_at', { ascending: false }).limit(50),
    ]);
    setComments(c.data || []);
    setHistory(h.data || []);
    setLoading(false);
  };

  useEffect(() => { setStatus(currentStatus); }, [currentStatus]);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [mpId]);

  const saveStatus = async () => {
    if (status === currentStatus) return;
    setSavingStatus(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from('media_packages').update({ status: status as any }).eq('id', mpId);
    if (error) { toast.error(error.message); setSavingStatus(false); return; }
    await supabase.from('media_package_history').insert({
      media_package_id: mpId,
      user_id: userData.user?.id,
      action: 'status_changed',
      field_name: 'status',
      old_value: currentStatus as any,
      new_value: status as any,
    });
    toast.success('Status aktualisiert');
    setSavingStatus(false);
    onChanged();
    load();
  };

  const postComment = async () => {
    if (!newComment.trim()) return;
    setPosting(true);
    const { data: userData } = await supabase.auth.getUser();
    const { data: inserted, error } = await supabase.from('media_package_comments').insert({
      media_package_id: mpId,
      author_id: userData.user?.id,
      author_type: 'staff',
      recipient_type: internalOnly ? 'staff' : 'customer',
      subject: newSubject || null,
      comment: newComment.trim(),
      internal_only: internalOnly,
      related_field: newSection && newSection !== '__none__' ? newSection : null,
    }).select('id').single();
    if (error) { toast.error(error.message); setPosting(false); return; }
    await supabase.from('media_package_history').insert({
      media_package_id: mpId,
      user_id: userData.user?.id,
      action: internalOnly ? 'internal_comment_added' : 'question_sent',
    });
    // Auto-set status when sending customer question
    if (!internalOnly && status !== 'question_required' && status !== 'customer_correction') {
      await supabase.from('media_packages').update({ status: 'question_required' as any }).eq('id', mpId);
      onChanged();
    }
    // Auto-notify customer by email
    if (!internalOnly && inserted?.id) {
      try {
        const { error: mailErr } = await supabase.functions.invoke('mediapaket-portal?action=notify_question', {
          body: { mp_id: mpId, comment_id: inserted.id, base_url: window.location.origin },
        });
        if (mailErr) toast.warning(`Kommentar gespeichert, E-Mail-Versand fehlgeschlagen: ${mailErr.message}`);
        else toast.success('Rückfrage an Kunde gesendet (per E-Mail benachrichtigt)');
      } catch (e: any) {
        toast.warning(`Kommentar gespeichert, E-Mail-Versand fehlgeschlagen: ${e.message}`);
      }
    } else {
      toast.success(internalOnly ? 'Interner Kommentar gespeichert' : 'Rückfrage an Kunde gespeichert');
    }
    setNewComment('');
    setNewSubject('');
    setNewSection('__none__');
    setPosting(false);
    load();
  };

  return (
    <div className="space-y-4">
      {/* Status */}
      <div className="rounded-xl border border-border bg-card p-4 card-glow">
        <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          Bearbeitungsstatus
        </h4>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={saveStatus} disabled={savingStatus || status === currentStatus} className="gold-gradient text-primary-foreground">
            {savingStatus ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Status speichern
          </Button>
        </div>
      </div>

      {/* New comment */}
      <div className="rounded-xl border border-border bg-card p-4 card-glow">
        <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <MessageSquare className="w-4 h-4" /> Rückfrage / Kommentar
        </h4>
        <Input
          placeholder="Betreff (optional)"
          value={newSubject}
          onChange={e => setNewSubject(e.target.value)}
          className="bg-secondary border-border mb-2"
        />
        <div className="mb-2">
          <Label className="text-xs text-muted-foreground">Bezug (optional)</Label>
          <Select value={newSection} onValueChange={setNewSection}>
            <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Kein Bezug" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Kein Bezug</SelectItem>
              {SECTION_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Textarea
          placeholder={internalOnly ? 'Interne Notiz für Team...' : 'Rückfrage an den Kunden formulieren...'}
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          className="bg-secondary border-border mb-3"
          rows={3}
        />
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Checkbox id="mp-internal" checked={internalOnly} onCheckedChange={v => setInternalOnly(!!v)} />
            <Label htmlFor="mp-internal" className="text-sm cursor-pointer flex items-center gap-1">
              <Lock className="w-3 h-3" /> Nur intern (nicht sichtbar für Kunde)
            </Label>
          </div>
          <Button onClick={postComment} disabled={posting || !newComment.trim()} size="sm" className="gold-gradient text-primary-foreground">
            {posting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            {internalOnly ? 'Intern speichern' : 'An Kunde senden'}
          </Button>
        </div>
      </div>

      {/* Thread */}
      <div className="rounded-xl border border-border bg-card p-4 card-glow">
        <h4 className="text-sm font-semibold text-foreground mb-3">Kommentare & Rückfragen ({comments.length})</h4>
        {loading ? (
          <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Lade...</div>
        ) : comments.length === 0 ? (
          <p className="text-xs text-muted-foreground">Noch keine Kommentare.</p>
        ) : (
          <div className="space-y-3">
            {comments.map(c => (
              <div key={c.id} className="rounded-lg border border-border/60 bg-secondary/30 p-3">
                <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="outline" className="capitalize">{c.author_type}</Badge>
                    {c.internal_only ? (
                      <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30"><Lock className="w-3 h-3 mr-1" />Intern</Badge>
                    ) : (
                      <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30"><Mail className="w-3 h-3 mr-1" />An {c.recipient_type}</Badge>
                    )}
                    {c.answered_at && <Badge className="bg-green-500/20 text-green-500 border-green-500/30">beantwortet</Badge>}
                  </div>
                  <span className="text-[11px] text-muted-foreground">{new Date(c.created_at).toLocaleString('de-DE')}</span>
                </div>
                {c.subject && <div className="text-sm font-medium text-foreground">{c.subject}</div>}
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{c.comment}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* History */}
      <div className="rounded-xl border border-border bg-card p-4 card-glow">
        <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <HistoryIcon className="w-4 h-4" /> Verlauf
        </h4>
        {history.length === 0 ? (
          <p className="text-xs text-muted-foreground">Kein Verlauf.</p>
        ) : (
          <div className="space-y-1.5 text-xs">
            {history.map(h => (
              <div key={h.id} className="flex justify-between gap-2 border-b border-border/40 py-1">
                <span>
                  <span className="text-foreground font-medium">{h.action}</span>
                  {h.field_name && <span className="text-muted-foreground"> · {h.field_name}: {String(h.old_value ?? '—')} → {String(h.new_value ?? '—')}</span>}
                </span>
                <span className="text-muted-foreground">{new Date(h.created_at).toLocaleString('de-DE')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

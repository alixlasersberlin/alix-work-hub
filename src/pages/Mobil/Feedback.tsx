/**
 * PILOT FEEDBACK (Prompt 9, Punkt 53–58)
 * Keine Kundendaten werden automatisch mitgesendet; nur technische Angaben.
 */
import { useEffect, useState } from 'react';
import { MessageSquarePlus, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { haptic } from '@/lib/mobil/haptics';
import { fetchFeedback, sendFeedback, type FeedbackCategory, type MobileFeedback } from '@/lib/mobil/golive';
import { APP_BUILD, APP_VERSION_MOBILE, ENVIRONMENT } from '@/lib/mobil/appInfo';

const CATEGORIES: { key: FeedbackCategory; label: string }[] = [
  { key: 'PROBLEM', label: 'Problem melden' },
  { key: 'VERBESSERUNG', label: 'Verbesserung vorschlagen' },
  { key: 'UX', label: 'UX-Feedback' },
];

export default function MobilFeedback() {
  const [category, setCategory] = useState<FeedbackCategory>('PROBLEM');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<MobileFeedback[]>([]);

  const load = async () => { try { setRows(await fetchFeedback()); } catch { /* ignore */ } };
  useEffect(() => { void load(); }, []);

  const submit = async () => {
    if (message.trim().length < 5) { toast.error('Bitte kurz beschreiben.'); return; }
    setBusy(true);
    try {
      await sendFeedback({ category, message: message.trim(), screen: document.referrer || window.location.pathname });
      haptic('success');
      toast.success('Danke – Ihr Feedback wurde übermittelt.');
      setMessage('');
      void load();
    } catch (e: any) { toast.error(e.message ?? 'Übermittlung fehlgeschlagen'); }
    setBusy(false);
  };

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <MessageSquarePlus className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-bold">Feedback</h1>
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => setCategory(c.key)}
              className={`px-3 py-1.5 rounded-full text-xs border ${category === c.key ? 'bg-primary text-primary-foreground border-primary' : 'border-border'}`}
            >{c.label}</button>
          ))}
        </div>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Was ist passiert bzw. was sollte besser sein?"
          className="min-h-[120px]"
        />
        <p className="text-[11px] text-muted-foreground">
          Bitte keine Kundendaten eintragen. Falls Sie später einen Screenshot ergänzen:
          prüfen Sie vorher, ob sensible Kundendaten sichtbar sind.
        </p>
        <div className="text-[11px] text-muted-foreground">
          Automatisch übermittelt: {APP_VERSION_MOBILE} · Build {APP_BUILD} · {ENVIRONMENT} · Gerätetyp
        </div>
        <Button className="w-full h-11" onClick={() => void submit()} disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Absenden
        </Button>
      </Card>

      {rows.length > 0 && (
        <Card className="p-4 space-y-2">
          <div className="text-xs font-semibold tracking-widest text-muted-foreground">MEINE MELDUNGEN</div>
          {rows.map((r) => (
            <div key={r.id} className="flex items-start gap-2 text-sm border-b border-border/50 pb-2 last:border-0">
              <div className="min-w-0 flex-1">
                <div className="break-words">{r.message}</div>
                <div className="text-[11px] text-muted-foreground">
                  {new Date(r.created_at).toLocaleString('de-DE')} · {r.category}
                </div>
              </div>
              <Badge variant="outline" className="text-[10px]">{r.status}</Badge>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

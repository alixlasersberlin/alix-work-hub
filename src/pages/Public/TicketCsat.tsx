import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, Star } from 'lucide-react';
import { toast } from 'sonner';

const FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ticket-csat-submit`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export default function TicketCsat() {
  const { token = '' } = useParams();
  const [state, setState] = useState<{ loading: boolean; already: boolean; ticket?: string; subject?: string; error?: string }>({ loading: true, already: false });
  const [rating, setRating] = useState<number>(0);
  const [hover, setHover] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const preset = new URLSearchParams(window.location.search).get('r');
    if (preset && /^[1-5]$/.test(preset)) setRating(Number(preset));
    (async () => {
      try {
        const r = await fetch(`${FN}?token=${encodeURIComponent(token)}`, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } });
        const j = await r.json();
        if (!r.ok) return setState({ loading: false, already: false, error: j?.error || 'error' });
        setState({ loading: false, already: !!j.already, ticket: j.ticket_number, subject: j.subject });
        if (j.already && j.rating) setRating(j.rating);
      } catch { setState({ loading: false, already: false, error: 'network' }); }
    })();
  }, [token]);

  const submit = async () => {
    if (!rating) return toast.error('Bitte eine Bewertung wählen.');
    setSending(true);
    try {
      const r = await fetch(`${FN}?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}` },
        body: JSON.stringify({ rating, comment: comment.trim() || null }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'error');
      setDone(true);
    } catch (e: any) { toast.error('Konnte Bewertung nicht speichern: ' + e.message); }
    finally { setSending(false); }
  };

  if (state.loading) return <Wrap><p className="text-sm text-muted-foreground">Wird geladen…</p></Wrap>;
  if (state.error === 'not_found') return <Wrap><p className="text-sm">Diese Umfrage wurde nicht gefunden.</p></Wrap>;
  if (state.error === 'expired') return <Wrap><p className="text-sm">Diese Umfrage ist abgelaufen.</p></Wrap>;
  if (done || state.already) return (
    <Wrap>
      <div className="text-center py-6 space-y-2">
        <CheckCircle2 className="w-12 h-12 mx-auto text-primary" />
        <div className="font-semibold">Vielen Dank für Ihre Bewertung!</div>
        <div className="text-sm text-muted-foreground">Ihre Rückmeldung hilft uns, besser zu werden.</div>
      </div>
    </Wrap>
  );

  return (
    <Wrap>
      <div className="text-sm text-muted-foreground mb-1">Ticket {state.ticket}</div>
      {state.subject && <div className="text-sm mb-4 line-clamp-2">„{state.subject}"</div>}
      <div className="text-center mb-4">
        <div className="font-medium mb-3">Wie zufrieden waren Sie mit der Bearbeitung?</div>
        <div className="flex justify-center gap-2">
          {[1,2,3,4,5].map(n => (
            <button key={n} type="button"
              onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)}
              onClick={() => setRating(n)}
              className="p-2 transition-transform hover:scale-110">
              <Star className={`w-9 h-9 ${(hover || rating) >= n ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
            </button>
          ))}
        </div>
        <div className="text-xs text-muted-foreground mt-1">{rating ? `${rating} von 5 Sternen` : 'Bitte wählen'}</div>
      </div>
      <Textarea placeholder="Kommentar (optional)" value={comment} onChange={e => setComment(e.target.value)} rows={4} className="mb-4" />
      <Button className="w-full" disabled={!rating || sending} onClick={submit}>{sending ? 'Wird gespeichert…' : 'Bewertung absenden'}</Button>
    </Wrap>
  );
}

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader><CardTitle className="text-base">Ihre Meinung ist uns wichtig</CardTitle></CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}

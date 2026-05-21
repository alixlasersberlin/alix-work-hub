import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Heart, Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const TARGET_EMAIL = 'l.scheidler@alix-operation.de';

const GAY_QUOTES = [
  'Sei du selbst – alle anderen sind schon vergeben. – Oscar Wilde',
  'We are all in the gutter, but some of us are looking at the stars. – Oscar Wilde',
  'Werd nicht erwachsen, es ist eine Falle, Honey.',
  'Glitzer ist auch ein neutraler Farbton, Schatz.',
  'Wer fabulous sein will, muss leiden – aber mit Stil.',
  'Heels hoch, Kinn hoch, Standards hoch.',
  'Das Leben ist zu kurz für schlechte Outfits und schlechte Männer.',
  'Yes Queen – heute regiert wieder Eleganz.',
  'Slay first, ask questions later.',
  'Drama ist nur Energie, die noch nicht choreografiert ist.',
  'Werde, wer du bist – nur in fabelhafter.',
  'Sashay through the day, Sugar.',
  'Wenn sie reden, hast du längst getanzt.',
  'Sei das Glitzer im Kaffee dieser Welt.',
  'Lieber overdressed als underwhelmed.',
];

function getDayQuote(): string {
  const start = new Date(new Date().getFullYear(), 0, 0);
  const day = Math.floor((Date.now() - start.getTime()) / 86400000);
  return GAY_QUOTES[day % GAY_QUOTES.length];
}

type OpenRequest = {
  id: string;
  request_date: string | null;
  created_at: string;
  status: string;
  order_number: string | null;
  customer: string | null;
};

export default function LeoWelcomeDialog() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<OpenRequest[]>([]);
  const [blink, setBlink] = useState(false);

  const quote = useMemo(() => getDayQuote(), []);

  useEffect(() => {
    if (!user?.email) return;
    if (user.email.toLowerCase() !== TARGET_EMAIL) return;

    // Open immediately on every login/mount, then load data in background
    setOpen(true);
    setLoading(true);

    let cancelled = false;
    (async () => {
      try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
        const { data, error } = await supabase
          .from('bank_financing_requests')
          .select('id, request_date, created_at, status, orders(order_number, customers(company_name, contact_name))')
          .in('status', ['pending', 'in_review'])
          .lt('created_at', sevenDaysAgo)
          .order('created_at', { ascending: true });
        if (cancelled) return;
        if (!error && data) {
          const mapped: OpenRequest[] = (data as any[]).map(r => {
            const refDate = r.request_date ? new Date(r.request_date) : new Date(r.created_at);
            const cust = r.orders?.customers;
            return {
              id: r.id,
              request_date: refDate.toISOString(),
              created_at: r.created_at,
              status: r.status,
              order_number: r.orders?.order_number ?? null,
              customer: cust?.company_name || cust?.contact_name || null,
            };
          }).filter(r => {
            const ageMs = Date.now() - new Date(r.request_date || r.created_at).getTime();
            return ageMs > 7 * 86400000;
          });
          setRequests(mapped);
        }
      } catch (e) {
        console.error('[LeoWelcomeDialog] load failed', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, user?.email]);

  // Blink every second for 15 seconds whenever dialog opens
  useEffect(() => {
    if (!open) {
      setBlink(false);
      return;
    }
    setBlink(true);
    const interval = setInterval(() => setBlink(b => !b), 1000);
    const stop = setTimeout(() => {
      clearInterval(interval);
      setBlink(false);
    }, 15000);
    return () => {
      clearInterval(interval);
      clearTimeout(stop);
    };
  }, [open]);

  if (!user?.email || user.email.toLowerCase() !== TARGET_EMAIL) return null;

  const daysAgo = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="max-w-2xl max-h-[85vh] overflow-y-auto border-4 transition-all duration-200"
        style={{
          background: blink
            ? 'linear-gradient(135deg, #ff00aa 0%, #ff1493 50%, #ff66c4 100%)'
            : 'linear-gradient(135deg, #ff1493 0%, #ff69b4 50%, #ffb6d9 100%)',
          borderColor: blink ? '#fff200' : '#ff1493',
          boxShadow: blink
            ? '0 0 60px 12px rgba(255, 20, 147, 0.9), 0 0 120px 24px rgba(255, 242, 0, 0.5)'
            : '0 10px 40px rgba(255, 20, 147, 0.4)',
          color: '#3a0024',
          zIndex: 9999,
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-3xl font-extrabold" style={{ color: '#ffffff', textShadow: '0 2px 8px rgba(255,20,147,0.7)' }}>
            <Sparkles className="w-7 h-7" style={{ color: '#fff59d' }} />
            Hallöle Sugar Babe
            <Heart className="w-6 h-6 fill-current" style={{ color: '#ff0066' }} />
          </DialogTitle>
          <DialogDescription style={{ color: '#fff0f7' }}>
            Deine offenen Bank-Anfragen, die älter als 7 Tage sind 💅
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#ffffff' }} />
            </div>
          ) : requests.length === 0 ? (
            <div className="rounded-xl p-6 text-center font-semibold" style={{ background: 'rgba(255,255,255,0.85)', color: '#a8005a' }}>
              Alles flawless, Honey – keine alten offenen Anfragen! 💖
            </div>
          ) : (
            <ul className="rounded-xl divide-y" style={{ background: 'rgba(255,255,255,0.92)', borderColor: '#ff1493' }}>
              {requests.map(r => (
                <li key={r.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div className="flex flex-col">
                    <span className="font-bold" style={{ color: '#a8005a' }}>{r.order_number || '—'}</span>
                    <span className="text-xs" style={{ color: '#7a0044' }}>{r.customer || 'Kunde unbekannt'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      style={{ background: '#ff1493', color: 'white' }}
                    >
                      {r.status === 'in_review' ? 'In Prüfung' : 'Offen'}
                    </Badge>
                    <span className="text-xs font-semibold" style={{ color: '#a8005a' }}>
                      {daysAgo(r.request_date || r.created_at)} Tage alt
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter className="flex-col gap-3 sm:flex-col">
          <div
            className="w-full rounded-xl p-4 text-center"
            style={{
              background: 'linear-gradient(90deg, #ff0066, #ff69b4, #ff00cc)',
              color: 'white',
              boxShadow: '0 4px 14px rgba(255,0,102,0.4)',
            }}
          >
            <p className="text-2xl font-extrabold tracking-wider" style={{ textShadow: '0 2px 6px rgba(0,0,0,0.25)' }}>
              GIB GAS JUNG ✨
            </p>
            <p className="mt-2 text-sm italic" style={{ color: '#fff0f7' }}>
              „{quote}"
            </p>
          </div>
          <Button
            onClick={() => setOpen(false)}
            className="w-full font-bold"
            style={{ background: '#ffffff', color: '#ff1493' }}
          >
            Let's slay 💋
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

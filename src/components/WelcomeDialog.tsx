import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Smile, Warehouse, Truck, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const QUOTES = [
  'Heute ist ein guter Tag, um Großes zu schaffen.',
  'Erfolg ist die Summe kleiner Anstrengungen, Tag für Tag.',
  'Qualität entsteht, wenn niemand hinschaut.',
  'Ein gut geplanter Tag ist ein halb gewonnener Tag.',
  'Teamwork makes the dream work.',
  'Disziplin schlägt Motivation – jeden Tag.',
  'Kleine Schritte führen zu großen Ergebnissen.',
  'Wer den Hafen nicht kennt, für den ist kein Wind günstig.',
  'Heute besser als gestern – das reicht.',
  'Strukturierte Arbeit ist halbe Arbeit.',
  'Ein zufriedener Kunde ist die beste Werbung.',
  'Sorgfalt heute spart Ärger morgen.',
  'Vertrauen kommt zu Fuß und geht zu Pferd – pflege es.',
  'Lass die Arbeit für dich sprechen.',
  'Aus Plan wird Erfolg, wenn man anfängt.',
];

function getDayQuote(): string {
  const start = new Date(new Date().getFullYear(), 0, 0);
  const diff = (Date.now() - start.getTime()) / 86400000;
  const day = Math.floor(diff);
  return QUOTES[day % QUOTES.length];
}

type FreeDevice = {
  id: string;
  serial_number: string;
  model_name: string;
  notes: string | null;
};

function getStatus(notes: string | null | undefined): string {
  const m = /\[Status:\s*([^\]]+)\]/.exec(notes ?? '');
  return (m?.[1] ?? 'Bestand').trim();
}

export default function WelcomeDialog() {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bestand, setBestand] = useState<FreeDevice[]>([]);
  const [transfer, setTransfer] = useState<FreeDevice[]>([]);

  const quote = useMemo(() => getDayQuote(), []);
  const todayStr = useMemo(
    () => new Date().toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }),
    [],
  );

  useEffect(() => {
    if (!user) return;
    const key = `welcome_shown_${user.id}_${new Date().toDateString()}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');

    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('lager_devices')
        .select('id, serial_number, model_name, notes, reserved_order_id')
        .is('reserved_order_id', null);
      if (cancelled) return;
      if (!error && data) {
        const b: FreeDevice[] = [];
        const t: FreeDevice[] = [];
        for (const d of data as any[]) {
          const s = getStatus(d.notes);
          if (s === 'Bestand') b.push(d);
          else if (s === 'Transfer') t.push(d);
        }
        setBestand(b);
        setTransfer(t);
      }
      setLoading(false);
      setOpen(true);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const firstName = (profile?.full_name || user?.email || '').split(' ')[0].split('@')[0];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="w-5 h-5 text-primary" />
            Hallo {firstName || ''} 👋
          </DialogTitle>
          <DialogDescription className="text-xs">{todayStr}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
            <p className="text-sm italic text-foreground">„{quote}"</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <section className="space-y-2">
                <div className="flex items-center gap-2">
                  <Warehouse className="w-4 h-4 text-emerald-500" />
                  <h3 className="font-semibold text-sm">Freie Lagergeräte (Bestand)</h3>
                  <Badge variant="secondary" className="ml-auto">{bestand.length}</Badge>
                </div>
                {bestand.length === 0 ? (
                  <p className="text-xs text-muted-foreground pl-6">Keine freien Lagergeräte.</p>
                ) : (
                  <ul className="rounded-md border border-border divide-y divide-border max-h-48 overflow-y-auto">
                    {bestand.map(d => (
                      <li key={d.id} className="flex items-center justify-between px-3 py-2 text-xs bg-emerald-500/5">
                        <span className="font-medium">{d.model_name}</span>
                        <span className="text-muted-foreground font-mono">{d.serial_number}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="space-y-2">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-yellow-500" />
                  <h3 className="font-semibold text-sm">Freie Geräte unterwegs (Transfer)</h3>
                  <Badge variant="secondary" className="ml-auto">{transfer.length}</Badge>
                </div>
                {transfer.length === 0 ? (
                  <p className="text-xs text-muted-foreground pl-6">Keine freien Geräte im Transfer.</p>
                ) : (
                  <ul className="rounded-md border border-border divide-y divide-border max-h-48 overflow-y-auto">
                    {transfer.map(d => (
                      <li key={d.id} className="flex items-center justify-between px-3 py-2 text-xs bg-yellow-500/5">
                        <span className="font-medium">{d.model_name}</span>
                        <span className="text-muted-foreground font-mono">{d.serial_number}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}

          <div className="rounded-lg bg-secondary/50 p-4 text-center">
            <Smile className="w-8 h-8 text-primary mx-auto mb-2" />
            <p className="text-sm font-medium">Ich wünsche dir einen schönen Tag! 😊</p>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => setOpen(false)} className="w-full">Los geht's</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

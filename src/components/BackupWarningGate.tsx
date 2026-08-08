import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const WARN_BEFORE_MS = 10 * 60 * 1000; // Popup 10 Minuten vorher
const LOGOUT_BEFORE_MS = 4 * 60 * 1000; // Auto-Logout 4 Minuten vor dem Backup

function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export default function BackupWarningGate() {
  const { user, signOut } = useAuth();
  const [nextAt, setNextAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const acknowledgedFor = useRef<number | null>(null);
  const [acked, setAcked] = useState(false);

  useEffect(() => {
    if (!user) { setNextAt(null); return; }
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase.rpc('next_backup_window' as any);
      if (cancelled) return;
      const row = Array.isArray(data) ? data[0] : data;
      const ts = row?.next_at ? new Date(row.next_at).getTime() : null;
      setNextAt(ts);
      if (ts && acknowledgedFor.current !== ts) setAcked(false);
    };
    load();
    const id = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [user]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = nextAt ? nextAt - now : Infinity;
  const visible = !!user && !acked && remaining > 0 && remaining <= WARN_BEFORE_MS;

  useEffect(() => {
    if (visible && remaining <= LOGOUT_BEFORE_MS) {
      signOut();
    }
  }, [visible, remaining, signOut]);

  if (!visible) return null;

  const untilLogout = remaining - LOGOUT_BEFORE_MS;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-xl border-2 border-destructive bg-card shadow-2xl">
        <div className="flex items-center gap-3 rounded-t-lg bg-destructive px-6 py-4 text-destructive-foreground">
          <AlertTriangle className="h-7 w-7 shrink-0 animate-pulse" />
          <h2 className="text-xl font-bold uppercase tracking-wide">Achtung Datensicherung</h2>
        </div>
        <div className="space-y-5 px-6 py-6 text-center">
          <p className="text-base text-foreground">
            Bitte beenden Sie Ihre Arbeiten und speichern diese. Die automatische Datensicherung
            beginnt in 5 Minuten. Sie werden in 4 Minuten automatisch abgemeldet.
          </p>
          <div>
            <div className="font-mono text-5xl font-bold text-destructive tabular-nums">
              {fmt(remaining)}
            </div>
            <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
              bis zur Datensicherung
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Automatische Abmeldung in{' '}
              <span className="font-mono font-semibold text-foreground">
                {fmt(Math.max(0, untilLogout))}
              </span>
            </p>
          </div>
          <Button
            className="w-full"
            variant="destructive"
            onClick={() => { acknowledgedFor.current = nextAt; setAcked(true); }}
          >
            Ich habe alle Arbeiten beendet und gespeichert
          </Button>
        </div>
      </div>
    </div>
  );
}

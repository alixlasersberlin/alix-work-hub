/**
 * ALIXWORK MOBILE – App-Lock & Background-Privacy (Prompt 7, Punkt 13/14).
 *
 * - Sperrt die Oberfläche nach konfigurierter Inaktivität (Default 5 Minuten).
 * - Verdeckt Inhalte, sobald die App in den Hintergrund wechselt (App-Switcher).
 * - Entsperren per Face ID / Touch ID / Android-Biometrie oder App-PIN.
 * - Die Supabase-Session bleibt unangetastet: das ist ein lokaler Sichtschutz,
 *   keine zweite Authentifizierung.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Lock, Fingerprint, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  hasBiometric,
  hasPin,
  lockRequired,
  markActivity,
  unlockWithBiometric,
  verifyPin,
} from '@/lib/mobil/security';

export default function AppLockGate({ children }: { children: React.ReactNode }) {
  const enabled = hasPin() || hasBiometric();
  const [locked, setLocked] = useState(() => (enabled ? lockRequired() : false));
  const [hidden, setHidden] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  const resetTimer = useCallback(() => {
    if (!enabled || locked) return;
    markActivity();
  }, [enabled, locked]);

  useEffect(() => {
    if (!enabled) return;
    const events = ['pointerdown', 'keydown', 'touchstart', 'visibilitychange'] as const;
    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));
    timer.current = window.setInterval(() => {
      if (lockRequired()) setLocked(true);
    }, 15_000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, resetTimer));
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [enabled, resetTimer]);

  // Background Privacy: Inhalte im App-Switcher verdecken
  useEffect(() => {
    const onVis = () => {
      const bg = document.visibilityState === 'hidden';
      setHidden(bg);
      if (bg && enabled) markActivity();
      if (!bg && enabled && lockRequired()) setLocked(true);
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', () => setHidden(true));
    window.addEventListener('focus', () => setHidden(false));
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [enabled]);

  const tryBiometric = async () => {
    setError(null);
    const ok = await unlockWithBiometric();
    if (ok) {
      markActivity();
      setLocked(false);
    } else {
      setError('Biometrische Entsperrung fehlgeschlagen.');
    }
  };

  const tryPin = async () => {
    setError(null);
    if (await verifyPin(pin)) {
      markActivity();
      setPin('');
      setLocked(false);
    } else {
      setError('PIN falsch.');
    }
  };

  return (
    <>
      {children}

      {hidden && !locked && (
        <div className="fixed inset-0 z-[90] bg-background/95 backdrop-blur-xl flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <ShieldCheck className="w-10 h-10 mx-auto text-primary" />
            <div className="mt-2 text-lg font-semibold tracking-wide">ALIXWORK</div>
          </div>
        </div>
      )}

      {locked && (
        <div className="fixed inset-0 z-[100] bg-background/98 backdrop-blur-xl flex flex-col items-center justify-center p-6 gap-4">
          <Lock className="w-10 h-10 text-primary" />
          <div className="text-center">
            <div className="text-lg font-semibold">ALIXWORK gesperrt</div>
            <div className="text-xs text-muted-foreground">Zum Fortfahren bitte entsperren.</div>
          </div>

          {hasBiometric() && (
            <Button className="w-full max-w-xs h-12" onClick={tryBiometric}>
              <Fingerprint className="w-4 h-4 mr-2" /> Biometrisch entsperren
            </Button>
          )}

          {hasPin() && (
            <div className="w-full max-w-xs space-y-2">
              <Input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={6}
                placeholder="App-PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                className="h-12 text-center tracking-[0.5em]"
              />
              <Button variant="outline" className="w-full h-12" onClick={tryPin} disabled={pin.length < 4}>
                Entsperren
              </Button>
            </div>
          )}

          {error && <div className="text-xs text-destructive">{error}</div>}
        </div>
      )}
    </>
  );
}

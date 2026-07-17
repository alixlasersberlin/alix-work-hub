import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ReauthDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  purpose: string;
  reason?: string;
}

/**
 * Zero-Trust Re-Auth: erzwingt eine frische TOTP-Bestätigung vor
 * sensiblen Aktionen (Kundendaten öffnen, Gerätefreigaben, Rollenänderungen,
 * Finance-Freigaben, CAPA-Löschungen etc.).
 *
 * Erfolg wird für 5 Minuten in sessionStorage + in der Tabelle
 * mfa_reauth_events gecached (per purpose), damit Folge-Aktionen nicht
 * erneut abfragen.
 */
export default function ReauthDialog({ open, onClose, onSuccess, purpose, reason }: ReauthDialogProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) { setCode(''); return; }
    (async () => {
      try {
        const { data } = await supabase.auth.mfa.listFactors();
        const totp = (data?.totp ?? []).find((f: any) => f.status === 'verified');
        setFactorId(totp?.id ?? null);
      } catch {
        setFactorId(null);
      }
    })();
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const submit = async () => {
    if (!factorId) {
      toast.error('Keine TOTP-Zweitfaktor eingerichtet.');
      return;
    }
    if (code.trim().length < 6) return;
    setLoading(true);
    try {
      const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
      if (chErr || !challenge) throw new Error(chErr?.message || 'Challenge fehlgeschlagen');
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: code.trim(),
      });
      if (vErr) throw new Error(vErr.message);

      // Server-Nachweis (5 min) + Client-Cache
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      const { data: uData } = await supabase.auth.getUser();
      if (uData?.user?.id) {
        await (supabase as any).from('mfa_reauth_events').insert({
          user_id: uData.user.id,
          method: 'totp',
          purpose,
          expires_at: expiresAt.toISOString(),
          user_agent: navigator.userAgent.slice(0, 200),
        });
      }
      try {
        sessionStorage.setItem(`alixwork.reauth.${purpose}`, String(expiresAt.getTime()));
      } catch { /* ignore */ }
      toast.success('Bestätigt.');
      onSuccess();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || 'Code ungültig.');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div
      role="presentation"
      onMouseDown={() => { if (!loading) onClose(); }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483647,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        background: 'hsl(var(--background) / 0.86)',
        backdropFilter: 'blur(10px)',
        pointerEvents: 'auto',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reauth-dialog-title"
        aria-describedby="reauth-dialog-description"
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl"
        style={{
          position: 'relative',
          zIndex: 2147483647,
          transform: 'none',
          opacity: 1,
          visibility: 'visible',
          pointerEvents: 'auto',
        }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl gold-gradient flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h2 id="reauth-dialog-title" className="text-lg font-semibold leading-none text-foreground">Zusätzliche Bestätigung erforderlich</h2>
            <p id="reauth-dialog-description" className="mt-1 text-xs text-muted-foreground">
              {reason ?? 'Bitte bestätigen Sie mit Ihrem 6-stelligen Authenticator-Code.'}
            </p>
          </div>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); submit(); }}
          className="py-2 space-y-4"
        >
          <div className="space-y-1">
            <Label htmlFor="reauth-code" className="text-xs">Authenticator-Code (6 Ziffern)</Label>
            <Input
              id="reauth-code"
              ref={inputRef}
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              disabled={loading}
              className="text-center tracking-[0.5em] text-lg font-mono"
              placeholder="••••••"
            />
            {!factorId && (
              <p className="text-xs text-destructive">
                Keine aktive TOTP-Zweitfaktor gefunden. Bitte richten Sie 2FA unter „Sicherheit" ein.
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="flex-1"
            >
              Abbrechen
            </Button>
            <Button
              type="submit"
              disabled={loading || code.length < 6 || !factorId}
              className="flex-1 gold-gradient font-semibold"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Bestätigen'}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center">
            Die Bestätigung ist 5 Minuten lang gültig.
          </p>
        </form>
      </div>
    </div>,
    document.body,
  );
}

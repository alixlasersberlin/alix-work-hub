import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, markMfaVerifiedThisTab } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ShieldCheck, Copy, Check, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import alixLogo from '@/assets/alix-logo-gold.png';

type Step = 'enroll' | 'verify' | 'recovery';

export default function MfaSetup() {
  const { signOut, refreshMfaState } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('enroll');
  const [factorId, setFactorId] = useState<string>('');
  const [qr, setQr] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [confirmedSaved, setConfirmedSaved] = useState(false);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        // Clean up any existing unverified factor first
        const { data: existing } = await supabase.auth.mfa.listFactors();
        const unverified = (existing?.totp ?? []).filter((f: any) => f.status !== 'verified');
        for (const f of unverified) await supabase.auth.mfa.unenroll({ factorId: f.id });

        const { data, error } = await supabase.auth.mfa.enroll({
          factorType: 'totp',
          issuer: 'ALIX WORK',
          friendlyName: `ALIX WORK ${Date.now()}`,
        });
        if (error) throw error;
        setFactorId(data.id);
        setQr(data.totp.qr_code);
        setSecret(data.totp.secret);
        setStep('verify');
      } catch (e: any) {
        setErr(e?.message ?? 'Fehler beim Einrichten');
      } finally {
        setBusy(false);
      }
    })();
  }, []);

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
      if (chErr) throw chErr;
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: ch.id,
        code: code.trim(),
      });
      if (vErr) throw vErr;

      // Generate recovery codes
      const { data: rec, error: rErr } = await supabase.functions.invoke('mfa-store-recovery-codes', {});
      if (rErr) throw rErr;
      setRecoveryCodes(rec.codes);
      setStep('recovery');
    } catch (e: any) {
      setErr(e?.message ?? 'Code ungültig');
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    await refreshMfaState();
    navigate('/', { replace: true });
  };

  const copyCodes = async () => {
    await navigator.clipboard.writeText(recoveryCodes.join('\n'));
    toast.success('Recovery-Codes kopiert');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-6">
          <img src={alixLogo} alt="Alix Work" className="h-14 w-auto mx-auto mb-3 object-contain" />
          <h1 className="text-xl font-semibold flex items-center justify-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Zwei-Faktor-Authentifizierung
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pflicht-Setup für Ihren Zugang zu ALIX WORK
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 card-glow space-y-5">
          {busy && step === 'enroll' && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          )}

          {step === 'verify' && (
            <>
              <div className="text-sm text-muted-foreground">
                <p className="mb-2">1. Öffnen Sie eine Authenticator-App (Google Authenticator, Authy, 1Password …).</p>
                <p>2. Scannen Sie den QR-Code oder geben Sie den Schlüssel manuell ein.</p>
              </div>

              {qr && (
                <div className="flex justify-center bg-white rounded-lg p-3">
                  <img src={qr} alt="QR-Code" className="w-48 h-48" />
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Schlüssel (manuell)</Label>
                <div className="flex items-center gap-2 rounded-md border border-border bg-secondary px-3 py-2 font-mono text-sm break-all">
                  {secret}
                </div>
              </div>

              <form onSubmit={verify} className="space-y-3">
                <Label htmlFor="code">3. Aktuellen 6-stelligen Code eingeben</Label>
                <Input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="text-center text-lg tracking-widest font-mono"
                  required
                />
                {err && <p className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">{err}</p>}
                <Button type="submit" disabled={busy || code.length !== 6} className="w-full gold-gradient font-semibold">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Bestätigen
                </Button>
              </form>
            </>
          )}

          {step === 'recovery' && (
            <>
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200 flex gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>Wichtig:</strong> Diese 8 Recovery-Codes werden nur einmal angezeigt.
                  Speichern Sie sie sicher (Passwort-Manager, Tresor). Jeder Code kann genau einmal
                  verwendet werden, falls Sie Ihr Authenticator-Gerät verlieren.
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                {recoveryCodes.map((c) => (
                  <div key={c} className="rounded-md border border-border bg-secondary px-3 py-2 text-center">
                    {c}
                  </div>
                ))}
              </div>

              <Button variant="outline" onClick={copyCodes} className="w-full">
                <Copy className="w-4 h-4 mr-2" /> Alle Codes kopieren
              </Button>

              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmedSaved}
                  onChange={(e) => setConfirmedSaved(e.target.checked)}
                  className="mt-1"
                />
                <span>Ich habe die Recovery-Codes sicher gespeichert.</span>
              </label>

              <Button
                onClick={finish}
                disabled={!confirmedSaved}
                className="w-full gold-gradient font-semibold"
              >
                <Check className="w-4 h-4 mr-2" /> Fertig – zur App
              </Button>
            </>
          )}

          {err && step === 'enroll' && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">{err}</p>
          )}
        </div>

        <button
          onClick={() => signOut()}
          className="w-full text-center text-xs text-muted-foreground mt-4 hover:text-foreground"
        >
          Abmelden
        </button>
      </div>
    </div>
  );
}

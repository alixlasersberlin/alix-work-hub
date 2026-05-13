import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, markMfaVerifiedThisTab } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ShieldCheck } from 'lucide-react';
import alixLogo from '@/assets/alix-logo-gold.png';

export default function MfaChallenge() {
  const { signOut, refreshMfaState } = useAuth();
  // markMfaVerifiedThisTab wird nach erfolgreicher Verifikation gesetzt
  const navigate = useNavigate();
  const [factorId, setFactorId] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) {
        setErr(error.message);
        setBusy(false);
        return;
      }
      const verified = (data?.totp ?? []).find((f: any) => f.status === 'verified');
      if (!verified) {
        navigate('/mfa-setup', { replace: true });
        return;
      }
      setFactorId(verified.id);
      setBusy(false);
    })();
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
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
      markMfaVerifiedThisTab();
      await refreshMfaState();
      navigate('/', { replace: true });
    } catch (e: any) {
      setErr(e?.message ?? 'Code ungültig');
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-6">
          <img src={alixLogo} alt="Alix Work" className="h-14 w-auto mx-auto mb-3 object-contain" />
          <h1 className="text-xl font-semibold flex items-center justify-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" /> Authentifizierung
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Geben Sie den 6-stelligen Code aus Ihrer Authenticator-App ein.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 card-glow">
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Authenticator-Code</Label>
              <Input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className="text-center text-lg tracking-widest font-mono"
                autoFocus
                required
              />
            </div>

            {err && <p className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">{err}</p>}

            <Button type="submit" disabled={busy || code.length !== 6} className="w-full gold-gradient font-semibold">
              {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Bestätigen
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            <Link to="/mfa-recovery" className="text-primary hover:underline">
              Recovery-Code verwenden
            </Link>
          </div>
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

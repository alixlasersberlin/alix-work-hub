import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, markMfaVerifiedThisTab, markMfaSmsVerifiedThisTab } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ShieldCheck, MessageSquare } from 'lucide-react';
import alixLogo from '@/assets/alix-logo-gold.png';

export default function MfaChallenge() {
  const { signOut } = useAuth();
  // markMfaVerifiedThisTab wird nach erfolgreicher Verifikation gesetzt
  const navigate = useNavigate();
  const [factorId, setFactorId] = useState('');
  const [smsAvailable, setSmsAvailable] = useState(false);
  const [mode, setMode] = useState<'totp' | 'sms'>('totp');
  const [smsSent, setSmsSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState('');

  const finish = async (viaSms = false) => {
    if (viaSms) await markMfaSmsVerifiedThisTab(); else await markMfaVerifiedThisTab();
    const postMfaTarget = typeof window !== 'undefined' && window.location.hostname === 'app.alixwork.de'
      ? '/esc/kalender'
      : '/dashboard';
    // Harte Navigation wie nach Login: verhindert den gemeldeten
    // Maus-/Pointer-Freeze durch stale Auth-/Overlay-State nach MFA.
    window.location.replace(postMfaTarget);
  };


  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      let sms = false;
      if (u?.user?.id) {
        const { data: f } = await supabase
          .from('mfa_sms_factors')
          .select('enabled, verified_at')
          .eq('user_id', u.user.id)
          .maybeSingle();
        sms = !!f?.enabled && !!f?.verified_at;
      }
      setSmsAvailable(sms);

      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error && !sms) {
        setErr(error.message);
        setBusy(false);
        return;
      }
      const verified = (data?.totp ?? []).find((f) => f.status === 'verified');
      if (!verified) {
        if (!sms) {
          navigate('/mfa-setup', { replace: true });
          return;
        }
        setMode('sms');
      } else {
        setFactorId(verified.id);
      }
      setBusy(false);
    })();
  }, [navigate]);

  const sendSms = async () => {
    setErr('');
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('mfa-sms-send', { body: { purpose: 'login' } });
    setBusy(false);

    // Bei Nicht-2xx liefert invoke() einen FunctionsHttpError – Body auslesen
    let payload: any = data;
    if (error && (error as any).context?.json) {
      payload = await (error as any).context.json().catch(() => null);
    } else if (error && typeof (error as any).context?.text === 'function') {
      const t = await (error as any).context.text().catch(() => '');
      try { payload = JSON.parse(t); } catch { /* ignore */ }
    }

    const code = payload?.error;
    if (code === 'cooldown' || code === 'rate_limited') {
      // Kein Fehlerzustand: es wurde bereits ein Code gesendet
      setSmsSent(true);
      setErr('Es wurde bereits ein Code gesendet. Bitte den letzten Code eingeben oder kurz warten.');
      return;
    }
    if (error || code) {
      setErr('SMS konnte nicht gesendet werden.');
      return;
    }
    setSmsSent(true);
  };


  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      if (mode === 'sms') {
        const { data, error } = await supabase.functions.invoke('mfa-sms-verify', { body: { code: code.trim() } });
        if (error || data?.error) throw new Error('Code ungültig oder abgelaufen');
        finish(true);
        return;
      }
      const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
      if (chErr) throw chErr;
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: ch.id,
        code: code.trim(),
      });
      if (vErr) throw vErr;
      finish();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Code ungültig');
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
            {mode === 'sms'
              ? 'Geben Sie den 6-stelligen Code aus der SMS ein.'
              : 'Geben Sie den 6-stelligen Code aus Ihrer Authenticator-App ein.'}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 card-glow">
          {mode === 'sms' && !smsSent ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Wir senden Ihnen einen Bestätigungscode an Ihre hinterlegte Mobilnummer.
              </p>
              {err && <p className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">{err}</p>}
              <Button onClick={sendSms} disabled={busy} className="w-full gold-gradient font-semibold">
                {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <MessageSquare className="w-4 h-4 mr-2" />}
                Code per SMS senden
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">{mode === 'sms' ? 'SMS-Code' : 'Authenticator-Code'}</Label>
                <Input
                  id="code"
                  name="alix-mfa-code"
                  inputMode="numeric"
                  autoComplete="off"
                  data-1p-ignore
                  data-lpignore="true"
                  data-form-type="other"
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
              {mode === 'sms' && (
                <button type="button" onClick={sendSms} disabled={busy}
                  className="w-full text-center text-xs text-muted-foreground hover:text-foreground">
                  Code erneut senden
                </button>
              )}
            </form>
          )}

          <div className="mt-4 text-center text-sm space-y-2">
            {smsAvailable && factorId && (
              <button
                type="button"
                onClick={() => { setMode(mode === 'sms' ? 'totp' : 'sms'); setCode(''); setErr(''); setSmsSent(false); }}
                className="text-primary hover:underline"
              >
                {mode === 'sms' ? 'Stattdessen Authenticator-App verwenden' : 'Stattdessen Code per SMS erhalten'}
              </button>
            )}
            <div>
              <Link to="/mfa-recovery" className="text-primary hover:underline">
                Recovery-Code verwenden
              </Link>
            </div>
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

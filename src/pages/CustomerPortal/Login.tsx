import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Loader2, LogIn, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { logPortalAudit } from '@/lib/portal/audit';

const NEUTRAL_MSG =
  'Falls die E-Mail hinterlegt ist, wurde ein 6-stelliger Code an diese Adresse gesendet.';
const LOCK_MINUTES = 15;
const MAX_FAILS = 5;

function getLock(): number | null {
  const raw = localStorage.getItem('portal_login_lock_until');
  if (!raw) return null;
  const until = Number(raw);
  return Number.isFinite(until) && until > Date.now() ? until : null;
}

export default function CustomerPortalLogin() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<number | null>(getLock());

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockedUntil) {
      const min = Math.ceil((lockedUntil - Date.now()) / 60000);
      toast.error(`Zu viele Versuche. Bitte in ~${min} Min. erneut versuchen.`);
      return;
    }
    setLoading(true);
    // shouldCreateUser: false → nur bestehende Auth-User erhalten den Code.
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: false },
    });
    setLoading(false);
    void logPortalAudit({
      action: 'login_requested',
      success: !error,
      metadata: { email_hash: await hash(email) },
    });
    // Immer neutrale Meldung, unabhängig von error
    toast.success(NEUTRAL_MSG);
    setStep('otp');
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return;
    setLoading(true);
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code,
      type: 'email',
    });
    if (error || !data.user) {
      registerFail();
      setLoading(false);
      void logPortalAudit({ action: 'login_failed', success: false });
      toast.error('Code ungültig oder abgelaufen.');
      return;
    }

    // Portal-Zugang prüfen
    const { data: link } = await supabase
      .from('customer_portal_users')
      .select('id, status, customer_id')
      .eq('user_id', data.user.id)
      .maybeSingle();

    if (!link || link.status !== 'active') {
      await supabase.auth.signOut();
      setLoading(false);
      void logPortalAudit({
        action: 'login_failed',
        authUserId: data.user.id,
        success: false,
        metadata: { reason: 'no_active_portal' },
      });
      toast.error(
        'Kein aktiver Kundenportal-Zugang. Bitte wenden Sie sich an Alix Lasers.',
      );
      return;
    }

    localStorage.removeItem('portal_login_fails');
    localStorage.removeItem('portal_login_lock_until');
    await supabase
      .from('customer_portal_users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('user_id', data.user.id);

    void logPortalAudit({
      action: 'login_success',
      authUserId: data.user.id,
      customerId: link.customer_id,
    });

    toast.success('Willkommen!');
    navigate('/kunde');
  };

  const registerFail = () => {
    const fails = Number(localStorage.getItem('portal_login_fails') ?? '0') + 1;
    localStorage.setItem('portal_login_fails', String(fails));
    if (fails >= MAX_FAILS) {
      const until = Date.now() + LOCK_MINUTES * 60_000;
      localStorage.setItem('portal_login_lock_until', String(until));
      setLockedUntil(until);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border/60">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <CardTitle className="text-2xl">Kundenportal</CardTitle>
          <p className="text-sm text-muted-foreground">Alix Lasers · Sicherer Login per E-Mail-Code</p>
        </CardHeader>
        <CardContent>
          {step === 'email' ? (
            <form onSubmit={sendCode} className="space-y-4">
              <div>
                <Label>E-Mail-Adresse</Label>
                <Input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="name@firma.de"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !!lockedUntil}>
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogIn className="w-4 h-4 mr-2" />}
                Code anfordern
              </Button>
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/60" /></div>
                <div className="relative flex justify-center text-[10px] uppercase tracking-wider text-muted-foreground">
                  <span className="bg-card px-2">oder</span>
                </div>
              </div>
              <Link to="/id/login" className="block">
                <Button type="button" variant="outline" className="w-full">
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  Über Alix ID anmelden
                </Button>
              </Link>
              {lockedUntil && (
                <p className="text-xs text-destructive text-center">
                  Zu viele Fehlversuche. Login gesperrt bis {new Date(lockedUntil).toLocaleTimeString('de-DE')}.
                </p>
              )}
            </form>
          ) : (
            <form onSubmit={verify} className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                {NEUTRAL_MSG} Der Code ist 10 Minuten gültig.
              </p>
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={code} onChange={setCode}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <Button type="submit" className="w-full" disabled={loading || code.length !== 6}>
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                Anmelden
              </Button>
              <div className="flex justify-between text-xs text-muted-foreground">
                <button type="button" className="underline" onClick={() => { setStep('email'); setCode(''); }}>
                  Andere E-Mail
                </button>
                <button type="button" className="underline" onClick={(e) => sendCode(e as any)}>
                  Code erneut senden
                </button>
              </div>
            </form>
          )}
          <div className="mt-6 border-t border-border/60 pt-4 text-center text-xs text-muted-foreground space-y-1">
            <p>Zugang wird ausschließlich durch Alix Lasers freigeschaltet.</p>
            <p className="space-x-2">
              <Link to="/datenschutz" className="underline">Datenschutz</Link>
              <span>·</span>
              <Link to="/impressum" className="underline">Impressum</Link>
              <span>·</span>
              <Link to="/portal" className="underline">Status ohne Login</Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

async function hash(value: string): Promise<string> {
  try {
    const enc = new TextEncoder().encode(value.trim().toLowerCase());
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf)).slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch { return ''; }
}

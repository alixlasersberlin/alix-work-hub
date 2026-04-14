import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Loader2, Mail, Smartphone, AlertTriangle, ShieldCheck, ArrowLeft } from 'lucide-react';

export default function Login() {
  const { signIn, profile, blockReason, otpState, otpChallenge, otpError, sendOtp, verifyOtp, user, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'login' | 'otp'>('login');
  const [otpCode, setOtpCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const otpSentRef = useRef(false);

  // After successful login, check profile and trigger OTP
  useEffect(() => {
    if (user && profile && step === 'login' && !otpSentRef.current) {
      const reason = blockReason;
      if (reason) return; // blocked users handled by App.tsx
      // Profile is good, trigger OTP
      otpSentRef.current = true;
      setStep('otp');
      sendOtp('login');
    }
  }, [user, profile, step, blockReason, sendOtp]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    otpSentRef.current = false;

    const { error } = await signIn(email, password);
    if (error) {
      setError('Ungültige Anmeldedaten. Bitte versuchen Sie es erneut.');
    }
    setLoading(false);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length !== 6) return;
    setVerifying(true);
    await verifyOtp(otpCode);
    setVerifying(false);
  };

  const handleResendOtp = async () => {
    setOtpCode('');
    await sendOtp('login');
  };

  const handleBackToLogin = async () => {
    otpSentRef.current = false;
    setStep('login');
    setOtpCode('');
    await signOut();
  };

  // OTP Step
  if (step === 'otp' && user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md animate-fade-in">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gold-gradient mb-4">
              <ShieldCheck className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-display font-bold gold-text">Zwei-Faktor-Authentifizierung</h1>
            <p className="text-muted-foreground mt-2 text-sm">Sicherheitscode eingeben</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-8 card-glow">
            {otpState === 'sending' && (
              <div className="flex flex-col items-center gap-4 py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Sicherheitscode wird gesendet…</p>
              </div>
            )}

            {otpState === 'blocked' && (
              <div className="flex flex-col items-center gap-4 py-6">
                <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="w-7 h-7 text-destructive" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">Verifikation gesperrt</h2>
                <p className="text-sm text-muted-foreground text-center">{otpError || 'Zu viele Fehlversuche. Bitte kontaktieren Sie Ihren Administrator.'}</p>
                <Button variant="outline" onClick={handleBackToLogin} className="mt-2">
                  <ArrowLeft className="w-4 h-4 mr-2" /> Zurück zum Login
                </Button>
              </div>
            )}

            {otpState === 'error' && (
              <div className="flex flex-col items-center gap-4 py-6">
                <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="w-7 h-7 text-destructive" />
                </div>
                <p className="text-sm text-destructive text-center">{otpError}</p>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={handleBackToLogin}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Zurück
                  </Button>
                  <Button onClick={handleResendOtp} className="gold-gradient font-semibold">
                    Erneut senden
                  </Button>
                </div>
              </div>
            )}

            {otpState === 'pending' && otpChallenge && (
              <form onSubmit={handleVerifyOtp} className="space-y-5">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 border border-border">
                  {otpChallenge.channel === 'sms' ? (
                    <Smartphone className="w-5 h-5 text-primary flex-shrink-0" />
                  ) : (
                    <Mail className="w-5 h-5 text-primary flex-shrink-0" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Code gesendet per {otpChallenge.channel === 'sms' ? 'SMS' : 'E-Mail'}
                    </p>
                    <p className="text-xs text-muted-foreground">an {otpChallenge.destination_hint}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="otp" className="text-sm text-muted-foreground">6-stelliger Sicherheitscode</Label>
                  <Input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    required
                    autoFocus
                    className="bg-secondary border-border focus:ring-primary text-center text-2xl tracking-[0.5em] font-mono"
                  />
                </div>

                {otpError && (
                  <p className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">{otpError}</p>
                )}

                <Button type="submit" disabled={verifying || otpCode.length !== 6} className="w-full gold-gradient font-semibold">
                  {verifying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Bestätigen
                </Button>

                <div className="flex items-center justify-between pt-2">
                  <Button type="button" variant="ghost" size="sm" onClick={handleBackToLogin} className="text-muted-foreground">
                    <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Zurück
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={handleResendOtp} className="text-muted-foreground">
                    Neuen Code senden
                  </Button>
                </div>
              </form>
            )}
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            Zugang nur für autorisierte Mitarbeiter.
          </p>
        </div>
      </div>
    );
  }

  // Login Step
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gold-gradient mb-4">
            <Shield className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-display font-bold gold-text">Alix Work</h1>
          <p className="text-muted-foreground mt-2 text-sm">Enterprise Management Platform</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-8 card-glow">
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm text-muted-foreground">E-Mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@unternehmen.de"
                required
                className="bg-secondary border-border focus:ring-primary"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm text-muted-foreground">Passwort</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="bg-secondary border-border focus:ring-primary"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">{error}</p>
            )}

            <Button type="submit" disabled={loading} className="w-full gold-gradient font-semibold">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Anmelden
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-6">
            Zugang nur für autorisierte Mitarbeiter.
          </p>
        </div>
      </div>
    </div>
  );
}

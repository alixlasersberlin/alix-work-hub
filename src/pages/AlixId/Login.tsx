import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Loader2, LogIn, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

const NEUTRAL = 'Falls die E-Mail bei Alix ID hinterlegt ist, wurde ein 6-stelliger Code gesendet.';

export default function AlixIdLogin() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: 'https://app.alixwork.de/id/callback',
      },
    });
    setLoading(false);
    toast.success(NEUTRAL);
    setStep('otp');
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return;
    setLoading(true);
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(), token: code, type: 'email',
    });
    if (error || !data.user) {
      setLoading(false);
      toast.error('Code ungültig oder abgelaufen.');
      return;
    }
    // Server bootstrappt Identität beim ersten Userinfo/Authorize-Call.
    toast.success('Willkommen bei Alix ID.');
    navigate('/id/apps', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border/60">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <CardTitle className="text-2xl">Alix ID</CardTitle>
          <p className="text-sm text-muted-foreground">
            Einmal anmelden – Zugriff auf alle freigeschalteten Alix-Anwendungen.
          </p>
        </CardHeader>
        <CardContent>
          {step === 'email' ? (
            <form onSubmit={sendCode} className="space-y-4">
              <div>
                <Label>E-Mail-Adresse</Label>
                <Input type="email" required autoFocus value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email" placeholder="name@firma.de" />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogIn className="w-4 h-4 mr-2" />}
                Code anfordern
              </Button>
            </form>
          ) : (
            <form onSubmit={verify} className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                {NEUTRAL} Der Code ist 10 Minuten gültig.
              </p>
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={code} onChange={setCode}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} />
                    <InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <Button type="submit" className="w-full" disabled={loading || code.length !== 6}>
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                Anmelden
              </Button>
              <div className="flex justify-between text-xs text-muted-foreground">
                <button type="button" className="underline"
                  onClick={() => { setStep('email'); setCode(''); }}>Andere E-Mail</button>
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
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

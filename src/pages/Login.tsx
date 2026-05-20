import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import alixLogo from '@/assets/alix-logo-gold.png';
import Turnstile from '@/components/Turnstile';
import { supabase } from '@/integrations/supabase/client';

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string>('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!captchaToken) {
      setError('Bitte bestätigen Sie das Sicherheits-Captcha.');
      return;
    }

    setLoading(true);

    try {
      const { data, error: verifyError } = await supabase.functions.invoke('verify-turnstile', {
        body: { token: captchaToken },
      });
      if (verifyError || !data?.success) {
        setError('Sicherheitsprüfung fehlgeschlagen. Bitte erneut versuchen.');
        setCaptchaToken('');
        if (window.turnstile) {
          try { window.turnstile.reset(); } catch { /* ignore */ }
        }
        setLoading(false);
        return;
      }
    } catch {
      setError('Sicherheitsprüfung nicht erreichbar. Bitte erneut versuchen.');
      setLoading(false);
      return;
    }

    const { error } = await signIn(email, password);
    if (error) {
      setError('Ungültige Anmeldedaten. Bitte versuchen Sie es erneut.');
      setCaptchaToken('');
      if (window.turnstile) {
        try { window.turnstile.reset(); } catch { /* ignore */ }
      }
      setLoading(false);
      return;
    }
    navigate('/', { replace: true });
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <img src={alixLogo} alt="Alix Lasers" className="h-16 w-auto mx-auto mb-4 object-contain" />
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

            <Turnstile
              theme="dark"
              onToken={setCaptchaToken}
              onExpire={() => setCaptchaToken('')}
            />

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">{error}</p>
            )}

            <Button type="submit" disabled={loading || !captchaToken} className="w-full gold-gradient font-semibold">
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

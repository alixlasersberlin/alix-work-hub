import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Loader2, CheckCircle2, AlertTriangle, Eye, EyeOff } from 'lucide-react';

export default function SetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [checking, setChecking] = useState(true);
  const [sessionValid, setSessionValid] = useState(false);

  useEffect(() => {
    // Supabase handles the token exchange via URL hash automatically
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setSessionValid(true);
      }
      setChecking(false);
    };

    // Listen for auth state change (recovery flow sets session)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setSessionValid(true);
        setChecking(false);
      }
    });

    // Give Supabase a moment to process the hash
    setTimeout(checkSession, 1000);

    return () => subscription.unsubscribe();
  }, []);

  const validatePassword = (): string | null => {
    if (password.length < 8) return 'Passwort muss mindestens 8 Zeichen lang sein.';
    if (!/[A-Z]/.test(password)) return 'Passwort muss mindestens einen Großbuchstaben enthalten.';
    if (!/[a-z]/.test(password)) return 'Passwort muss mindestens einen Kleinbuchstaben enthalten.';
    if (!/[0-9]/.test(password)) return 'Passwort muss mindestens eine Zahl enthalten.';
    if (password !== confirmPassword) return 'Passwörter stimmen nicht überein.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validatePassword();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      // Update profile: mark password_reset_required = false, invitation_status = accepted
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('user_profiles')
          .update({
            password_reset_required: false,
            invitation_status: 'accepted',
          })
          .eq('id', user.id);
      }

      setSuccess(true);
      // Sign out so user logs in fresh with new password + OTP
      setTimeout(async () => {
        await supabase.auth.signOut();
        navigate('/login', { replace: true });
      }, 3000);
    } catch (err: any) {
      setError(err?.message || 'Passwort konnte nicht gesetzt werden.');
    }
    setLoading(false);
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!sessionValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md text-center animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-destructive/10 mb-6">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground mb-2">Ungültiger oder abgelaufener Link</h1>
          <p className="text-muted-foreground mb-6">
            Der Einladungslink ist ungültig oder abgelaufen. Bitte wenden Sie sich an Ihren Administrator.
          </p>
          <Button variant="outline" onClick={() => navigate('/login', { replace: true })}>
            Zum Login
          </Button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md text-center animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6">
            <CheckCircle2 className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-display font-bold gold-text mb-2">Passwort erfolgreich gesetzt</h1>
          <p className="text-muted-foreground mb-4">
            Sie werden automatisch zum Login weitergeleitet…
          </p>
          <Loader2 className="w-5 h-5 animate-spin text-primary mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gold-gradient mb-4">
            <Shield className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-display font-bold gold-text">Passwort setzen</h1>
          <p className="text-muted-foreground mt-2 text-sm">Legen Sie Ihr persönliches Passwort fest</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-8 card-glow">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="new-password" className="text-sm text-muted-foreground">Neues Passwort</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mindestens 8 Zeichen"
                  required
                  className="bg-secondary border-border focus:ring-primary pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-sm text-muted-foreground">Passwort bestätigen</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Passwort wiederholen"
                required
                className="bg-secondary border-border focus:ring-primary"
              />
            </div>

            <div className="rounded-lg bg-secondary/50 border border-border p-3">
              <p className="text-xs text-muted-foreground font-medium mb-1.5">Anforderungen:</p>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                <li className={password.length >= 8 ? 'text-primary' : ''}>• Mindestens 8 Zeichen</li>
                <li className={/[A-Z]/.test(password) ? 'text-primary' : ''}>• Mindestens ein Großbuchstabe</li>
                <li className={/[a-z]/.test(password) ? 'text-primary' : ''}>• Mindestens ein Kleinbuchstabe</li>
                <li className={/[0-9]/.test(password) ? 'text-primary' : ''}>• Mindestens eine Zahl</li>
              </ul>
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">{error}</p>
            )}

            <Button type="submit" disabled={loading} className="w-full gold-gradient font-semibold">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Passwort setzen
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

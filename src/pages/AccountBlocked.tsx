import { useState } from 'react';
import { ShieldAlert, KeyRound, UserX, Loader2, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth, AccountBlockReason } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const blockInfo: Record<Exclude<NonNullable<AccountBlockReason>, 'password_reset'>, { icon: React.ReactNode; title: string; message: string }> = {
  inactive: {
    icon: <UserX className="w-10 h-10 text-destructive" />,
    title: 'Konto deaktiviert',
    message: 'Ihr Konto wurde deaktiviert. Bitte wenden Sie sich an Ihren Administrator.',
  },
  not_accepted: {
    icon: <ShieldAlert className="w-10 h-10 text-warning" />,
    title: 'Einladung ausstehend',
    message: 'Ihre Einladung wurde noch nicht akzeptiert. Bitte prüfen Sie Ihre E-Mails oder wenden Sie sich an Ihren Administrator.',
  },
};

function PasswordResetForm() {
  const { signOut, refreshProfile } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

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
      setTimeout(async () => {
        await refreshProfile();
        await supabase.auth.signOut();
        window.location.href = '/login';
      }, 2500);
    } catch (err: any) {
      setError(err?.message || 'Passwort konnte nicht gesetzt werden.');
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md text-center animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6">
            <CheckCircle2 className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-display font-bold gold-text mb-2">Passwort erfolgreich geändert</h1>
          <p className="text-muted-foreground mb-4">Sie werden zum Login weitergeleitet…</p>
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
            <KeyRound className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-display font-bold gold-text">Passwort ändern</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Aus Sicherheitsgründen müssen Sie beim ersten Login ein neues Passwort festlegen.
          </p>
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
              Passwort speichern
            </Button>

            <button
              type="button"
              onClick={signOut}
              className="w-full text-xs text-muted-foreground hover:text-foreground"
            >
              Abmelden
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function AccountBlocked() {
  const { signOut, blockReason } = useAuth();

  if (blockReason === 'password_reset') {
    return <PasswordResetForm />;
  }

  const info = blockReason && blockReason !== 'password_reset'
    ? blockInfo[blockReason]
    : blockInfo.inactive;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center max-w-md animate-fade-in">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-muted mb-6">
          {info.icon}
        </div>
        <h1 className="text-2xl font-display font-bold text-foreground mb-2">{info.title}</h1>
        <p className="text-muted-foreground mb-8">{info.message}</p>
        <Button
          variant="outline"
          onClick={signOut}
          className="border-border text-muted-foreground hover:text-foreground"
        >
          Abmelden
        </Button>
      </div>
    </div>
  );
}

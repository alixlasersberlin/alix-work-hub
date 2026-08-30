import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ShieldCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { logCompliance } from '@/hooks/useComplianceProfile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

/** Dedizierte Login-Seite für den abgeschotteten Compliance-Workspace. */
export default function ComplianceLogin() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/software-compliance" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await signIn(email.trim(), password);
    setBusy(false);
    if (error) {
      toast.error(error.message || 'Anmeldung fehlgeschlagen');
      return;
    }
    await logCompliance('login', { workspace: 'software_compliance' });
    navigate('/software-compliance', { replace: true });
  };

  const resetPassword = async () => {
    if (!email.trim()) {
      toast.error('Bitte zuerst die E-Mail-Adresse eingeben.');
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/passwort-setzen`,
    });
    if (error) toast.error(error.message);
    else toast.success('E-Mail zum Zurücksetzen wurde versendet.');
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-4 py-10">
      <header className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl border border-border mb-4">
          <ShieldCheck className="w-6 h-6 text-primary" />
        </div>
        <div className="text-[11px] tracking-[0.35em] text-muted-foreground">ALIXWORK</div>
        <h1 className="mt-2 text-2xl md:text-3xl font-display font-semibold tracking-tight">SOFTWARE &amp; COMPLIANCE</h1>
        <p className="mt-2 text-[12px] text-muted-foreground">
          Validation · Verification · Risk Management · Technical Documentation
        </p>
      </header>

      <Card className="w-full max-w-md border-border/70">
        <CardContent className="pt-6">
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cl-email">E-Mail</Label>
              <Input
                id="cl-email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cl-pass">Passwort</Label>
              <div className="relative">
                <Input
                  id="cl-pass"
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? 'Passwort verbergen' : 'Passwort anzeigen'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" disabled={busy} className="w-full font-semibold tracking-wide">
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              ANMELDEN
            </Button>

            <button
              type="button"
              onClick={resetPassword}
              className="w-full text-[12px] text-muted-foreground hover:text-foreground"
            >
              Passwort vergessen?
            </button>
          </form>
        </CardContent>
      </Card>

      <p className="mt-6 max-w-md text-center text-[11px] text-muted-foreground">
        Zugang ausschließlich für autorisierte Software-, Validierungs-, Risiko-, Qualitäts- und Regulatory-Mitarbeiter.
      </p>
      <footer className="mt-8 text-center text-[11px] text-muted-foreground/70">
        Alix Medical · Controlled Compliance Workspace
      </footer>
    </div>
  );
}

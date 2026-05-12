import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, KeyRound, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import alixLogo from '@/assets/alix-logo-gold.png';

export default function MfaRecovery() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('mfa-use-recovery-code', {
        body: { code: code.trim() },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Recovery fehlgeschlagen');
      toast.success('Recovery erfolgreich – bitte neu anmelden und Authenticator neu einrichten.');
      await supabase.auth.signOut();
      navigate('/login', { replace: true });
    } catch (e: any) {
      setErr(e?.message ?? 'Ungültiger Code');
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-6">
          <img src={alixLogo} alt="Alix Work" className="h-14 w-auto mx-auto mb-3 object-contain" />
          <h1 className="text-xl font-semibold flex items-center justify-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" /> Recovery-Code
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Geben Sie einen Ihrer Recovery-Codes ein.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 card-glow space-y-4">
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200 flex gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              Nach Verwendung eines Recovery-Codes wird Ihr Authenticator zurückgesetzt.
              Sie müssen sich beim nächsten Login neu einrichten.
            </div>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Recovery-Code</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABCDE-12345"
                className="text-center text-lg tracking-widest font-mono uppercase"
                autoFocus
                required
              />
            </div>

            {err && <p className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">{err}</p>}

            <Button type="submit" disabled={busy} className="w-full gold-gradient font-semibold">
              {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Code einlösen
            </Button>
          </form>

          <div className="text-center text-sm">
            <Link to="/mfa-challenge" className="text-muted-foreground hover:text-foreground">
              Zurück zur Code-Eingabe
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

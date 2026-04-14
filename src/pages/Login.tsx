import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Loader2 } from 'lucide-react';

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await signIn(email, password);
    if (error) {
      setError('Ungültige Anmeldedaten. Bitte versuchen Sie es erneut.');
    }
    setLoading(false);
  };

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
          <form onSubmit={handleSubmit} className="space-y-5">
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

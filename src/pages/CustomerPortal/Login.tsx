import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, LogIn } from 'lucide-react';
import { toast } from 'sonner';

export default function CustomerPortalLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { toast.error(error.message); setLoading(false); return; }
    // verify portal link
    const { data: link } = await supabase
      .from('customer_portal_users')
      .select('id, status')
      .eq('user_id', data.user!.id)
      .maybeSingle();
    if (!link || link.status !== 'active') {
      await supabase.auth.signOut();
      toast.error('Kein aktiver Kundenportal-Zugang. Bitte kontaktieren Sie Alix Lasers.');
      setLoading(false);
      return;
    }
    toast.success('Willkommen zurück!');
    navigate('/kunde');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-2xl">Kundenportal</CardTitle>
          <p className="text-center text-sm text-muted-foreground">Alix Lasers</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label>E-Mail</Label>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div>
              <Label>Passwort</Label>
              <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogIn className="w-4 h-4 mr-2" />}
              Anmelden
            </Button>
            <div className="text-center text-xs text-muted-foreground space-y-1">
              <p>
                Noch keinen Zugang? Wenden Sie sich an Ihren Ansprechpartner bei Alix Lasers.
              </p>
              <p>
                <Link to="/portal" className="underline">Status auch ohne Login prüfen</Link>
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

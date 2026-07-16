import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logPortalAudit } from '@/lib/portal/audit';

type State = 'exchanging' | 'success' | 'error';

export default function SsoCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<State>('exchanging');
  const [message, setMessage] = useState<string>('Anmeldung wird geprüft…');
  const [target, setTarget] = useState<string>('/kunde');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void run();
  }, []);

  async function run() {
    const code = params.get('code');
    const stateParam = params.get('state');
    if (!code || !stateParam) {
      setState('error');
      setMessage('Ungültiger Rückgabelink. Bitte melden Sie sich erneut über Alix ID an.');
      return;
    }

    const stashKey = `alix_id_pkce_${stateParam}`;
    const stash = sessionStorage.getItem(stashKey);
    if (!stash) {
      setState('error');
      setMessage('Anmeldevorgang abgelaufen. Bitte melden Sie sich erneut an.');
      return;
    }
    sessionStorage.removeItem(stashKey);
    let parsed: { verifier: string; redirect_uri: string; app_key: string; ts: number };
    try { parsed = JSON.parse(stash); } catch {
      setState('error'); setMessage('Interner Fehler beim Prüfen der Anmeldung.'); return;
    }

    // Determine target route by app_key (AlixWork pilot → /kunde).
    const dest = parsed.app_key === 'alixwork_customer' ? '/kunde' : '/kunde';
    setTarget(dest);

    try {
      const { data, error } = await supabase.functions.invoke('alix-id-token', {
        body: {
          code,
          code_verifier: parsed.verifier,
          redirect_uri: parsed.redirect_uri,
        },
      });
      if (error) throw new Error(error.message ?? 'Token-Tausch fehlgeschlagen');
      if (!data?.identity) throw new Error(data?.error ?? 'Ungültige Antwort');

      // Same-origin pilot: Supabase-Session ist bereits aktiv. Nur audit + Weiterleitung.
      const { data: link } = await supabase
        .from('customer_portal_users')
        .select('customer_id, status')
        .eq('user_id', data.identity.auth_user_id)
        .maybeSingle();

      if (link && link.status === 'active') {
        await supabase.from('customer_portal_users')
          .update({ last_login_at: new Date().toISOString() })
          .eq('user_id', data.identity.auth_user_id);
        void logPortalAudit({
          action: 'login_success',
          authUserId: data.identity.auth_user_id,
          customerId: link.customer_id,
          metadata: { via: 'alix_id_sso', app_key: parsed.app_key },
        });
      }

      setState('success');
      setMessage(`Willkommen ${data.identity.display_name ?? ''}. Sie werden weitergeleitet…`);
      setTimeout(() => navigate(dest, { replace: true }), 800);
    } catch (e: any) {
      setState('error');
      setMessage(`Anmeldung fehlgeschlagen: ${e?.message ?? e}`);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border/60">
        <CardContent className="py-10 text-center space-y-4">
          {state === 'exchanging' && <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />}
          {state === 'success' && <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500" />}
          {state === 'error' && <XCircle className="w-8 h-8 mx-auto text-destructive" />}
          <p className="text-sm">{message}</p>
          {state === 'success' && (
            <Button size="sm" onClick={() => navigate(target, { replace: true })}>
              Weiter <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          )}
          {state === 'error' && (
            <div className="flex flex-col gap-2 items-center">
              <Link to="/id/login" className="text-sm underline text-primary">Erneut mit Alix ID anmelden</Link>
              <Link to="/kunde/login" className="text-xs underline text-muted-foreground">
                Klassische Anmeldung (Fallback)
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

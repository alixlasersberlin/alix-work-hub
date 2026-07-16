import { useEffect, useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, LogOut, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import type { AlixIdCtx } from './Layout';

const LABELS: Record<string, string> = {
  sso_authorize_issued: 'App-Öffnung angefragt',
  sso_authorize_denied: 'App-Öffnung abgelehnt',
  sso_token_issued: 'App-Session gestartet',
  sso_token_denied: 'App-Session abgelehnt',
  logout: 'Abmeldung',
  identity_suspended: 'Konto gesperrt',
  identity_reactivated: 'Konto reaktiviert',
  identity_invited: 'Einladung',
  access_granted: 'Zugriff freigeschaltet',
  access_revoked: 'Zugriff entzogen',
  application_updated: 'App-Konfiguration geändert',
};

export default function AlixIdSitzungen() {
  const ctx = useOutletContext<AlixIdCtx>();
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!ctx.identityId) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase
        .from('alix_security_events')
        .select('id, event_type, severity, success, ip_address, user_agent, created_at, application:alix_applications(app_name)')
        .eq('identity_id', ctx.identityId)
        .order('created_at', { ascending: false })
        .limit(100);
      setRows(data ?? []);
      setLoading(false);
    })();
  }, [ctx.identityId]);

  const logoutEverywhere = async () => {
    setSigningOut(true);
    try {
      await supabase.functions.invoke('alix-id-logout', { body: { scope: 'global' } });
      await supabase.auth.signOut();
      toast.success('Von allen Alix-Anwendungen abgemeldet.');
      navigate('/id/login', { replace: true });
    } catch (e: any) {
      toast.error(e?.message ?? 'Abmeldung fehlgeschlagen');
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Aktivitäten</h1>
          <p className="text-sm text-muted-foreground">
            Alle sicherheitsrelevanten Ereignisse Ihres Alix-ID-Kontos (letzte 100).
          </p>
        </div>
        <Button variant="destructive" size="sm" onClick={logoutEverywhere} disabled={signingOut}>
          {signingOut ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogOut className="w-4 h-4 mr-2" />}
          Von allen Geräten abmelden
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
          Noch keine Aktivitäten protokolliert.
        </CardContent></Card>
      ) : (
        <div className="border border-border/60 rounded-md divide-y divide-border/60">
          {rows.map((r) => {
            const bad = !r.success || r.severity === 'error' || r.severity === 'critical';
            return (
              <div key={r.id} className="flex items-start gap-3 p-3 text-sm">
                <div className={`w-2 h-2 mt-1.5 rounded-full ${bad ? 'bg-destructive' : r.severity === 'warn' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{LABELS[r.event_type] ?? r.event_type}</span>
                    {r.application?.app_name && (
                      <Badge variant="secondary" className="text-[10px]">{r.application.app_name}</Badge>
                    )}
                    {bad && <AlertTriangle className="w-3.5 h-3.5 text-destructive" />}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {new Date(r.created_at).toLocaleString('de-DE')}
                    {r.ip_address ? ` · ${r.ip_address}` : ''}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

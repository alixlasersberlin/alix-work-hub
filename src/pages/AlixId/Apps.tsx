import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ExternalLink, Lock, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { randomVerifier, challengeFromVerifier, randomState } from '@/lib/alix-id/pkce';

type App = {
  id: string; app_key: string; app_name: string; description: string | null;
  icon_url: string | null; base_url: string | null; app_status: string;
  has_access: boolean;
  access: Array<{ organization_id: string | null; app_role: string }>;
};

export default function AlixIdApps() {
  const [apps, setApps] = useState<App[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('alix-id-userinfo', { body: {} });
    if (error) { toast.error('Konnte Katalog nicht laden.'); setLoading(false); return; }
    setApps(data?.applications ?? []);
    setOrgs(data?.organizations ?? []);
    setLoading(false);
  }

  async function openApp(app: App) {
    if (!app.has_access || app.app_status !== 'active') return;
    setOpening(app.id);
    try {
      const verifier = randomVerifier();
      const challenge = await challengeFromVerifier(verifier);
      const state = randomState();
      const base = (app.base_url ?? window.location.origin).replace(/\/$/, '');
      const redirectUri = `${base}/sso/callback`;
      const orgId = app.access[0]?.organization_id ?? null;

      sessionStorage.setItem(`alix_id_pkce_${state}`, JSON.stringify({
        verifier, redirect_uri: redirectUri, app_key: app.app_key, ts: Date.now(),
      }));

      const { data, error } = await supabase.functions.invoke('alix-id-authorize', {
        body: {
          app_key: app.app_key,
          organization_id: orgId,
          redirect_uri: redirectUri,
          code_challenge: challenge,
          code_challenge_method: 'S256',
          state,
          scope: ['openid', 'profile'],
        },
      });
      if (error || !data?.redirect) throw error ?? new Error('kein Redirect');
      window.location.href = data.redirect;
    } catch (e: any) {
      toast.error(`Konnte App nicht öffnen: ${e?.message ?? e}`);
      setOpening(null);
    }
  }

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  const available = apps.filter((a) => a.has_access && a.app_status === 'active');
  const locked = apps.filter((a) => !a.has_access || a.app_status !== 'active');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Meine Apps</h1>
        <p className="text-sm text-muted-foreground">
          {orgs.length > 0
            ? `Angemeldet für ${orgs.map((o: any) => o.organization?.display_name ?? o.organization?.legal_name).filter(Boolean).join(', ')}`
            : 'Noch keine Organisation zugeordnet.'}
        </p>
      </div>

      {available.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
          Es ist noch keine Alix-Anwendung für Sie freigeschaltet. Bitte wenden Sie sich an Alix Lasers.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {available.map((app) => (
            <Card key={app.id} className="hover:border-primary/60 transition-colors">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden">
                    {app.icon_url
                      ? <img src={app.icon_url} alt="" className="w-full h-full object-cover" />
                      : <span className="text-primary font-semibold">{app.app_name[0]}</span>}
                  </div>
                  <Badge variant="secondary" className="text-[10px]">{app.access[0]?.app_role ?? '—'}</Badge>
                </div>
                <div>
                  <div className="font-medium">{app.app_name}</div>
                  {app.description && <div className="text-xs text-muted-foreground line-clamp-2">{app.description}</div>}
                </div>
                <Button size="sm" className="w-full" onClick={() => openApp(app)}
                  disabled={opening === app.id}>
                  {opening === app.id
                    ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    : <ArrowRight className="w-4 h-4 mr-2" />}
                  Öffnen
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {locked.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Weitere Alix-Anwendungen</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {locked.map((app) => (
              <Card key={app.id} className="opacity-60">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-sm">{app.app_name}</div>
                    <Lock className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {app.app_status !== 'active' ? 'Noch nicht verfügbar.' : 'Keine Freigabe für Ihr Konto.'}
                  </div>
                  {app.base_url && (
                    <a href={app.base_url} target="_blank" rel="noreferrer"
                      className="text-xs inline-flex items-center gap-1 text-primary hover:underline">
                      Mehr erfahren <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

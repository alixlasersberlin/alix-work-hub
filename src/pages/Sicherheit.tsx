import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { isMfaMandatory, MFA_REQUIRED_ROLES } from '@/lib/mfa-required';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Clock,
  Monitor,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

interface SessionRow {
  id: string;
  created_at: string;
  device_info: string | null;
  ip_address: string | null;
  is_active: boolean;
  otp_verified_at: string | null;
}

export default function Sicherheit() {
  const { user, roles, refreshMfaState } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [hasMfa, setHasMfa] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [aal, setAal] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [sessions, setSessions] = useState<SessionRow[]>([]);

  const mandatory = isMfaMandatory(roles);
  const lastSignIn = user?.last_sign_in_at ? new Date(user.last_sign_in_at) : null;

  const load = async () => {
    setLoading(true);
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const verified = (factors?.totp ?? []).find((f: any) => f.status === 'verified');
      setHasMfa(!!verified);
      setFactorId(verified?.id ?? null);

      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      setAal(aalData?.currentLevel ?? null);

      if (user?.id) {
        const { data: s } = await supabase
          .from('login_sessions')
          .select('id, created_at, device_info, ip_address, is_active, otp_verified_at')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(20);
        setSessions((s as SessionRow[]) ?? []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleReset = async () => {
    if (!factorId) return;
    if (!confirm('Authenticator wirklich zurücksetzen? Sie müssen MFA danach neu einrichten.')) return;
    setResetting(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
      toast.success('Authenticator zurückgesetzt.');
      await refreshMfaState();
      navigate('/mfa-setup');
    } catch (e: any) {
      toast.error(e?.message ?? 'Zurücksetzen fehlgeschlagen');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-primary" /> Sicherheit
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Verwalten Sie Ihre Zwei-Faktor-Authentifizierung, Sitzungen und Anmelde-Aktivität.
        </p>
      </div>

      {/* MFA Status */}
      <Card className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" /> Zwei-Faktor-Authentifizierung (TOTP)
            </h2>
            <p className="text-sm text-muted-foreground">
              {mandatory
                ? 'Für Ihre Rolle ist MFA verpflichtend.'
                : 'MFA ist für Ihre Rolle optional. Wir empfehlen die Aktivierung ausdrücklich.'}
            </p>
          </div>
          {hasMfa ? (
            <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30">Aktiv</Badge>
          ) : (
            <Badge variant="outline" className="border-amber-500/30 text-amber-500">
              Nicht aktiv
            </Badge>
          )}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Lädt…
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-border p-3">
              <div className="text-xs text-muted-foreground">Status</div>
              <div className="font-medium">{hasMfa ? 'TOTP eingerichtet' : 'Nicht eingerichtet'}</div>
            </div>
            <div className="rounded-lg border border-border p-3">
              <div className="text-xs text-muted-foreground">Assurance Level</div>
              <div className="font-medium uppercase">{aal ?? '—'}</div>
            </div>
          </div>
        )}

        {mandatory && !hasMfa && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            <AlertTriangle className="w-4 h-4 mt-0.5" />
            <span>
              Ihre Rolle erfordert MFA. Bitte richten Sie den Authenticator ein, um vollen Zugriff zu erhalten.
            </span>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          {!hasMfa && (
            <Button onClick={() => navigate('/mfa-setup')} className="gold-gradient font-semibold">
              <KeyRound className="w-4 h-4 mr-2" /> Authenticator einrichten
            </Button>
          )}
          {hasMfa && (
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={resetting || mandatory}
              title={mandatory ? 'Pflichtrolle: bitte über Admin zurücksetzen lassen' : undefined}
            >
              {resetting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldAlert className="w-4 h-4 mr-2" />}
              Authenticator zurücksetzen
            </Button>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground pt-1">
          MFA-Pflichtrollen: {MFA_REQUIRED_ROLES.join(', ')}
        </p>
      </Card>

      {/* Letzte Anmeldung */}
      <Card className="p-6 space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" /> Letzte Anmeldung
        </h2>
        <div className="text-sm">
          {lastSignIn ? (
            <>
              <div className="font-medium">{lastSignIn.toLocaleString('de-DE')}</div>
              <div className="text-xs text-muted-foreground">{user?.email}</div>
            </>
          ) : (
            <div className="text-muted-foreground">Keine Information verfügbar.</div>
          )}
        </div>
      </Card>

      {/* Aktive Sessions */}
      <Card className="p-6 space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Monitor className="w-5 h-5 text-primary" /> Aktive Sitzungen
        </h2>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Lädt…
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine aktiven Sitzungen erfasst.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {sessions.map((s) => (
              <li key={s.id} className="py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{s.device_info || 'Unbekanntes Gerät'}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(s.created_at).toLocaleString('de-DE')}
                    {s.ip_address ? ` · ${s.ip_address}` : ''}
                  </div>
                </div>
                {s.otp_verified_at ? (
                  <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30">MFA</Badge>
                ) : (
                  <Badge variant="outline">Standard</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] text-muted-foreground">
          Zum Beenden einer Sitzung melden Sie sich vom jeweiligen Gerät ab.
        </p>
      </Card>
    </div>
  );
}

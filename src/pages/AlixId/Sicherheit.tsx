import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, KeyRound, Fingerprint, Mail } from 'lucide-react';
import { toast } from 'sonner';
import type { AlixIdCtx } from './Layout';

export default function AlixIdSicherheit() {
  const ctx = useOutletContext<AlixIdCtx>();
  const [sending, setSending] = useState(false);

  const resendOtp = async () => {
    if (!ctx.email) return;
    setSending(true);
    await supabase.auth.signInWithOtp({ email: ctx.email, options: { shouldCreateUser: false } });
    setSending(false);
    toast.success('Prüfcode an Ihre E-Mail gesendet.');
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">Sicherheit</h1>
        <p className="text-sm text-muted-foreground">
          So schützen Sie Ihr Alix-ID-Konto und alle verbundenen Anwendungen.
        </p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <Mail className="w-4 h-4 text-primary" />
          <CardTitle className="text-base">Anmeldung per E-Mail-Code</CardTitle>
          <Badge variant="secondary" className="ml-auto">Aktiv</Badge>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            Sie melden sich mit einem 6-stelligen Einmalcode an, der an Ihre bei Alix Lasers
            hinterlegte E-Mail-Adresse gesendet wird. Der Code ist 10 Minuten gültig.
          </p>
          <Button variant="outline" size="sm" onClick={resendOtp} disabled={sending || !ctx.email}>
            Test-Code an {ctx.email} senden
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <KeyRound className="w-4 h-4 text-muted-foreground" />
          <CardTitle className="text-base">Zusätzliche Bestätigung (MFA)</CardTitle>
          <Badge variant="outline" className="ml-auto">Vorbereitung</Badge>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Für Rollen mit erweiterten Rechten wird in Kürze ein zweiter Faktor (Authenticator-App oder
          Passkey) verpflichtend. Sie werden rechtzeitig informiert, sobald diese Funktion für Ihr
          Konto aktiviert wird.
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <Fingerprint className="w-4 h-4 text-muted-foreground" />
          <CardTitle className="text-base">Passkey / Geräteanmeldung</CardTitle>
          <Badge variant="outline" className="ml-auto">Bald verfügbar</Badge>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Passkeys erlauben Anmeldung per Fingerabdruck, Face ID oder Sicherheitsschlüssel, ganz
          ohne E-Mail-Code. Die technische Grundlage ist bereits vorbereitet und wird nach dem
          AlixWork-Pilot freigeschaltet.
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <ShieldCheck className="w-4 h-4 text-primary" />
          <CardTitle className="text-base">Datenschutz</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Alix ID speichert ausschließlich Identitäts- und Zugriffsdaten. Fachdaten (Rechnungen,
            Anamnesen, Geräte, Schulungen, Finanzdaten) verbleiben in den jeweiligen Alix-Systemen.
          </p>
          <p>
            Alle sicherheitsrelevanten Ereignisse (Anmeldung, App-Öffnung, Fehlversuche) werden im
            Protokoll unter „Aktivitäten" für Sie einsehbar gespeichert.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

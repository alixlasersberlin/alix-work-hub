/**
 * DATENSCHUTZ (Prompt 7, Punkt 49/50/84/85/98)
 * Zeigt faktisch, welche Daten die mobile App verarbeitet. Keine erfundenen
 * juristischen Aussagen – fehlende URLs werden als offen markiert.
 */
import { useEffect, useState } from 'react';
import { ShieldCheck, ExternalLink, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { wipeLocalSensitiveData, maskEmail } from '@/lib/mobil/security';
import { useAuth } from '@/hooks/useAuth';

const DATA_MAP: { label: string; detail: string }[] = [
  { label: 'Kontaktdaten (Kunden)', detail: 'Name, Telefon, E-Mail – nur zur Bearbeitung von Vorgängen, aus bestehenden AlixWork-Stammdaten.' },
  { label: 'Kundenkommunikation', detail: 'WhatsApp-Nachrichten und Anhänge im privaten Storage-Bucket, Zugriff nur über kurzlebige signierte Links.' },
  { label: 'Benutzer-IDs', detail: 'Interne Mitarbeiter-ID zur Zuordnung von Zuweisungen, Notizen und Audit-Einträgen.' },
  { label: 'Geräte-IDs / Push-Token', detail: 'Zur Zustellung interner Benachrichtigungen. Push-Token sind für andere Nutzer nicht lesbar.' },
  { label: 'Diagnosedaten', detail: 'App-Version, Plattform, Verbindungsstatus – ohne Kundeninhalte und ohne Tokens.' },
  { label: 'KI-Verarbeitung', detail: 'Nur der minimal nötige Gesprächsausschnitt wird zur Analyse übertragen; Vorschläge werden nie automatisch an Kunden gesendet.' },
];

export default function MobilDatenschutz() {
  const { profile } = useAuth();
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from('app_settings')
        .select('key, value')
        .in('key', ['privacy_policy_url', 'terms_url', 'support_url']);
      const map: Record<string, string> = {};
      (data ?? []).forEach((r: any) => { if (r.value) map[r.key] = String(r.value).replace(/^"|"$/g, ''); });
      setUrls(map);
    })();
  }, []);

  const link = (key: string, label: string) =>
    urls[key] ? (
      <a href={urls[key]} target="_blank" rel="noreferrer" className="text-primary text-sm inline-flex items-center gap-1">
        {label} <ExternalLink className="w-3 h-3" />
      </a>
    ) : (
      <div className="text-sm">
        {label} <Badge variant="destructive" className="ml-1">REQUIRED BEFORE STORE SUBMISSION</Badge>
      </div>
    );

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-primary" /> Datenschutz</h1>

      <Card className="p-4 space-y-2">
        <div className="text-sm font-semibold">Angemeldet als</div>
        <div className="text-xs text-muted-foreground">{maskEmail(profile?.email)}</div>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="text-sm font-semibold">Diese Daten verarbeitet die mobile App</div>
        {DATA_MAP.map((d) => (
          <div key={d.label}>
            <div className="text-sm">{d.label}</div>
            <div className="text-[11px] text-muted-foreground">{d.detail}</div>
          </div>
        ))}
      </Card>

      <Card className="p-4 space-y-2">
        <div className="text-sm font-semibold">Lokale Speicherung</div>
        <p className="text-[11px] text-muted-foreground">
          Lokal liegen ausschliesslich Anzeigedaten (Listen-Cache), Geräteeinstellungen und – falls aktiviert – der
          PIN-Hash. Keine Passwörter, keine API-Schlüssel, keine WhatsApp- oder KI-Zugangsdaten.
        </p>
        <Button variant="outline" size="sm" onClick={() => { wipeLocalSensitiveData({ keepUnlockMethods: true }); toast.success('Lokaler Cache gelöscht.'); }}>
          <Trash2 className="w-4 h-4 mr-2" /> Lokalen Cache löschen
        </Button>
      </Card>

      <Card className="p-4 space-y-2">
        <div className="text-sm font-semibold">Rechtliche Hinweise</div>
        {link('privacy_policy_url', 'Datenschutzerklärung')}
        {link('terms_url', 'Nutzungsbedingungen (optional)')}
        {link('support_url', 'Support')}
        <p className="text-[11px] text-muted-foreground">
          Zugänge werden zentral durch AlixWork verwaltet. Eine Kontolöschung erfolgt organisatorisch über die
          Administration (Zugang deaktivieren), nicht selbstständig in der App.
        </p>
      </Card>
    </div>
  );
}

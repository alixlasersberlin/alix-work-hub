import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ALIXWORKS_PUBLIC_BASE, bookingUrl } from '@/lib/esc/public-url';
import { issueFeedToken } from '@/lib/esc/calendar-sync';
import { Copy, Link as LinkIcon, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { CalendarConnectionsCard } from '@/components/esc/CalendarConnectionsCard';


const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

export default function EscSettings() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const httpsUrl = token ? `${SUPABASE_URL}/functions/v1/esc-ics?token=${encodeURIComponent(token)}` : '';
  const webcalUrl = httpsUrl.replace(/^https?:/, 'webcal:');

  async function generate() {
    setLoading(true);
    try { setToken(await issueFeedToken()); toast.success('Persönlicher Feed-Link erstellt'); }
    catch (e: any) { toast.error(e?.message ?? 'Konnte Feed nicht erstellen'); }
    finally { setLoading(false); }
  }
  const copy = (v: string) => { navigator.clipboard.writeText(v); toast.success('In Zwischenablage kopiert'); };

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Einstellungen</h1>

      <Card>
        <CardHeader><CardTitle className="text-[14px] flex items-center gap-2"><LinkIcon className="w-4 h-4" /> E-Mail-Vorlagen</CardTitle></CardHeader>
        <CardContent className="text-[13px] space-y-2">
          <div>Pro Abteilung eigene Vorlagen für Bestätigungen, Erinnerungen, Verschiebungen, Absagen und mehr.</div>
          <a href="/esc/einstellungen/email-vorlagen" className="text-primary hover:underline text-[13px]">→ E-Mail-Vorlagen verwalten</a>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-[14px]">Öffentliche Basis-URL</CardTitle></CardHeader>
        <CardContent className="text-[13px] space-y-2">
          <div>Alle öffentlichen Links (Buchungsportal, Bestätigungen, ICS-Downloads für externe Empfänger) laufen ausschließlich über:</div>
          <code className="block bg-muted rounded px-2 py-1 text-[12px]">{ALIXWORKS_PUBLIC_BASE}</code>
          <div className="text-muted-foreground text-[12px]">
            Buchungsportal: <a href={bookingUrl()} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{bookingUrl()}</a>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-[14px] flex items-center gap-2"><LinkIcon className="w-4 h-4" /> Kalender-Synchronisation</CardTitle></CardHeader>
        <CardContent className="text-[13px] space-y-3">
          <div>Für jeden Termin steht in der Agenda ein <strong>„Zum Kalender hinzufügen"</strong>-Button (Google, Microsoft 365, Outlook, Yahoo, iCal/ICS-Datei).</div>
          <div>Kompatibel mit:</div>
          <ul className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-[12px] list-disc list-inside text-muted-foreground">
            <li>Apple / iOS Kalender</li>
            <li>Google Kalender</li>
            <li>Outlook</li>
            <li>Microsoft 365</li>
            <li>Exchange</li>
            <li>Thunderbird</li>
            <li>Samsung Kalender</li>
            <li>CalDAV (Import & Abonnement)</li>
          </ul>

          <div className="pt-3 border-t space-y-2">
            <div className="font-medium">Persönlicher Kalender-Feed (Abonnement)</div>
            <div className="text-[12px] text-muted-foreground">
              Alle Ihnen zugewiesenen Termine werden automatisch in Ihre Kalender-App synchronisiert. Der Link bleibt gültig und aktualisiert sich selbst.
            </div>
            {!token ? (
              <Button size="sm" onClick={generate} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Feed-Link erstellen
              </Button>
            ) : (
              <div className="space-y-2">
                <div>
                  <div className="text-[11px] text-muted-foreground mb-1">Ein-Klick-Abonnement (Apple, Outlook, Thunderbird)</div>
                  <div className="flex gap-2">
                    <Input readOnly value={webcalUrl} className="font-mono text-[11px]" />
                    <Button size="icon" variant="outline" onClick={() => copy(webcalUrl)}><Copy className="w-4 h-4" /></Button>
                    <Button size="sm" asChild><a href={webcalUrl}>Abonnieren</a></Button>
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground mb-1">HTTPS-URL (Google Kalender · CalDAV · andere)</div>
                  <div className="flex gap-2">
                    <Input readOnly value={httpsUrl} className="font-mono text-[11px]" />
                    <Button size="icon" variant="outline" onClick={() => copy(httpsUrl)}><Copy className="w-4 h-4" /></Button>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    Google Kalender → „Andere Kalender" → „Per URL hinzufügen" → HTTPS-Link einfügen.
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <CalendarConnectionsCard />



      <Card>
        <CardHeader><CardTitle className="text-[14px]">Sicherheit & Revision</CardTitle></CardHeader>
        <CardContent className="text-[13px] space-y-2">
          <div className="text-muted-foreground text-[12.5px]">
            Persistente DB, HMAC-signierte öffentliche Tokens, produktiver E-Mail-Versand und
            vollständiges Audit-Log für alle Termin-, Teilnehmer- und Buchungsänderungen.
          </div>
          <a href="/esc/audit" className="text-primary hover:underline text-[13px]">→ Audit-Log öffnen</a>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-[14px]">Nächste Ausbaustufen</CardTitle></CardHeader>
        <CardContent className="text-[12.5px] text-muted-foreground space-y-1">
          <div>• Erledigt (Prompt 2): Persistente Datenbank, signierte Tokens, E-Mail-Versand, Audit-Log.</div>
          <div>• Später: KI-Planung, Tourenplanung, Ressourcenplanung, QR-Check-in, digitale Unterschrift, WhatsApp / SMS, Google / Microsoft Two-Way-Sync.</div>
        </CardContent>
      </Card>
    </div>
  );
}

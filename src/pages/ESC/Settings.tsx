import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ALIXWORKS_PUBLIC_BASE, bookingUrl } from '@/lib/esc/public-url';

export default function EscSettings() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Einstellungen</h1>

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
        <CardHeader><CardTitle className="text-[14px]">Kalender-Synchronisation</CardTitle></CardHeader>
        <CardContent className="text-[13px] space-y-2">
          <div>Für jeden Termin lässt sich eine ICS-Datei erzeugen. Kompatibel mit:</div>
          <ul className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-[12px] list-disc list-inside text-muted-foreground">
            <li>Apple / iOS Kalender</li>
            <li>Google Kalender</li>
            <li>Outlook</li>
            <li>Microsoft 365</li>
            <li>Exchange</li>
            <li>Thunderbird</li>
            <li>Samsung Kalender</li>
            <li>CalDAV (Import)</li>
          </ul>
        </CardContent>
      </Card>

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

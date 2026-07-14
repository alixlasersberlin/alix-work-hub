---
name: Private interne AlixWork-App
description: Verbindliche Zero-Trust-Regeln — kein Public-Signup, keine öffentlichen Kalenderlinks, noindex, private PWA, kein Store-Release ohne Enterprise-Verteilung
type: constraint
---

# Private interne AlixWork-App (verbindlich)

Die AlixWork Kalender-App ist eine **ausschließlich interne Unternehmens-App**.
Sie darf nicht öffentlich zugänglich sein und nicht von beliebigen Personen registriert oder genutzt werden.

## Zugangsregeln
- Keine öffentliche Registrierung. Keine offene Benutzeranmeldung.
- Benutzerkonten werden ausschließlich durch einen AlixWork-Administrator angelegt oder freigeschaltet.
- Nur aktive Mitarbeiter, berechtigte Partner und ausdrücklich freigegebene Nutzer erhalten Zugriff.
- Jeder Nutzer muss Unternehmen, Standort, Team, Abteilung und Rolle zugeordnet sein.
- Nutzer ohne aktive Freigabe dürfen keine Kalenderdaten oder App-Inhalte abrufen.
- **Öffentliche Kalenderlinks sind verboten.** Termine dürfen nicht über Suchmaschinen auffindbar sein.
- Alle App-Seiten müssen `noindex, nofollow, noarchive, nosnippet` tragen (bereits in `index.html`).
- `public/robots.txt` blockt alle Crawler (Disallow: / für * und alle namentlichen Bots inkl. GPTBot/ClaudeBot/PerplexityBot/CCBot/Google-Extended).
- Keine öffentliche Benutzerliste.
- Publish-Visibility MUSS `private` bleiben.

## Private Installation (PWA)
- App wird als **private installierbare PWA** bereitgestellt.
- Installationshinweis darf erst erscheinen, wenn Nutzer: angemeldet + aktiv freigegeben + korrekte Rolle + Gerät registriert.
- Keine öffentliche Landingpage/Werbung.
- Bevorzugte URL: `https://app.alixwork.de` oder `https://alixwork.de/app`.

## Gerätefreigabe
- Neue Geräte müssen registriert werden. Admin wählt Sicherheitsstufe: Auto-Freigabe / E-Mail-Code / Admin-Freigabe / 2FA-Pflicht.
- Speichern: Nutzer, Geräte-ID, Gerätename, OS, Browser/App-Version, Registrierungsdatum, letzter Zugriff, IP (datenschutzkonform), Freigabestatus, Push-Status, Sperrstatus.
- Admins müssen Geräte sofort sperren und Sitzungen serverseitig beenden können.

## Zwei-Faktor-Authentifizierung
- Verfahren: Authenticator-App, E-Mail-Einmalcode, Passkey, Face ID, Touch ID, Fingerabdruck.
- **Pflicht** für Admins, Geschäftsführung und Nutzer mit Zugriff auf sensible Daten.

## Sitzungs- und Zugriffsschutz
- Automatische Sperre bei Inaktivität, automatische Abmeldung nach längerer Nichtnutzung.
- Re-Auth (Reauth-Gate, `useReauthGate`) beim Öffnen sensibler Kundendaten.
- Sitzungen serverseitig widerrufbar. Gesperrter Nutzer verliert Zugriff auf allen Geräten sofort.
- Gesperrtes Gerät darf trotz vorhandener Sitzung keine Daten mehr laden.
- Offline gespeicherte Daten (IndexedDB/Outbox) müssen nach Sperrung/Abmeldung gelöscht werden.

## Kein öffentlicher App Store
- Erste Version **nicht** in Apple App Store / Google Play Store.
- Bereitstellung als private PWA. Optional später Enterprise-Verteilung (Apple Business Manager / Managed Apple IDs / MDM / Google Managed Play / Android Enterprise).
- Spätere Store-Version nur, wenn weiterhin ausschließlich für freigegebene AlixWork-Nutzer nutzbar.

## Datenschutz auf dem Sperrbildschirm (Push)
- Standardmäßig **keine** vertraulichen Inhalte in Push.
- Nicht anzeigen: Kundenname, Telefon, Adresse, Gesundheits-/Behandlungsdaten, interne Notizen, Ticketinhalt, Auftragswert, Gerätedaten.
- Standardtext: „AlixWork: Eine neue Kalendererinnerung ist verfügbar."
- Volldaten erst nach Entsperrung + Authentifizierung in der App.

## Mandanten- und Abteilungstrennung
- Sichtbarkeit **serverseitig** (RLS) getrennt nach: Unternehmen, Niederlassung, Standort, Abteilung, Team, Rolle, Mitarbeiter, zugewiesenem Termin.
- Standard-Sicht: eigene Termine + freigegebene Teamtermine + Abteilungstermine + eigene Benachrichtigungen.
- Unternehmensweite Kalenderdaten nur für Geschäftsführung/berechtigte Admins.

## Sicherheitsgrundsatz — Zero Trust
Jeder Zugriff prüft: aktiver Nutzerstatus, aktive Rolle, aktive Unternehmenszuordnung, aktive Gerätefreigabe, gültige Sitzung, erforderliche 2FA, Berechtigung für den konkreten Datensatz.
**Die bloße Kenntnis einer URL darf niemals Zugriff auf Termine oder interne Daten ermöglichen.**

# MASTER SECURITY FIX V5.0 – Stand 28.11.2026

Ausgangsbasis: 433 offene native Befunde (217 kritisch / 216 Warnungen) aus `docs/security-continuation/remaining.csv`.

## Ergebnis
- 243 Befunde nach Korrektur und Live-Nachweis als behoben gemeldet (146 kritisch, 97 Warnungen); davon 53 durch frühere Korrekturen bereits behoben und heute live bestätigt (HTTP 401/410/503).
- 0 Befunde ignoriert.
- 190 Befunde der Ausgangsbasis bleiben offen (Rollen-/Mandantenumfang angemeldeter Nutzer, Datenbank-Auswertungsfunktionen, KI-Anweisungsfelder, frei wählbare SMS-/Mail-Empfänger mit Geschäftsentscheidung).

## Zentrale Korrekturen
- `_shared/security-core.ts`: HTML-Escaping, Log-Maskierung, Prüfung auf gespeicherte Empfänger/Telefonnummern.
- `_shared/portal-session.ts`, `signed-state.ts`, `campaign-link.ts`: signierte, ablaufende Berechtigungen für öffentliche Abläufe.
- `src/lib/csvSafe.ts`: CSV-Exporte neutralisieren Tabellenformeln.
- 66 Edge Functions mit `requireJobAccess`/`requireCallerAccess` abgesichert; 3 DB-Auslöser und 32 Zeitpläne auf privaten CRON_SECRET umgestellt (Uhrzeit/Aktivierung unverändert). Dabei 12 seit früheren Absicherungen abgewiesene Zeitpläne repariert.
- Dringend: `zoho-invoices-auto-import` startete mit öffentlichem Schlüssel – jetzt nur Zeitplan/Admin, feste Berichtsempfänger.
- Nebenbefund behoben: Rückgabe von `pdf-order-commit` verwies auf eine undefinierte Variable.

## Tests
- 571 Server-Regressionstests (543 bestehend + 28 zentrale), 279 Anwendungstests, Build OK.
- Live: 61 Endpunkte weisen ohne Anmeldung und mit öffentlichem Schlüssel ab; Chat, Portal, OAuth, Tracking, Meta, Download mit gefälschten Eingaben abgewiesen. Zeitpläne liefern nach Umstellung HTTP 200.

## Externe Blockaden
| Blockade | System | Fehlende Berechtigung | Handlung Administrator | Folgetest |
|---|---|---|---|---|
| Tiefenscan bricht ohne Diagnose ab | Lovable Security Scanner | keine Scanner-Logs | Tiefenscan in „Sicherheit“ erneut starten; bei erneutem Abbruch Lovable-Plattform informieren | Vollständiger Scan auf aktuellem Commit |
| Keine Testsitzung für Mitarbeiter-E2E | Externes Supabase (Auth) | Sitzung für Testkonto | Je Rolle ein Testkonto anlegen und Zugangsdaten unter Secrets hinterlegen | Rollen-E2E je Ablauf |
| Kein isolierter Restore | ALIXWORK RESTORE TEST | separates Supabase-Projekt + Zugang | Projekt gemäß Anleitung anlegen, Zugang hinterlegen | Restore + Prüfsummenvergleich |
| Meta-Webhook-Signatur | Meta App | META_APP_SECRET (falls Messenger nicht dieselbe App wie WhatsApp nutzt) | App-Secret als `META_APP_SECRET` hinterlegen | Signierte Testnachricht |

## Geschäftsentscheidung offen
- Offene-Posten-/Service-SMS erlauben frei editierbare Nummern (`op-light-send-sms`, `send-customer-sms`); Beschränkung auf gespeicherte Nummern würde den Ablauf ändern.

Bestandsschutz: 44 Produkte, 102 Zeitpläne (95 aktiv, Uhrzeiten unverändert), Product Hub gesperrt, Notstopp aktiv; keine Schlüssel geändert. Keine Produktivfreigabe.

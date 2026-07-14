# AlixWork Mobile Kalender – Phasen 7–9

## Phase 7 · Offline-Aktionsqueue ✅

- `src/lib/offline/kalender-queue.ts` – IndexedDB-Store (idb) mit enqueue/list/count/sync/clear + Pub-Sub.
- `src/hooks/useOfflineKalenderQueue.ts` – Reaktiver Zähler, automatischer Sync bei `online`-Event und beim Mount.
- `TerminDetail.tsx` – Bestätigen / Starten / Erledigt / Absagen werden bei Offline oder Netzwerkfehler in die Outbox geschrieben, UI optimistisch aktualisiert.
- `KalenderLayout.tsx` – Badge mit Zähler ausstehender Aktionen, Klick löst manuellen Sync aus.

Datenmodell: keine neue Tabelle – die Queue lebt rein clientseitig in IndexedDB und schreibt beim Sync direkt in `esc_events` (RLS greift wie gewohnt).

## Phase 8a · ICS-Feed (Read-only Sync) ✅

Nutzt die bereits vorhandene Infrastruktur:
- Edge Function `esc-feed-issue` mintet/holt persönlichen Feed-Token.
- Edge Function `esc-ics` liefert RFC-5545-kompatibles ICS für Apple, Google, Outlook, Thunderbird.
- Tabelle `esc_ics_tokens` speichert Tokens mit 5-Jahre-Gültigkeit.

Neu:
- `src/components/kalender/IcsFeedCard.tsx` – Zeigt Feed-URL, „Kopieren", `webcal://`-Abonnieren-Button, „Neu ausstellen".
- In `MobileKalender/Einstellungen.tsx` unter „Externer Kalender" eingebunden.

Anleitungen für Apple / Google / Outlook stehen direkt auf der Karte.

## Phase 8b · Google/Outlook OAuth (2-Wege) – **später bei Bedarf**

Grund: Techniker legen Termine ausschließlich im Alix-Kalender an. Der Read-only ICS-Feed reicht für 95 % der Anwendungsfälle. OAuth-Anbindung an Google/Microsoft würde bedeuten:
- Google Cloud Console Projekt + OAuth-Consent-Screen-Verification (kann Wochen dauern)
- Azure App Registration + Graph-API-Berechtigungen
- Watch-Channels & Change-Tracking
- Konfliktauflösung wenn beide Seiten schreiben

Aufheben wir uns auf, wenn ein Kunde/Mitarbeiter das konkret nachfragt.

## Phase 9 · Store-Release-Pipeline ✅ (Setup ausgeliefert, Ausführung außerhalb Lovable)

- `.github/workflows/ios-release.yml` – macOS-Runner, `fastlane beta|release` → TestFlight/App Store.
- `.github/workflows/android-release.yml` – Ubuntu-Runner, `fastlane internal|beta|production` → Play Console.
- `ios/fastlane/Fastfile` – Match für Zertifikate, App Store Connect API-Key, TestFlight- + App-Store-Lane.
- `android/fastlane/Fastfile` – Gradle bundleRelease + Play-Service-Account-JSON, drei Tracks.
- `docs/store-release.md` – Komplette Anleitung: Secrets, Keystore, Match, erster Release.

Was der User machen muss:
1. Projekt via „Export to GitHub" in eigenes Repo bringen.
2. `npx cap add ios/android` einmalig lokal, `bundle add fastlane`.
3. GitHub-Secrets hinterlegen (Liste in `docs/store-release.md`).
4. Actions → Workflow manuell triggern.

Erster Release bleibt manuell (Screenshots/Beschreibung in App Store Connect / Play Console). Ab dem 2. Release genügt ein Klick auf „Run workflow".

## Was ist danach noch offen?

Nichts Geplantes. Weitere sinnvolle Ausbaustufen (kein Zwang, alles Kür):
- Push-Templates für Terminarten anpassbar machen
- Kalender-Widget für iOS/Android Home-Screen (WidgetKit / AppWidget)
- Sprachbefehl „Termin erledigt" via SiriKit / Google Assistant
- Offline-Cache für Kalenderansicht (Read-Path, aktuell nur Write-Path offline)

# Phase 6 – Native Wrapper mit Capacitor

Ziel: Aus der bestehenden PWA `/m/kalender` eine echte iOS- und Android-App bauen, die im App Store bzw. Play Store veröffentlicht werden kann. Die vorhandene PWA-Logik (Push, Reminder, Realtime) bleibt unverändert.

## Was im Lovable-Sandbox passiert

1. **Capacitor installieren**
   - `@capacitor/core`, `@capacitor/cli` (dev), `@capacitor/ios`, `@capacitor/android`
   - Zusätzlich: `@capacitor/push-notifications`, `@capacitor/app`, `@capacitor/status-bar`, `@capacitor/splash-screen`, `@capacitor/haptics`

2. **`capacitor.config.ts` erzeugen**
   - `appId`: `app.lovable.139141344b954f3fa06471f725c7d887`
   - `appName`: `AlixWork Kalender`
   - `webDir`: `dist`
   - `server.url` auf die Sandbox-Preview-URL (Hot-Reload beim Entwickeln)
   - Deep-Link-Scheme + Universal Links für `/m/kalender/termin/:id`
   - Splash- und StatusBar-Konfiguration in Dark-Theme

3. **Native-Push-Bridge**
   - Neuer Hook `useNativePush.ts` erkennt `Capacitor.isNativePlatform()`.
     - Web → bestehender Web-Push-Flow (VAPID) unverändert.
     - Native → APNs/FCM-Token via `@capacitor/push-notifications` holen und in derselben Tabelle `mobile_push_subscriptions` speichern (neue Spalten `platform`, `native_token`).
   - `push-subscribe` Edge Function nimmt beide Formen entgegen.
   - Neue Edge Function `push-send-native` versendet über FCM (Android) bzw. APNs (iOS) — reiht sich in `reminder-scheduler` ein.

4. **Native-UX-Anpassungen** (nur in `/m/kalender`)
   - StatusBar auf Dark, SplashScreen mit AlixWork-Logo.
   - Haptik beim Bestätigen/Start/Erledigt.
   - App-Icon aus vorhandenem PWA-Icon generieren.
   - Startroute in nativer Shell auf `/m/kalender`.

5. **Splash- und Icon-Assets**
   - Generierung im Standard-Capacitor-Ordner `resources/` — Bau per `@capacitor/assets` bleibt dem User überlassen (siehe unten).

## Was der User lokal machen muss (kann Lovable nicht ausführen)

Da Xcode/Android Studio nötig sind, listen wir die genauen Schritte in `.lovable/plan.md` und im Chat:

```text
1. Projekt via "Export to GitHub" exportieren
2. git pull, dann: npm install
3. npx cap add ios   # nur einmal
4. npx cap add android
5. npm run build
6. npx cap sync
7. npx cap run ios     (Mac + Xcode nötig)
8. npx cap run android (Android Studio nötig)
```

## Store-relevante Backend-Ergänzungen

- **APNs-Auth-Key** (Apple Developer): als Secret `APNS_KEY_P8`, `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_BUNDLE_ID`.
- **FCM-Service-Account-JSON**: als Secret `FCM_SERVICE_ACCOUNT_JSON`.
- Diese werden erst benötigt, wenn native Push tatsächlich ausgeliefert wird — Secrets werden per `add_secret` angefragt, sobald du "Push scharf schalten" sagst.

## Datenbank-Migration

Ergänzt `mobile_push_subscriptions` um:
- `platform` (`web` | `ios` | `android`, default `web`)
- `native_token` (text, nullable) für APNs-/FCM-Token
- Unique-Index passt sich an (`user_id, platform, coalesce(endpoint, native_token)`)

Keine neuen Tabellen, keine Änderung an bestehenden RLS-Policies.

## Sicherheit

- Native Tokens werden wie Web-Endpoints RLS-geschützt (nur eigener User).
- APNs/FCM-Secrets nur in Edge-Functions.
- Deep-Links validieren Ziel-Event über bestehende `esc_events`-RLS.

## Nicht enthalten (bewusst)

- Kein automatisches Xcode/Gradle-Build in Lovable (technisch unmöglich).
- Keine Store-Einreichung — bleibt beim User.
- Keine Änderung an der bestehenden Web-PWA-Auslieferung.

## Reihenfolge der Umsetzung

1. Migration `mobile_push_subscriptions` erweitern
2. Capacitor + Plugins installieren, `capacitor.config.ts`
3. `useNativePush.ts` + Integration in `Einstellungen.tsx`
4. Edge Function `push-send-native` + Anpassung `reminder-scheduler`
5. StatusBar/Splash/Haptics Init in `main.tsx` (nur nativ aktiv)
6. Anleitung + Store-Checkliste in `.lovable/plan.md`

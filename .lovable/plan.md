# AlixWork Mobile Kalender – Phase 6 (Capacitor Native App)

Die Web-PWA `/m/kalender` ist jetzt zusätzlich als echte iOS-/Android-App bau- und ausrollbar. Alle Web-Funktionen (Web-Push, Reminder, Realtime, Eskalations-Overlay, Audit) bleiben unverändert – der native Wrapper ergänzt nur APNs/FCM-Push und native Shell-Features.

## Was schon fertig ist

- `capacitor.config.ts` mit App-ID `app.lovable.139141344b954f3fa06471f725c7d887`, App-Name „AlixWork Kalender", Hot-Reload-URL auf die Lovable-Sandbox, Dark-StatusBar/SplashScreen, PushNotifications-Plugin aktiviert.
- Native-Init in `src/main.tsx` (nur aktiv wenn Capacitor.isNativePlatform()): StatusBar Dark, Splash ausblenden, Startroute `/m/kalender`.
- Hook `src/hooks/useNativePush.ts` registriert APNs/FCM-Token und schreibt in dieselbe Tabelle `mobile_push_subscriptions` (neue Spalten `platform`, `native_token`).
- Karte „Native Push" in `/m/kalender/einstellungen` (erscheint nur in nativer Shell).
- Edge Function `push-subscribe` akzeptiert Web-Push- und Native-Push-Subscriptions in einem Endpoint.
- Neue Edge Function `push-send-native` sendet über FCM (Android) und APNs (iOS).
- `reminder-scheduler` erkennt native Subscriptions und ruft `push-send-native` mit Service Role auf.

## Was der User lokal machen muss

Die native App muss außerhalb von Lovable gebaut werden (Xcode/Android Studio notwendig).

```bash
# 1. Projekt via "Export to GitHub" exportieren, lokal klonen
git clone <euer-repo>
cd <projekt>

# 2. Dependencies
npm install

# 3. Native-Plattformen hinzufügen (nur einmal)
npx cap add ios
npx cap add android

# 4. Web-Build erzeugen und in native Projekte syncen
npm run build
npx cap sync

# 5. Auf Emulator / Gerät starten
npx cap run ios      # Mac + Xcode erforderlich
npx cap run android  # Android Studio erforderlich

# Nach jedem git pull:
npm install && npm run build && npx cap sync
```

## Store-Vorbereitung

### App-Icons & Splash
- Icons/Splash aus dem PWA-Icon generieren, z. B.:
  ```bash
  npm install --save-dev @capacitor/assets
  # public/icon-512.png als Master ablegen
  npx capacitor-assets generate
  ```

### Apple / iOS
- Apple Developer Account nötig.
- In Xcode: Signing & Capabilities → **Push Notifications** und **Background Modes → Remote notifications** aktivieren.
- Bundle-ID `app.lovable.139141344b954f3fa06471f725c7d887` in Apple Developer registrieren.
- APNs Auth Key (.p8) erstellen und in Lovable als Secrets hinterlegen:
  - `APNS_KEY_P8` – kompletter Inhalt der .p8-Datei
  - `APNS_KEY_ID` – 10-stellige Key-ID
  - `APNS_TEAM_ID` – 10-stellige Team-ID
  - `APNS_BUNDLE_ID` – gleich der App-ID oben
  - `APNS_USE_SANDBOX` – `true` für Xcode-Debug-Builds, sonst weglassen

### Google / Android
- Firebase-Projekt anlegen, Android-App mit Package-Name `app.lovable.139141344b954f3fa06471f725c7d887` hinzufügen.
- `google-services.json` in `android/app/` ablegen.
- Service-Account-JSON (Firebase → Projekteinstellungen → Dienstkonten) als Lovable-Secret:
  - `FCM_SERVICE_ACCOUNT_JSON` – gesamter JSON-Inhalt

Sobald du sagst „Push scharf schalten", fragen wir diese Secrets über `add_secret` an.

## Nicht enthalten (spätere Phasen)

- Offline-Aktionsqueue für Bestätigen/Start/Erledigt ohne Netz.
- Automatischer Store-Upload (Fastlane etc.).
- Externe Kalender-Sync (Google/Outlook), ICS-Feeds.

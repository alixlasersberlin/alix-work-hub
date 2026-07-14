# Store-Upload-Pipeline (Phase 9)

Automatischer Build & Upload in TestFlight / Play Console via GitHub Actions + Fastlane.
Läuft **nicht** in Lovable – du musst das Projekt via „Export to GitHub" in dein eigenes Repo bringen und die Secrets dort hinterlegen.

## 1. Repo vorbereiten (einmalig, lokal)

```bash
git clone <dein-repo>
cd <projekt>
npm install
npx cap add ios
npx cap add android
cd ios && bundle init && bundle add fastlane && cd ..
cd android && bundle init && bundle add fastlane && cd ..
git add . && git commit -m "phase9: add native + fastlane"
git push
```

## 2. GitHub Secrets

### iOS (Repo → Settings → Secrets → Actions)

| Secret | Wert |
|---|---|
| `APPLE_TEAM_ID` | 10-stellige Team-ID aus Apple Developer |
| `APP_STORE_CONNECT_API_KEY_ID` | Key-ID aus App Store Connect → Users & Access → Keys |
| `APP_STORE_CONNECT_API_ISSUER_ID` | Issuer-ID (gleiche Seite) |
| `APP_STORE_CONNECT_API_KEY_BASE64` | `.p8`-Datei base64-encoded: `base64 -i AuthKey_XXXX.p8 \| pbcopy` |
| `MATCH_GIT_URL` | Privates Repo für Zertifikate (fastlane match) |
| `MATCH_GIT_BASIC_AUTHORIZATION` | `base64("user:token")` mit `repo`-Scope |
| `MATCH_PASSWORD` | Passwort zum Ver-/Entschlüsseln der match-Zertifikate |
| `FASTLANE_APPLE_APP_PW` | App-spezifisches Passwort deiner Apple-ID |

Einmalig lokal ausführen (legt Zertifikate im match-Repo an):
```bash
cd ios && bundle exec fastlane match appstore
```

### Android (Repo → Settings → Secrets → Actions)

| Secret | Wert |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | `.jks`-Datei base64-encoded: `base64 -i release.keystore \| pbcopy` |
| `ANDROID_KEYSTORE_PASSWORD` | Passwort des Keystores |
| `ANDROID_KEY_ALIAS` | Alias-Name (z. B. `alixwork`) |
| `ANDROID_KEY_PASSWORD` | Passwort des Keys |
| `PLAY_JSON_KEY_BASE64` | Service-Account-JSON aus Play Console → API-Access → Service Account → base64 |

Keystore einmalig erzeugen:
```bash
keytool -genkey -v -keystore release.keystore -alias alixwork \
  -keyalg RSA -keysize 2048 -validity 10000
```

## 3. Release triggern

- **GitHub → Actions → „iOS Release (TestFlight)" → Run workflow → Lane wählen** (`beta` = TestFlight, `release` = App Store draft)
- **GitHub → Actions → „Android Release (Play Console)" → Run workflow → Lane wählen** (`internal`, `beta`, `production`)

Die Workflows machen automatisch:
1. `npm ci && npm run build`
2. `npx cap sync`
3. `fastlane <lane>` (baut, signiert, lädt hoch)

## 4. Signing-Config Android (einmaliger Handeingriff)

Nach dem ersten `npx cap add android` musst du in `android/app/build.gradle` folgende `signingConfigs` hinzufügen:

```gradle
android {
  signingConfigs {
    release {
      storeFile file("keystore/release.keystore")
      storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
      keyAlias System.getenv("ANDROID_KEY_ALIAS")
      keyPassword System.getenv("ANDROID_KEY_PASSWORD")
    }
  }
  buildTypes {
    release {
      signingConfig signingConfigs.release
      minifyEnabled false
    }
  }
}
```

## 5. Metadaten (Beschreibung, Screenshots, Icon)

Fastlane-Setup lässt Metadaten in `ios/fastlane/metadata/` bzw. `android/fastlane/metadata/android/` verwalten und automatisch mitladen (aktuell in den Lanes mit `skip_metadata: true` deaktiviert, damit die erste Version manuell in App Store Connect / Play Console gepflegt werden kann).

Sobald das erste manuelle Setup steht, kannst du `skip_metadata` entfernen und die Metadaten via `fastlane deliver init` / `fastlane supply init` in das Repo importieren.

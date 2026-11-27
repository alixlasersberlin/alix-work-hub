# AlixWork – Wiederherstellung, externe Dateien und RESTORE TEST

Stand 27.11.2026. Keine Geheimnisse in diesem Dokument; nur Namen und Herkunft.

## 1. Geschützte Einstellungen für eine Wiederherstellung

Werte liegen ausschließlich in den Supabase-Edge-Function-Secrets bzw. im Supabase Vault des Produktivprojekts. Sie sind **nicht** im Backup-Archiv enthalten und müssen bei einer Wiederherstellung aus dem Passwort-/Schlüsseltresor der Geschäftsführung neu eingetragen werden (Supabase → Project Settings → Edge Functions → Secrets bzw. SQL `vault.create_secret`).

| Gruppe | Secret-Namen | Für Restore-Test eintragen? |
|---|---|---|
| Supabase (automatisch je Projekt) | SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY | automatisch vom neuen Projekt |
| Backup / Hetzner | HETZNER_S3_ENDPOINT, HETZNER_S3_REGION, HETZNER_S3_BUCKET, HETZNER_S3_ACCESS_KEY, HETZNER_S3_SECRET_KEY | nur **lesender** Schlüssel für Wiederherstellung, nie Schreibschlüssel |
| Cron / interne Aufrufe | CRON_SECRET (auch im Vault), COLLECT_CRON_SECRET, RATENPLAN_CRON_SECRET, ZOHO_DRAFT_CRON_TOKEN, INTERNAL_PUSH_SECRET, GOBD_RESTORE_TEST_TOKEN(2) | neue Zufallswerte |
| E-Mail | RESEND_API_KEY, RETURN_DUNNING_RESEND_KEY, RESEND_WEBHOOK_SECRET, SEND_EMAIL_HOOK_SECRET, CMR_SMTP_PASSWORD, IMAP_HOST/USER/PASS | **nein** |
| SMS / WhatsApp / Telefonie | TWILIO_* , WHATSAPP_* , META_* , PBX_3CX_WEBHOOK_SECRET | **nein** |
| Zoho / Bank / Shops | ZOHO_EU_1_*, ZOHO_FORMS_WEBHOOK_KEY, BANK_API_TOKEN, SHOPIFY_CLIENT_ID/SECRET, HOLLYWOOD_SECRET_TEST/LIVE_KEY, AIRTABLE_* | **nein** |
| Webseiten / Product Hub | PRODUCT_HUB_API_KEY, PRODUCT_HUB_SOURCE_KEY, GLOBAL_PRODUCT_HUB_DIRECT_RELEASE_KEY, COM/DE/BEAUTY_PRODUCT_HUB_WRITE_KEY, AE_PRODUCT_HUB_DIRECT_RELEASE_KEY, DE_EXPORT_API_KEY, ALIX_SYNC_KEY, ALIXWORK_SHARED_KEY | **nein** (eigener Test-Lesekey für product-hub-api erlaubt) |
| ALIXSMART | ALIXSMART_* , ALIXSALES_WEBHOOK_KEY, SALES_LEADS_API_KEY | **nein** |
| Push / Login / Sonstiges | VAPID_*, APNS_*, FCM_SERVICE_ACCOUNT_JSON, GOOGLE_OAUTH_*, MS_OAUTH_*, TURNSTILE_SECRET_KEY, SOCIAL_ENC_KEY, MEDIAPAKET_TOKEN_SECRET, ESC_TOKEN_SECRET, TELEMATICS_INGEST_SECRET, GOOGLE_MAPS_*, OPENROUTESERVICE_API_KEY, FIRECRAWL_API_KEY, GITHUB_TOKEN/REPO, LOVABLE_API_KEY | nur was ein Test zwingend braucht; **SOCIAL_ENC_KEY / MEDIAPAKET_TOKEN_SECRET / ESC_TOKEN_SECRET identisch**, falls verschlüsselte Altdaten gelesen werden sollen |
| Empfänger-Adressen | SUPPORT_NOTIFY_EMAIL, PRIVACY_NOTIFY_EMAIL, FLEET_NOTIFY_EMAIL, MEDIAPAKET_STAFF_INBOX, APP_URL, SITE_URL | Testwerte |
| Vault | CRON_SECRET, sms_settings_auth_token_true | neu setzen |

Zusätzlich nötig: Backup-Verschlüsselungs-Passwort des jeweiligen Downloads (vom herunterladenden Super Admin vergeben, nirgends gespeichert), Auth-Einstellungen (SMTP, MFA, Redirect-URLs), Storage-Bucket-Liste (31 private Buckets) und Cron-Jobs (werden im Restore-Test **nicht** angelegt).

## 2. Nicht gesicherte externe Produktdateien

Datei: `Externe_Produktdateien_nicht_gesichert_2026-11-27.csv` (425 Verweise, 203 eindeutige URLs, ca. 122 MB).

| Host | Verweise | Bewertung |
|---|---:|---|
| dxbrovbbwrtdsimdnrpy.supabase.co (fremdes Supabase-Projekt, Speicher `device-images`) | 322 | Weder AlixWork-Backup noch Hetzner-Spiegel |
| alix-lasers.de (Datenblätter) | 84 | Liegen auf der Webseite, nicht gesichert |
| framerusercontent.com | 19 | Fremder CDN-Anbieter |

8 Verweise sind bereits heute defekt: 7 Datenblätter auf alix-lasers.de liefern 404 (Body Glow, Blueice Hybrid Red, Blueice Fusion Red, Derma Skin, Detox 5000, Skin Master, EMS Twin Voltera AI), 1 Bild Carbon Peeling liefert 400.

Eigene Bilder/Dokumente in `product-hub-docs` und `ph-catalog-media` sind seit 27.11. in Backup und Hetzner-Spiegel enthalten.

### Konzept „Externe Dateien sichern, ohne Verweise zu ändern“

1. Neue servergeschützte Funktion `backup-external-media` (nur Cron/Service, keine öffentlichen Aufrufe) liest täglich nach dem Vollbackup alle URLs aus `ph_media`, `ph_documents`, `ph_products` (hero/offer) und `ph_seo.og_image`, deren Host nicht das AlixWork-Projekt ist.
2. Nur GET, feste Host-Allowlist (die drei oben), Weiterleitungen nur innerhalb der Allowlist, Größenlimit je Datei.
3. Ablage im privaten Bucket `backups` unter `external-media/<sha256>` (inhaltsadressiert, Duplikate entfallen) plus Index `external-media/index-<datum>.json` mit Tabelle, Datensatz-ID, Feld, Original-URL, HTTP-Status, Größe, SHA-256, Abrufzeit. Hetzner-Nachtlauf spiegelt den Ordner automatisch mit.
4. **Produktdatensätze bleiben unverändert**; die Original-URL bleibt führend. Bei einer Wiederherstellung wird die Datei über den Index der URL zugeordnet.
5. Defekte (404/400) werden im Index markiert und im Backup-Bericht gemeldet, nicht entfernt.
6. Später optional (Product-Hub-Schritt „Bilder bereitstellen“): Dateien kontrolliert in einen eigenen öffentlichen Produktbild-Speicher übernehmen – erst nach Freigabe.

Umsetzung erst nach Ihrer Freigabe (keine neuen Tabellen nötig).

## 3. Separates Projekt „ALIXWORK RESTORE TEST“

Ein neues Supabase-Projekt kann ich nicht selbst anlegen. Anleitung für den Administrator:

1. supabase.com → Organisation von AlixWork → **New project**. Name `ALIXWORK RESTORE TEST`, Region wie Produktion (EU Frankfurt), eigenes starkes DB-Passwort, kleinster Compute-Plan.
2. **Nichts** aus der Produktion verknüpfen: keine Custom Domain, kein Auth-SMTP (E-Mail-Versand bleibt beim Supabase-Standard mit Limit; zusätzlich Auth → Providers → Email: „Confirm email“ aus, keine Einladungen versenden), keine Webhooks, keine Realtime-Abonnenten, keine Cron-Jobs.
3. Netzwerk: Edge Functions im Testprojekt **nicht** bereitstellen, außer explizit benötigten Lesefunktionen. Keine Secrets für E-Mail, SMS, WhatsApp, Zoho, Bank, Shopify, Webseiten oder ALIXSMART eintragen (siehe Tabelle oben) – dadurch sind ausgehende Aufrufe technisch unmöglich.
4. In AlixWork/Lovable ein **eigenes** Lovable-Projekt „ALIXWORK RESTORE TEST“ (Remix dieses Projekts) mit dem neuen Supabase-Projekt verbinden – niemals dieses produktive Projekt umhängen.
5. Für die Wiederherstellung bereitstellen: (a) Schema-Export der Produktion (Supabase → Database → Backups oder `supabase db dump --schema-only` durch den Administrator), (b) verschlüsselten Backup-Download aus AlixWork → Datensicherung plus Passwort, (c) lesenden Hetzner-Schlüssel für Originaldateien.
6. Danach im Restore-Projekt: Schema einspielen, `cron.job` leeren, Tabellen aus NDJSON importieren, Dateien in gleichnamige private Buckets laden, Prüfprotokoll (Zeilenzahlen und SHA-256 gegen Manifest, 44 Geräte, 313 Bilder, 101 Dokumente, Zuordnungen, Übersetzungen) erzeugen.
7. Testprojekt nach Abnahme pausieren; produktive Daten darin wie Produktion vertraulich behandeln.

Bitte die Projekt-ID des neuen Supabase-Projekts und den Namen des Lovable-Testprojekts mitteilen; Zugangsdaten nur über die Secret-Eingabe, nie im Chat.

## 4. Neue Backup-Funktionen (umgesetzt)

- Fortschritt: aktuelle Tabelle/Speicher „i von n“, Prozent, Dateien, gesicherte MB, ausstehende Tabellen/Speicher; Seite aktualisiert sich alle 10 s.
- SHA-256 je Tabellenteil im Manifest (Version 5); Hetzner-Upload speichert SHA-256 als Objekt-Metadatum.
- Button „Hetzner prüfen“: vergleicht jede Manifest-Datei mit der Hetzner-Kopie (vorhanden, Größe, SHA-256). Ältere Kopien ohne Prüfsumme werden als „ohne Prüfsumme“ gezählt.
- Fehler-E-Mail an rde@alix-lasers.com: wie bisher bei Fehlern, neu auch für vom Watchdog abgebrochene Läufe (beim nächsten Start, einmal je Sicherung).
- Dashboard-Warnung für Admins, wenn seit mehr als 24 h keine erfolgreiche Vollsicherung vorliegt.
- Button „Fortsetzen“ bei fehlgeschlagenen Läufen: setzt ab gespeichertem Zwischenstand fort.

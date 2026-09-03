---
name: ALIXWORK MOBILE Push & Eskalationen
description: Push-Benachrichtigungen (FCM/APNs/Web-Push), Notification Center, Preferences und Eskalations-Engine für die ALIX INBOX
type: feature
---
# ALIXWORK MOBILE – Prompt 3

- Edge Function `send-mobile-notification`: ermittelt Empfänger **immer serverseitig** (Zuweisung → Abteilung/Rollen), prüft `notification_preferences`, Ruhezeiten, Preview/Datenschutz, Dedup (`notification_events.dedup_key`) und Burst-Debounce (60 s), versendet FCM/APNs/Web-Push mit bis zu 3 Versuchen und protokolliert in `notification_events` + `app_notifications`.
  - Client-Aufrufe dürfen nur `TEST`/`SYSTEM` an sich selbst auslösen; alles andere erfordert Service-Role.
- Edge Function `escalation-engine` (Cron `escalation-engine-2min`, alle 2 Min.): plant Stufen aus `escalation_rules` (P1 5/10/15, P2 15/30/45), storniert bei Antwort/Zuweisung/Erledigt/Prio-Senkung, löst Stufen aus.
- `ac-webhook-whatsapp` ruft nach dem Speichern der Nachricht den Dispatch auf — Push-Fehler dürfen die Speicherung nie beeinflussen.
- Geräte liegen in `mobile_push_subscriptions` (kein `push_devices`), Registrierung über `src/lib/mobile/push-registration.ts` (`device_id` im localStorage).
- Seiten: `/mobil/benachrichtigungen`, `/mobil/einstellungen/benachrichtigungen`, `/mobil/push-diagnose`, `/mobil/admin/eskalationen`.
- **Native Voraussetzung:** APNs/FCM-Secrets (`FCM_SERVICE_ACCOUNT_JSON`, `APNS_*`) sind noch NICHT gesetzt → für iOS/Android-Hintergrund-Push gilt `NATIVE BUILD REQUIRED`; ohne Secrets läuft nur Web-Push (VAPID).

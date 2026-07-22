---
name: ALIX CONNECT Phase 48-50 + AlixDocs 13-14
description: Churn Detection, Voice-Bot Twilio, Omnichannel-Merge, AlixDocs Compliance-Export, Facsimile Mietkauf, Auftragsabgleich Auto-Import
type: feature
---
- **Phase 48 Churn Detection** — Edge Fn `ac-churn-predict` (heuristik_v1 aus Inaktivität, Sentiment, Engagement, Missed Calls), Ergebnisse in `ac_predictions` (kind='churn_prediction'). Route `/connect/churn-detection` (Super Admin).
- **Phase 49 Voice-Bot Twilio** — Edge Fn `ac-voice-twilio-webhook` (TwiML/IVR: 1 Vertrieb, 2 Service, 3 Buchhaltung; Business Hours 08–18 Berlin; Voicemail via `ac-voicemail-transcribe`). Setup-Seite `/connect/voice-bot-twilio`. Webhook: `https://<projectRef>.functions.supabase.co/ac-voice-twilio-webhook`.
- **Phase 50 Omnichannel-Merge** — Edge Fn `ac-omnichannel-merge` (Union-Find über E-Mail + letzte-8-Ziffern-Telefon, Master = ältester Kontakt). Dry-Run + Merge unter `/connect/omnichannel-merge`.
- **AlixDocs Phase 13 E-Sign-Bridge** — bereits vorhanden via `alixdocs-sign-request` und Button in `DocActionsMenu.tsx` (Zur E-Signatur senden).
- **AlixDocs Phase 14 Compliance-Export** — Edge Fn `alixdocs-compliance-export` erzeugt GoBD/DSGVO-Manifest mit SHA-256 pro Datei + Kettenhash + 7-Tage-Signed-URLs. Nur Super Admin/Admin. Route `/dokumente/compliance-export`. Audit-Log-Eintrag `compliance_export`.
- **Facsimile Mietkauf** — neuer `doc_type='lease_purchase'` in `sig-apply-facsimile` ALLOWED_TYPES + Settings-UI. `MietkaufDialog.tsx` nutzt jetzt `downloadStampedPdf('lease_purchase', ...)`.
- **Auftragsabgleich Auto-Import** — Button „Fehlende automatisch importieren" in `AuftragsAbgleich.tsx` triggert `zoho-orders-reconcile` mit `import:true`.
- APP_VERSION → 5.14.

# Phase 4 – ALIX SIGN PRO

Umfang: alle vier gewählten Blöcke. Vorgeschlagene Reihenfolge (unabhängig lauffähig, ohne Blocker):

1. **Templates & Wiederverwendung** (Fundament — spätere Blöcke bauen darauf auf)
2. **CRM-Deep-Integration** (nutzt Templates via Ein-Klick)
3. **Rechtssicherheit & Compliance** (härtet bestehende + neue Flows)
4. **Kunden-Signatur-Portal** (setzt auf gehärteten Backend-Stack)

---

## 1. Templates & Wiederverwendung

**Backend (Migration)**
- `sig_templates` (bereits vorhanden) erweitern: `default_signer_roles jsonb`, `default_expiry_days int`, `default_message text`, `preview_thumb_url text`, `usage_count int default 0`, `last_used_at timestamptz`, `category text`.
- `sig_template_fields` (neu): `id, template_id, page_index, x/y/width/height, field_type, signer_index, required, default_value` + Grants + RLS (Owner/Admin schreibt, Rolle liest).
- Trigger: `usage_count`/`last_used_at` bei Anwendung hochzählen.

**UI**
- `/admin/signaturen` Tab „Templates" – Liste, Kategorie-Filter, Duplizieren, Löschen, Vorschau.
- `TemplateEditor.tsx` – PDF hochladen, Felder via `FieldEditor` platzieren, Signer-Rollen definieren, speichern.
- `/signaturen/neu` – Auswahl „Aus Template starten" → Dokument + Feldpositionen + Standard-Signer/Message vorbelegt.

## 2. CRM-Deep-Integration

**Einbau-Punkte für `<SignatureRequestButton>`** (jeweils mit prefilled `entity_ref`, `title`, Kunde, Template-Vorschlag):
- `RepairOrderDetail` – Reparaturauftrag & Kostenvoranschlag
- `OfferDetail` / Angebotsliste – Angebot / Auftragsbestätigung
- `finance_incoming_invoices` Detail – Rechnungs-Freigabe intern
- `MaintenanceConfirmationDetail` – Wartungsprotokoll
- `AzInvoiceTab` / `DeliveryNoteTab` – Anzahlungs- und Lieferscheinunterschrift
- `AfterSales/CaseDetail` – Kulanzvereinbarung

**Status-Sync zurück**
- Edge Function `sig-entity-sync` – bei `document.signed`/`declined` Webhook-Event: passendes Ziel-Modul updaten (z.B. `orders.signature_status`, `offers.signed_at`).
- Migration: pro Ziel-Tabelle `signature_status text`, `signature_signed_at timestamptz`, `signature_document_id uuid` (nur wo noch nicht vorhanden).
- Anzeige: Badge „✍️ Signiert am …" in den jeweiligen Detailseiten.

## 3. Rechtssicherheit & Compliance

**Backend**
- Edge Function `sig-tsa-timestamp` – RFC 3161 Zeitstempel-Request an konfigurierten TSA-Provider (Secret `TSA_URL`, optional Auth). Fallback: intern signierter Zeitstempel + Warn-Flag.
- `sig-render-final` erweitern:
  - PAdES-B-LT / LTV Vorbereitung (Zertifikatskette + OCSP/CRL einbetten wenn TSA-Cert vorhanden).
  - Sichtbares Zertifikats-Panel auf letzter Seite (Signer, Zeit, IP, Geräte-Hash, TSA-Token-Hash).
- Neue Migration: `sig_audit_log.prev_hash text`, `sig_audit_log.entry_hash text`  → Hash-Chain (jeder Eintrag = SHA-256 über `prev_hash|payload`).
- Trigger `sig_audit_log_chain` (BEFORE INSERT) berechnet `entry_hash`.

**UI**
- `SignatureCertificate.tsx` – Downloadbarer PDF-Prüfbericht pro Signatur: Timeline, Hash-Chain-Verifikation, OTP-Nachweis, TSA-Token, IP/UA.
- Button „Prüfbericht" in `/signaturen` Detail + Cockpit.
- Admin-Panel: TSA-URL & Testlauf.

## 4. Kunden-Signatur-Portal

**Backend**
- Neuer Endpoint in bestehendem Customer-Portal-Kontext.
- Edge Function `sig-portal-list` – gibt für eingeloggten Portal-User (`customer_portal_users`) alle `sig_requests` seines `customer_id` zurück (offen + abgeschlossen).
- RLS: Portal-User dürfen eigene `sig_signatures` + Finaldokumente lesen (via `security definer` Funktion `is_portal_customer(_customer_id)`).

**UI (`/portal/signaturen`)**
- Tabs: „Offen" / „Erledigt" / „Archiv".
- Karte pro Dokument: Titel, Status, Ablauf, „Jetzt unterschreiben"-CTA (öffnet bestehende `SignDocPublic`-Seite mit Portal-Session-Handoff, ohne OTP wenn Portal-Login < 24 h).
- „Herunterladen" (Original + Finales signiertes PDF + Prüfbericht).
- Wiedervorlage: `remind_at` setzen → Reminder-Cron respektiert.

---

## Technische Notizen

- Alle Migrationen: `GRANT` + RLS + `has_role(...)` gemäß bestehender Konventionen.
- Neue Secrets (nur wenn Compliance-Block aktiviert wird): `TSA_URL`, optional `TSA_AUTH_HEADER`.
- Kein neues Deps-Bündel – `pdf-lib`, `pdfjs-dist`, `jsPDF` bereits im Projekt.
- Cron: bestehender `sig-reminders-run` deckt Portal-Wiedervorlage mit ab.

## Deliverables pro Block (in Reihenfolge)

```text
Block 1  → Migration templates+fields, TemplateEditor, /admin Tab, Wizard-Integration
Block 2  → SignatureRequestButton in 6 Modulen, sig-entity-sync Function, Status-Badges
Block 3  → Hash-Chain-Migration+Trigger, sig-tsa-timestamp Function,
           sig-render-final Erweiterung, Certificate-PDF Generator, Admin-TSA-Config
Block 4  → RLS-Helper, sig-portal-list Function, /portal/signaturen Seite,
           Portal-Session-Handoff in SignDocPublic
```

Nach jedem Block: kurzer Test-Hinweis, dann direkt weiter zum nächsten. Am Ende Publish-Vorschlag.

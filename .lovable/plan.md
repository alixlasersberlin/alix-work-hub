# Phase 5 – ALIX SIGN PRO Ausbau

Aufbauend auf Phase 4 (Templates, CRM-Sync, Compliance, Portal). Vier Arbeitspakete, alle in einem Rutsch umgesetzt, jeweils mit Migration + UI + Edge Function wo nötig.

## 1. Mobile Signatur-App (PWA für Techniker vor Ort)

**Route:** `/m/signaturen` (im bestehenden `/m` PWA-Layout)

- **Neue Seite** `src/pages/mobile/MobileSignaturen.tsx`
  - Liste offener `sig_requests` mit Filter „Meine Aufträge / Heute / Alle"
  - Detail: PDF-Vorschau, Touch-Signatur-Pad (bereits vorhanden via `SignaturePad` Komponente wiederverwenden)
  - QR-Scan Button → öffnet direkt Signatur-URL (`html5-qrcode` bereits im Projekt)
- **Offline-Cache** via bestehender Outbox (`src/lib/mobile/outbox.ts`):
  - Neuer Store `sig_pending`: `{request_id, signature_blob, timestamp, geo}`
  - Auto-Sync bei Reconnect → ruft `sig-submit` Edge Function
- **Menü**: Eintrag in `src/pages/mobile/MobileLayout.tsx` unter „Signaturen"

## 2. Marketplace & White-Label

**Ziel:** Externe Partner (Praxen, Werkstätten) buchen ALIX SIGN als Service.

- **Neue Tabellen** (Migration):
  - `sig_partners`: name, slug, logo_url, primary_color, custom_domain, plan (`starter|pro|enterprise`), api_key_hash, status, monthly_quota, used_quota
  - `sig_partner_usage`: partner_id, month, signatures_count, api_calls, revenue_cents
- **RLS**: nur Super Admin CRUD; Partner-User (neue Rolle `sig_partner`) sieht nur eigenen Datensatz
- **Admin-UI** `/admin/sign-marketplace`:
  - Partner-CRUD, API-Key generieren, Branding-Editor (Logo, Farbe, Domain), Usage-Dashboard, Rechnungs-Export CSV
- **White-Label**: Signer-Portal (`/sign/:token`) lädt Branding aus `sig_partners` via Slug/Domain-Detection
- **Edge Function** `sig-partner-api` (verify_jwt=false, HMAC via API-Key):
  - `POST /requests` – neue Signaturanfrage
  - `GET /requests/:id` – Status
  - `POST /webhooks` – Callback-Registrierung

## 3. KI-Assistent Sign

Nutzt Lovable AI Gateway (`google/gemini-3-flash-preview`).

- **Edge Function** `sig-ai-analyze`:
  - Input: `document_id`
  - Lädt PDF-Text (pdfjs), sendet an Gemini mit System-Prompt „Vertragsanalyse Deutsch, DSGVO/BGB"
  - Output JSON: `{ risk_score: 0-100, clauses: [{type, risk, quote, suggestion}], summary, suggested_fields: [{type, page, x, y, w, h, label}] }`
  - Speichert in neuer Tabelle `sig_ai_analyses` (document_id, risk_score, payload jsonb, model, tokens_used)
- **UI-Integration** in `DigitaleSignaturNeu.tsx` Wizard-Schritt 2:
  - Button „KI-Analyse starten" → Card mit Risk-Badge, Klausel-Liste, „Felder automatisch platzieren" (übernimmt `suggested_fields` in Field-Editor)
- **Detail-Panel** in `DigitaleSignaturen.tsx` List-Row expandable: KI-Zusammenfassung

## 4. Massen-Workflows & Approval

- **Neue Tabellen**:
  - `sig_approval_chains`: template_id, steps jsonb `[{order, role, user_id}]`
  - `sig_approval_states`: request_id, chain_id, current_step, status (`pending|approved|rejected`), history jsonb
  - `sig_bulk_jobs`: uploaded_by, template_id, csv_url, total, processed, failed, status
- **Approval-Flow**:
  - Bei `sig_requests.insert` mit Chain-Bindung → Status `awaiting_approval`
  - Approver bekommt `app_notifications` + Row auf neuer Seite `/signaturen/genehmigungen`
  - Approve/Reject rückt Step weiter; nach letztem Step → Request wird versendet
- **Bulk-Import** UI `/signaturen/bulk`:
  - Drag&Drop CSV (Spalten: email, name, entity_type, entity_id, custom_fields…)
  - Template-Auswahl, Vorschau, Start
  - Edge Function `sig-bulk-create` verarbeitet asynchron, Progress via Realtime
- **SLA-Dashboard** `/signaturen/dashboard`:
  - KPI-Cards: Ø Signaturzeit, Overdue, Approval-Backlog
  - Charts (recharts): Requests/Tag, Conversion Rate, Provider-Latenz

## Menü-Ergänzungen (AppLayout ALIX SIGN PRO)

- Dashboard → `/signaturen/dashboard`
- Bulk-Versand → `/signaturen/bulk`
- Genehmigungen → `/signaturen/genehmigungen`
- Marketplace → `/admin/sign-marketplace` (nur Super Admin)

## Technische Details

- Migration in **einem** SQL-Block: 6 neue Tabellen + GRANTs + RLS + Trigger für `updated_at`
- Neue Rolle `sig_partner` in `app_role` Enum
- Storage-Bucket `sig-bulk-imports` (private) für CSV-Uploads
- Secret `LOVABLE_API_KEY` bereits vorhanden für KI-Modul
- Realtime Publication für `sig_bulk_jobs`, `sig_approval_states`

## Reihenfolge der Umsetzung

1. Migration (Tabellen, Rolle, Storage-Bucket, Realtime)
2. Edge Functions parallel: `sig-partner-api`, `sig-ai-analyze`, `sig-bulk-create`
3. UI-Seiten parallel: Mobile, Marketplace-Admin, Bulk, Approvals, Dashboard, KI-Panel im Wizard
4. Menü + Routen in `App.tsx` / `AppLayout.tsx` / `MobileLayout.tsx`

Bestätigen zum Starten?

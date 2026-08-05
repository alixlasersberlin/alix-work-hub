---
name: CMR Mandant (Cloud Marketing Research)
description: Eigenständiger Mandant CMR unter /cmr — Belege, Projekte, Abos, Mahnwesen, PDF-/E-Mail-Vorlagen, eigene Buchhaltung
type: feature
---
Mandant „CMR" (tenants.code = 'CMR'), rein additiv, ohne Eingriff in Alix-Lasers-Prozesse.

Seiten unter `/cmr`: Dashboard, Belege & Vorgänge, Kunden, Artikelstamm (inkl. Kategorienverwaltung),
Projekte, Abrechnungen (Abos), Buchhaltung (inkl. CSV-Export + USt-Auswertung), Mahnwesen, Einstellungen.

Tabellen: `cmr_settings`, `cmr_items`, `cmr_item_categories`, `cmr_documents` (+ `cmr_document_items`),
`cmr_payments`, `cmr_number_ranges`, `cmr_pdf_templates`, `cmr_email_templates`, `cmr_projects`, `cmr_recurring_plans`.
RLS: `has_tenant_access(tenant_id)`, DELETE nur Super Admin.

Regeln:
- Belegnummern immer über RPC `cmr_next_document_number`.
- Folgebelege setzen `parent_document_id` (Angebot → AB → Rechnung → Gutschrift/Mahnung).
- Mahnstufen auf `cmr_documents.reminder_level` (1 = Zahlungserinnerung, 2/3 = Mahnung).
- PDFs: `generateCmrDocumentPdf` + `loadCmrPdfOptions` (Vorlage je Belegart: Akzentfarbe, Logo, Wasserzeichen, QR).
- Versand: Edge Function `cmr-send-document` — nutzt SMTP aus `cmr_settings` (Secret `CMR_SMTP_PASSWORD`), sonst Resend; BCC rde@alix-lasers.com.
- Wiederkehrende Abrechnung: Edge Function `cmr-recurring-run`, Cron `cmr-recurring-daily` täglich 05:30 UTC.

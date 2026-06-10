---
name: Finance Phase 6 E-Rechnung & Belege
description: XRechnung/ZUGFeRD-Generierung, GoBD-Belegarchiv, Eingangsrechnungen Kreditoren-Light
type: feature
---
Phase 6 – E-Rechnung & elektronische Belege:
- Tabellen: `finance_documents` (Belegarchiv, 10J Retention), `finance_incoming_invoices` (Kreditoren-Light, internal_number ER-YYYY-NNNNN über Sequence/Trigger)
- Storage-Bucket: `finance-documents` (privat) — muss einmalig im Dashboard angelegt werden, RLS-Policies bereits gesetzt
- Edge Functions:
  - `finance-einvoice-generate`: erzeugt XRechnung 2.3 (UN/CEFACT CII) XML, optional Archivierung in Bucket + finance_documents
  - `finance-einvoice-parse`: erkennt CII/UBL und extrahiert Rechnungsnr/Datum/Beträge/Lieferant aus hochgeladenem XML
- Seiten:
  - `/finance/belege` – Belegarchiv (Upload/Download via Signed URLs, Suche, Typ-Filter, Hash SHA-256)
  - `/finance/eingangsrechnungen` – Erfassung mit XML-Auto-Parse, Workflow erfasst→geprüft→freigegeben→bezahlt
- Rollen: Lesen Finance/Admin/Super Admin/Geschäftsführung; Schreiben Finance/Admin/Super Admin; Freigabe nur Super Admin/Geschäftsführung; DELETE nur Super Admin

---
name: Ratenplan-Synchronisierung aus ALIXDOCS
description: Liefertermin-Erkennung per OCR/KI aus ALIXDOCS und Verschiebung des Ratenplans (erste Rate = 1. des Folgemonats) unter /finance/ratenplan-sync
type: feature
---
Modul unter **Finanzen → RATENZAHLER → Ratenplan synchronisieren** (`/finance/ratenplan-sync`), nur Admin/Super Admin.

- Edge Function `ratenplan-sync` mit Aktionen `scan` (Dry Run), `apply`, `rollback`, `correct`.
- Datenquelle ausschließlich ALIXDOCS (`alixdocs_documents`, OCR-Text). Dokumentpriorität: Übergabeprotokoll > Installationsprotokoll > Lieferschein > Delivery Note > Versandnachweis > Transportdokument. Datumspriorität: Lieferdatum > Übergabedatum > Installationsdatum > Versanddatum, sonst Dokumentdatum = „geschätzt“.
- KI-Fallback über Lovable AI Gateway (`google/gemini-3-flash-preview`), wenn Regex kein Datum findet.
- Regel: erste Rate = **1. Tag des Folgemonats** nach Lieferdatum; Ratenplan wird nur in den Fälligkeiten verschoben (Anzahl, Betrag, Laufzeit, Zinsen unverändert).
- Blockiert bei `last_sent_date` (bereits fakturiert), fehlendem Ratenbeginn, mehreren abweichenden Lieferterminen → Prüfliste „NACHARBEIT“.
- Tabellen: `ratenplan_sync_runs`, `ratenplan_sync_items`, `ratenplan_sync_backups` (Rollback via Backup-/Run-ID), `ratenplan_document_links` (dauerhafte Zuordnung, bei Folgeläufen bevorzugt), `ratenplan_ai_corrections` (KI-Lernen aus Nutzerkorrekturen).
- Audit über `finance_audit_trail` (module = `ratenplan_sync`). Exporte: PDF (A4 quer), CSV, JSON.

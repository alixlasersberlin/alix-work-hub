---
name: GoBD Phase 16 – Organisatorischer Abschluss
description: Verantwortlichkeiten, unveränderbare Freigaben und versionierte GoBD-Abschlussberichte unter /finance/gobd/abschluss
type: feature
---

- Seite: `/finance/gobd/abschluss` (Finanz-Rollen), Menü unter BUCHHALTUNG.
- Tabellen: `gobd_responsibilities` (Bereich/Aufgabe/Person/Vertretung/Bestätigung),
  `gobd_approvals` (WORM, 7 Gegenstände inkl. `gesamtfreigabe`),
  `gobd_final_reports` (WORM, Version + SHA-256-Prüfsumme).
- RPCs: `gobd_set_responsibility` (Admin/Super Admin), `gobd_record_approval` (nur Super Admin),
  `gobd_org_status()`, `gobd_generate_final_report()` (kombiniert `gobd_compliance_check()` + Org-Status).
- Freigabestatus: NICHT FREIGEGEBEN / TECHNISCH BESTANDEN - ORGANISATORISCHER ABSCHLUSS LAEUFT /
  ABSCHLUSSFREIGABE AUSSTEHEND / FREIGEGEBEN MIT AUFLAGEN / FREIGEGEBEN.
- Phase 15B gilt als abgeschlossen und revisionsfest; Nachweise werden nie überschrieben,
  Änderungen erzeugen einen neuen Prüflauf bzw. eine neue Berichtsversion.

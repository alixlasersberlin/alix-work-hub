---
name: GoBD Phase 13 – Verfahrensdokumentation & Berechtigungskonzept
description: Versionierte Verfahrensdokumentation, Rollenmatrix, Vier-Augen-Bewertung, Änderungsprotokoll unter /finance/gobd/verfahrensdokumentation
type: feature
---

- Tabellen: `gobd_procedure_docs` (WORM, neue Version überschreibt alte nie), `gobd_permission_matrix` (Rolle × Bereich × Lesen/Anlegen/Ändern/Löschen/Export/Freigeben), `gobd_change_log` (WORM), `gobd_four_eyes_recommendations`. Löschen überall gesperrt.
- Prüffunktion `gobd_phase13_check()` (nur authenticated/service_role); Seite `/finance/gobd/verfahrensdokumentation` mit Tabs Doku / Rechte / Vier-Augen / Änderungen / Prüfbericht und Exporten (Markdown + CSV, protokolliert via `gobd_log_export`).
- Statusaussage systemweit: **„Technische GoBD-Prüfung bestanden – organisatorischer Abschluss läuft."** Der Status „GoBD-Gesamtprüfung bestanden" ist erst nach Phase 17 zulässig; nie „GoBD-zertifiziert" schreiben.
- Reihenfolge der offenen Blöcke: Phase 14 Aufbewahrung/Legal Hold → 15 Wiederherstellungstest → 16 Betriebsprüfungsexport → 17 Gesamtnachweis.
- Vier-Augen-Prinzip ist nur bewertet/empfohlen, produktive Abläufe wurden bewusst nicht verändert.

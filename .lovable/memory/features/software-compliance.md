---
name: ALIX Software Compliance (IEC 62304)
description: Software Documentation & Traceability Center unter /produktion/software mit Requirements, Units, Risks, Tests, Bugs, Releases, Team, Hardware-Doku und Traceability Matrix
type: feature
---
Tabellen: `plm_sw_units`, `plm_sw_requirements`, `plm_sw_risks` (Link zu `plm_risks` = ISO 14971), `plm_sw_tests` (kind = verification | integration | system), `plm_sw_bugs`, `plm_sw_releases`, `plm_sw_team`, `plm_hw_docs` (IEC 60601-1, u. a. Isolationsdiagramm), `plm_sw_surveys`.
RLS wie übriges PLM: lesen alle, schreiben `plm_can_write()`, löschen nur Super Admin.

Regel: Testergebnisse dürfen nie automatisch erzeugt werden — `executed_confirmed` muss gesetzt sein, bevor Actual Result / Tester / PASS gilt (auch in Auswertungen).

Frontend: `src/lib/plm/software.ts` (Feldkonfiguration), Seiten `src/pages/PLM/SoftwareCompliance.tsx` (Ampel-Dashboard + Markdown-Dokumentgenerierung), `SoftwareTraceability.tsx` (Matrix + CSV), `SwUnits/SwRequirements/SwRisks/SwVerification/SwIntegration/SwSystemTests/SwBugs/SwReleases/SwTeam/SwSurveys/HwDokumentation`.
Routen `/produktion/software/*` und `/produktion/hardware-dokumentation`; Sidebar-Gruppe „SOFTWARE COMPLIANCE“.

---
name: ALIX CREDIT SCORE®
description: KI-gestütztes Bonitäts- und Finanzierungs-Modul unter /bonitaet mit Score 0–1000, Ampel und Freigabe-Workflow
type: feature
---
Modul unter `/bonitaet` (VERKAUF → Bonität & Finanzierung).
Tabellen: `credit_assessments`, `credit_score_factors`, `credit_documents`, `credit_external_checks`, `credit_decision_log`, `credit_policies`.
Edge Functions: `credit-score-calculate` (deterministisch + optional Gemini), `credit-decision` (Freigabe/Ablehnung/Eskalation mit Rollencheck).
Score 0–1000 aus 8 Kategorien (SCHUFA 30%, Einkommen 20%, Beschäftigung 10%, Unternehmen 10%, Historie 15%, AlixSmart 5%, Zahlung 5%, Dokumente 5%). Score-Bänder in `credit_policies.default`: 900+ auto, 750+ Vertrieb, 650+ Vertriebsleitung, 550+ Geschäftsführung, <550 auto-Ablehnung.
Rollen (Lesen/Schreiben): Super Admin, Admin, Geschäftsführung, Vertriebsleitung, Vertrieb, Finance. Löschen nur Super Admin. Policies nur Super Admin.
DSGVO: Pflicht-Einwilligung beim Anlegen, revisionssicherer `credit_decision_log`, menschliche Letztentscheidung.

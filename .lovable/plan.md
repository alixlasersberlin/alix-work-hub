
# ALIX CREDIT SCORE® – Umsetzungsplan

Neues Modul unter **VERKAUF → Bonität & Finanzierung** (`/bonitaet`). DSGVO-konform, revisionssicher, mit KI-gestützter Score-Berechnung und Freigabe-Workflow.

## Umfang (Phasen)

### Phase 1 – Datenmodell & Basis (Fundament)
Neue Tabellen (alle mit RLS, GRANTs, Audit):
- `credit_assessments` – Bonitätsprüfung pro Kunde/Vorgang (score, ampel, empfehlung, status, workflow_stage, entscheider, entscheidung_am, gültig_bis)
- `credit_score_factors` – berechnete Einzelfaktoren pro Assessment (kategorie, punkte, gewicht, quelle, evidenz_ref)
- `credit_documents` – Dokumentenreferenzen (verweist auf `alixdocs2_documents`, Typ: schufa, lohnabrechnung, bwa, gewerbe, perso, hr_auszug, sonstiges)
- `credit_external_checks` – manuelle Einträge (Creditreform, Northdata, Bundesanzeiger, Handelsregister, USt-ID, LinkedIn, Google-Bewertung)
- `credit_decision_log` – Audit aller Freigaben/Ablehnungen/Eskalationen mit Begründung
- `credit_policies` – konfigurierbare Score-Schwellen und Gewichte (Super Admin editiert)

### Phase 2 – Score-Engine (Edge Function `credit-score-calculate`)
Deterministisch + KI. Berechnung 0–1000 aus 8 Kategorien mit den vorgegebenen Gewichten. Zieht automatisch:
- Kundenhistorie aus `orders`, `finance_transactions`, `finance_reminders`, `finance_sepa_runs` (Rücklastschriften), `finance_contracts`
- Offene Forderungen und Mahnstufe
- AlixSmart-Nutzung aus `alixsmart_customer_links`
- Dokumentenvollständigkeit aus `credit_documents`
- Externe Prüfungen aus `credit_external_checks`
Liefert: `score`, `ampel` (grün/gelb/rot), `ausfallwahrscheinlichkeit_pct`, `empfehlung` (Anzahlung %, Laufzeit, max. Kredit, empfohlene Geräteklasse), `flags[]`.

### Phase 3 – KI-Risikoanalyse (Edge Function `credit-score-ai`)
Lovable AI Gateway (`google/gemini-3.6-flash`, strukturierter Output). Bewertet weiche Faktoren:
- Adresswechsel, junges Unternehmen, Privatanschrift, Gmail statt Firmendomain, fehlende Webseite/Impressum, negative Bewertungen, GF-Wechsel, Insolvenz/Steuerhinweise (aus hochgeladenen PDFs).
- Nutzt OCR-Ergebnisse aus `alixdocs2_documents` (SCHUFA, BWA, Lohnabrechnung, HR-Auszug).
- Liefert Textbegründung + Zusatz-Punktabzüge, die in die Engine einfließen.

### Phase 4 – UI (`/bonitaet`)
- **Übersicht**: KPI-Cards (offene Prüfungen, Ampelverteilung, avg. Score, Eskalationen), Liste aller Assessments mit Filter/Suche.
- **Neue Prüfung**: Kundenauswahl (bestehend/neu), Datenerfassung Firmen-/Privatkunde, Dokumenten-Upload (via `alixdocs2` → `credit` Kategorie), externe Checks eingeben.
- **Detailansicht**: Ampel-Karte, Score-Breakdown pro Kategorie mit Balken, KI-Analysetext, Empfehlungs-Panel (Anzahlung/Laufzeit/max. Kredit), Dokumentenliste mit Preview, Entscheidungshistorie.
- **Freigabe-Aktionen**: „Freigeben" / „Mit Auflagen freigeben" / „Ablehnen" / „Zur Eskalation" – abhängig von Rolle und Score-Band.

### Phase 5 – Automatische Sperren & Order-Integration
- Trigger/Check in `orders` und `production_orders`: vor Auslieferung wird geprüft, ob ein gültiges (nicht abgelaufenes) grünes Assessment existiert. Wenn nicht → Banner + Sperre für Auslieferung.
- Automatische Sperren, wenn: offene Forderungen > Schwelle, Rücklastschriften vorhanden, Pflichtdokumente fehlen, Score < 550, Wunschfinanzierung > interne Risikogrenze.
- „Bonität prüfen"-Button in Auftrags-, Angebots- und Finanzierungs-Detailseiten.

### Phase 6 – Genehmigungsworkflow
- 900–1000: auto-freigegeben.
- 750–899: Verkäufer (Rolle `Vertrieb`) darf freigeben.
- 650–749: Verkaufsleiter (`Vertriebsleitung`).
- 550–649: Geschäftsführung (`Geschäftsführung` / `Super Admin`).
- <550: auto-abgelehnt.
- Eskalations-Benachrichtigung per E-Mail (`send-transactional-email`) und `app_notifications` an nächste Freigabestufe. Vier-Augen-Log in `credit_decision_log`.

### Phase 7 – Compliance & DSGVO
- Zweckbindung + Einwilligung: Pflicht-Checkbox „Einwilligung Bonitätsprüfung eingeholt" beim Anlegen.
- Vollprotokollierung aller Lese-/Schreibzugriffe in `audit_logs`.
- Verschlüsselte Speicherung: Dokumente in `alixdocs2` Storage-Bucket (bereits privat).
- Löschfristen: konfigurierbar in `credit_policies` (Default 3 Jahre nach Ablauf/Ablehnung), Cron `credit-retention-purge` täglich.
- Menschliche Letztentscheidung: kein 🟢-Ergebnis führt ohne Klick eines berechtigten Users zur Auslieferungsfreigabe (Art. 22 DSGVO).

### Phase 8 – Rollen & Rechte
- Sichtbar für: `Super Admin`, `Admin`, `Geschäftsführung`, `Vertriebsleitung`, `Vertrieb`, `Finance`.
- Löschen ausschließlich `Super Admin` (Core-Regel).
- Score-Policy-Editor nur `Super Admin`.

## Technische Details

- Edge Functions: `credit-score-calculate`, `credit-score-ai`, `credit-decision`, `credit-retention-purge` (Cron 04:15 UTC).
- Client-Hooks: `useCreditAssessment`, `useCreditPolicies`, `useCreditDocuments`.
- Wiederverwendung von `alixdocs2` für Upload/OCR/Preview – keine parallele Datei-Infrastruktur.
- Menü: Eintrag „Bonität & Finanzierung" unter **VERKAUF**; Sub-Item „Score-Policies" unter **OPERATIONS/System** (nur Super Admin).
- Alle neuen Public-Tabellen mit `GRANT ... TO authenticated` + `service_role`, RLS mit `has_role`-Checks, `updated_at`-Trigger.

## Nicht enthalten (bewusst)
- Automatisierte SCHUFA-API-Anbindung (kein Vertrag vorhanden) → PDF-Upload + OCR-Extraktion.
- Automatischer Creditreform/Northdata-API-Call → manuelle Eingabe mit Feldstruktur, spätere API-Anbindung möglich.
- Änderungen an bestehenden Zoho-Import-Flows.

## Umsetzungsreihenfolge
Ich baue Phase 1–4 in einem Durchgang (Fundament + funktionierende UI mit Score-Engine + KI), danach Phase 5–8. Zwischenstände bleiben lauffähig.

Bestätige den Plan, dann starte ich mit Phase 1 (Migration).

# ALIX COLLECT 2.0 — Enterprise Credit & Collection Management

Ausbau des bestehenden Mahnwesens (`/finance/collect`) zu einem aktiven Steuerungsinstrument für Liquidität und Risiko. Umsetzung in 6 Phasen, jede Phase ist für sich nutzbar.

## Phase 1 — Command Center & Management-Dashboard
- Neuer Startbildschirm statt Tabelle: Liquidität heute (Kontostände je Mandant), erwartete Zahlungseingänge heute / morgen / Woche / Monat, offene und kritische Forderungen, Ausfallrisiko in EUR.
- KI-Prognose-Kachel ("Heute werden voraussichtlich X EUR eingehen").
- Command-Center-Leitstand: Live-Zahlungseingänge, heute fällige Rechnungen, anstehende Telefonate, offene Zahlungsversprechen, Rücklastschriften, Sperren, Inkasso-/Gerichtsfälle, KI-Empfehlungen, Cashflow-Prognose 7/30/90 Tage.
- Geschäftsführer-Dashboard als eigene, verdichtete Ansicht.

## Phase 2 — Prioritätenliste & Aufgaben
- Fallliste sortiert nach Zahlungswahrscheinlichkeit (KI), nicht nach Datum; Sterne-Rating, Prozentwert, empfohlene Maßnahme (kein Anruf / Mail / Telefon / Anwalt).
- KI-generierte Tagesaufgaben (anrufen, mahnen, Rücklastschrift prüfen, Limit sperren, Anwalt informieren) mit Erledigen/Verschieben.
- Wiedervorlagen: nach jedem Kontakt Termin morgen / 3 / 7 / 30 Tage, erscheint automatisch in der Aufgabenliste.

## Phase 3 — Kundenseite, Timeline & Forderungsakte
- 360°-Kundenkopf: Stammdaten, Ansprechpartner, Steuernummer/UID, Bonitätsklasse, Risiko.
- Finanzblock: offene und überfällige Rechnungen, Gesamtumsatz, durchschnittliche Zahlungsdauer, Saldo, Rücklastschriften, Leasing, Kreditlimit, Kautionen, Skontohistorie.
- Durchgehende Timeline aller Vorgänge (Erstkontakt bis heute) aus vorhandenen Modulen.
- Forderungsakte je Rechnung: Angebot, Auftrag, Rechnung, Lieferschein, Übergabe, Tracking, Seriennummer, Fotos, Serviceberichte, Mails/Telefonate/SMS, Verträge, SEPA, Ratenvereinbarung, Rechtsakte.

## Phase 4 — Telefonmodus, Zahlungsversprechen, Ratenzahlung
- Telefonmodus-Dialog: Nummer, alle offenen Posten, letzte Gespräche, Gesprächsleitfaden, Notizfeld, Schnell-Buttons (bezahlt / versprochen / nicht erreichbar / Rückruf / falsche Nummer).
- Zahlungsversprechen mit Betrag, Datum, Notiz; bei Nichteinhaltung automatische Eskalation über die Engine.
- Ratenzahlungs-Wizard: Anzahlung, Rate, Laufzeit, SEPA-Mandat, Vertrags-PDF, digitale Unterschrift via ALIX SIGN PRO; Verzugsüberwachung startet den Mahnprozess neu.

## Phase 5 — Risikosteuerung: Kreditlimit, Sperren, Bonität
- Kreditlimit je Kunde (5k / 20k / 100k / unbegrenzt) mit Überschreitungs-Benachrichtigung an den Vertrieb.
- Verkaufsschutz: Ampel im Auftrag (grün / gelb mit Betrag / rot gesperrt); bei Rot kein Speichern des Auftrags.
- Lieferstopp für Logistik und Service-Sperre für die Werkstatt mit Freigabe durch Finance.
- Bonitätsmodul: Datenmodell und Prüf-Workflow für Neukunde, Großauftrag, Leasing, Ratenzahlung; Anbindung SCHUFA/Creditreform/CRIF/Creditsafe vorbereitet (Zugangsdaten erforderlich).

## Phase 6 — Eskalation, BI, Multi-Mandant, Finance AI
- Inkasso- und Anwaltsübergabe per Klick: automatische Zusammenstellung aller Unterlagen als Akten-PDF/ZIP.
- Insolvenzstatus mit Verwalter, Quote, Anmeldedatum, Aktenzeichen, Fristen.
- Business Intelligence: Forderungen nach Land/Verkäufer/Mandant, Zahlungsmoral, Altersstruktur, Ausfallquote, Rücklastschriftquote, Erfolgsquote je Mahnstufe, Mahnkosten vs. Eingänge, Top-20-Kunden.
- Multi-Mandant: kundenübergreifende Sicht über alle Gesellschaften, mandantenspezifische Vorlagen und Verzugszinsen, Intercompany-Hinweise, Konzern-Dashboard.
- Finance-AI-Copilot: Fragen in natürlicher Sprache, Entwürfe für Mails, Mahnungen, Gesprächsnotizen und Ratenvereinbarungen.

## Technische Umsetzung
- Neue Tabellen: `collect_tasks`, `collect_calls`, `collect_promises`, `collect_payment_plans` (+ `_items`), `collect_credit_limits`, `collect_blocks_ext`, `collect_credit_checks`, `collect_insolvencies`, `collect_legal_cases`, `collect_dossiers` — jeweils mit GRANTs und RLS (Super Admin / Admin / Finance-Rollen; Vertrieb nur Lesezugriff auf Ampel).
- Erweiterung `collect_cases` um `pay_probability`, `priority_score`, `next_action`, `next_followup_at`.
- RPCs für Dashboard-Aggregate (Liquidität, Cashflow-Prognose, Aging, BI-Kennzahlen), damit die Seiten mit einem Request laden.
- Edge Functions: Erweiterung von `collect-engine` (Promise-Bruch, Wiedervorlagen, Aufgaben-Generierung), `collect-ai-score` (Zahlungswahrscheinlichkeit), neu `collect-copilot` (Finance AI über Lovable AI Gateway, Gemini 2.5 Flash), `collect-dossier` (Aktenexport).
- Frontend: neue Seiten unter `src/pages/Finance/Collect*`, Routing unter `/finance/collect/...`, Menüeintrag unter Buchhaltung → Mahnungen.

## Voraussetzungen
- Bonitäts-APIs (SCHUFA, Creditreform, CRIF, Creditsafe) benötigen Verträge und API-Zugangsdaten; bis dahin manuelle Bonitätsklasse.
- Live-Kontostände setzen die bestehenden Bankimporte voraus; ohne tagesaktuelle Umsätze ist die Liquiditätsanzeige nur so aktuell wie der letzte Import.

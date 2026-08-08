# ALIX COLLECT — Intelligentes Forderungsmanagement

Ersetzt das bisherige einfache Mahnwesen (Mahnung 1/2/3) durch ein gestuftes, KI-gestütztes Credit- und Collection-Modul unter `/collect`. Das alte `/finance/mahnwesen` bleibt zunächst als Legacy-Ansicht bestehen und wird nach Abnahme entfernt.

Umsetzung in 6 Phasen, damit jede Stufe testbar ist.

## Phase 1 — Datenbasis & Dashboard

Neue Tabellen (Buchhaltung/Super Admin, RLS wie Finance):
- `collect_cases` — ein Fall je Kunde: offener Betrag, Ampelfarbe, Mahnstufe, Risiko-Score, Sperren, nächste Aktion
- `collect_case_items` — verknüpfte Rechnungen inkl. Verzugstage, Verzugszinsen, Mahnkosten
- `collect_events` — chronologische Historie (Mail, PDF, SMS, WhatsApp, Telefon, Brief, Notiz, Statuswechsel)
- `collect_stage_config` — konfigurierbare Stufen (Tag, Kanal, Vorlage, Kosten, Zinsen, Eskalation)
- `collect_payment_plans` — Ratenvereinbarungen (Anzahlung, Rate, Start, Laufzeit, SEPA, Unterschrift)
- `collect_blocks` — aktive Sperren (Lieferung, Ersatzteile, Schulung, Garantie, Verlängerung)

Dashboard `/collect`:
- KPI-Zeile: Cashflow heute, offene Forderungen, Eingänge heute, DSO, Ø Zahlungsdauer, Zahlungsquote, Rücklastschriftquote, Inkassoquote
- Altersklassen-Kacheln: heute fällig, 1–7, 8–14, 15–30, 31–60, >60 Tage, Inkasso, Anwalt, Insolvenz
- Top-20-Schuldner, erwarteter Zahlungseingang 7/30/90 Tage, Erfolgsquote je Mahnstufe

## Phase 2 — Mahnstufen-Engine

Stufenmodell (konfigurierbar, Standardwerte):

```text
-7 Tage  Vorfälligkeitsinfo      Mail
 0 Tage  Fälligkeit              Mail + PDF + Pay-Now-Link
+3 Tage  Freundliche Erinnerung  Mail
+7 Tage  Mahnstufe 1             Mail + PDF
+14 Tage Mahnstufe 2             + Verzugszinsen + Mahnkosten
+21 Tage Telefonaufgabe          Telefonliste + KI-Gesprächsleitfaden
+30 Tage Mahnstufe 3             GF in CC
+45 Tage Lieferstopp             Sperren setzen, Vertrieb informieren
+60 Tage Entscheidung            Inkasso / Anwalt / Kulanz (KI-Vorschlag)
```

Ampel je Kunde: grün (bezahlt / Lastschrift angekündigt), gelb (bald fällig), orange (Stufe 1), rot (Stufe 2/3), schwarz (Anwalt/Insolvenz).

Cron `collect-daily-run` täglich 07:00 (Berlin): Rechnungen prüfen, Stufen erhöhen, Zinsen und Kosten berechnen, Nachrichten versenden, Telefonaufgaben erzeugen, Kundenstatus und Sperren aktualisieren, Priorisierung neu berechnen.

## Phase 3 — Fallakte & Kommunikation

Detailseite `/collect/:caseId`:
- Kopf mit Ampel, Score, offenem Betrag, nächster Aktion
- Chronologische Historie aller Kontakte inkl. Anhänge
- Aktionsleiste: Mail, PDF, SMS, WhatsApp, Telefonnotiz, Aufgabe, Stufe manuell setzen, Kulanz
- Dokumentenspalte je Rechnung: Angebot, Auftrag, Rechnung, Lieferschein, Übergabe, Tracking, SEPA, Mahnungen, Telefonprotokolle
- Button „Ratenzahlung vereinbaren“ mit Plan-Erstellung, SEPA und Signatur über ALIX SIGN PRO; automatische Überwachung der Ratenzahlungen

## Phase 4 — KI-Risikobewertung

Edge Function `collect-risk-score` (Lovable AI Gateway, deterministische Vorberechnung + KI-Begründung). Eingangsgrößen: Bonität aus ALIX CREDIT SCORE, Zahlungshistorie, Anzahlungen, Leasing-/Finanzierungsstatus, Rücklastschriften, offene Tickets, Reklamationen, Rechtsfälle, Zahlungsverhalten.

Ausgabe: Zahlungswahrscheinlichkeit in Prozent, Risikoklasse (Topkunde / normal / kritisch / Hochrisiko) und Handlungsempfehlung („nicht mahnen“, „sofort telefonieren“, „direkt Inkasso“, „Stufe überspringen“), sichtbar als Empfehlungskarte oben rechts in der Fallakte.

## Phase 5 — Rücklastschriften & Leasing

- Rücklastschrift-Ansicht: Grund, Gebühren, Bankgebühren, erneuter/zweiter Einzug, Übergabe an Inkasso, Bonitätsabwertung. Anbindung an vorhandene `bank_return_debits`.
- Leasing-/Finanzierungsstatus je Fall: Unterlagen fehlen, Bank wartet, Unterschrift fehlt, genehmigt, abgelehnt.

## Phase 6 — Präventives Credit Management

- Sperr-Hook in Angebot, Auftrag, Lieferung, Ersatzteile, Schulung, Garantie: Prüfung von offenen Forderungen, Rücklastschriften, Reklamationen, Leasingstatus und Bonität vor Freigabe.
- Verkäufer-Banner im Kunden- und Auftragskontext: „Dieser Kunde hat X € offen“ — neue Angebote gelb, neue Aufträge und Lieferungen gesperrt.
- Freigabe von Sperren nur durch Finance / Super Admin, revisionssicher protokolliert.

## Technische Hinweise

- Neue Tabellen mit expliziten GRANTs, RLS über bestehende Finance-Rollenfunktionen; Löschen nur Super Admin.
- Edge Functions: `collect-daily-run` (Cron), `collect-risk-score`, `collect-send` (Mail/SMS/WhatsApp/PDF, BCC-Regeln wie bisher).
- Wiederverwendung: `send-transactional-email`, Twilio-SMS-Function, jsPDF-Vorlagen aus `src/lib/finance/`, ALIX SIGN PRO für Ratenvereinbarungen, ALIX CREDIT SCORE für Bonität.
- Navigation: neuer Punkt „ALIX COLLECT“ unter BUCHHALTUNG, direkt nach „Rechnungen“; Workspace „Buchhaltung“ analog erweitert.
- Design: bestehendes Dark/Gold-Enterprise-Theme, semantische Tokens.

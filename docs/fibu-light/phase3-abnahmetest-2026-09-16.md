# FIBU LIGHT – PHASE 3 ENDABNAHME (Bank & Zuordnung)

Datum: 16.09.2026
Stand: Entwicklungsstand eingefroren
STATUS: TESTBETRIEB
PRODUKTIONSFREIGABE: NEIN

Alle Tests wurden serverseitig in Transaktionen ausgeführt, die nach der Prüfung
vollständig zurückgenommen wurden (Rollback). Es wurden keine historischen Daten
verändert und keine Testbuchungen hinterlassen.

## Ergebnis der 20 Testfälle

| # | Testfall | Erwartung | Ergebnis | Status |
|---|----------|-----------|----------|--------|
| 1 | Exakte Rechnungsnummer + exakter Betrag | richtige Rechnung vorgeschlagen | Score 99, korrekte Rechnung 2026-08-0096 | BESTANDEN |
| 2 | Kunde + exakter Betrag, keine Nummer | plausibler Vorschlag, keine Autobuchung | Score 45, richtiger Kunde, keine automatische Buchung | BESTANDEN |
| 3 | Teilzahlung | Restbetrag bleibt offen, Status Teilzahlung | 187,50 € gebucht, 187,50 € offen, `partially_paid` | BESTANDEN |
| 4 | Vollzahlung | OP nach Bestätigung geschlossen | Saldo 0,00 €, Status `paid` | BESTANDEN |
| 5 | Sammelzahlung | Aufteilung vorgeschlagen, Bestätigung nötig | Vorschlag erzeugt, 562,50 € auf 2 Rechnungen, beide ausgeglichen | BESTANDEN (nach Fehlerbehebung, s. u.) |
| 6 | Überzahlung | Rechnung + Guthaben, keine Verrechnung | Rest 10,00 € als ungeklärtes Guthaben erfasst | BESTANDEN |
| 7 | Unterzahlung | Restbetrag bleibt offen | 10,00 € bleiben offen, keine Abschreibung | BESTANDEN |
| 8 | Unbekannter Zahler | Status UNKLARE ZAHLUNG | Score 8, als unklar markiert und in Filter „unklar“ sichtbar | BESTANDEN |
| 9 | Falsche Rechnungsnummer | keine falsche endgültige Zuordnung | 0 sichere Treffer (≥70) | BESTANDEN |
| 10 | Bereits bezahlte Rechnung | Warnung, keine OP-Zuordnung | Rechnung nicht mehr vorgeschlagen; Buchung serverseitig abgewiesen | BESTANDEN |
| 11 | Doppelte Zuordnung | zweiter Versuch abgewiesen | „BUCHUNG ABGEWIESEN: Banktransaktion bereits zugeordnet“, 1 Zuordnung | BESTANDEN |
| 12 | Doppelklick | genau eine Buchung | zweiter unmittelbarer Aufruf abgewiesen, 1 Zuordnung | BESTANDEN |
| 13 | Zwei Benutzer gleichzeitig | zweiter Vorgang abgewiesen | Benutzer B (FIBU LIGHT) abgewiesen; Zeilensperre `FOR UPDATE` aktiv | BESTANDEN (Einschränkung s. u.) |
| 14 | Zuordnungsfehler melden | FIBU LIGHT kann nicht löschen/überschreiben | Korrekturvorgang erzeugt; Zuordnung bleibt bestehen; Löschen/Ändern liefert 0 Zeilen | BESTANDEN |
| 15 | Mahnsperre | Zahlung möglich, Sperre nachvollziehbar | Zahlung gebucht, Sperre weiterhin aktiv und dokumentiert | BESTANDEN |
| 16 | Mahnwesen nach Zahlung | Vollzahlung entfällt, Teilzahlung mit Restbetrag | vollbezahlte Rechnung nicht mehr in Liste; Teilzahlung mit neuem Saldo; gesendete Mahnung unverändert | BESTANDEN |
| 17 | Rolle FIBU LIGHT | lesen/bestätigen JA, alles Übrige NEIN | lesen JA, bestätigen JA; Bankumsatz ändern/löschen, Zahlung ändern/löschen, Abschreiben, Audit ändern/löschen jeweils 0 Zeilen | BESTANDEN |
| 18 | Direkter Serverzugriff | unautorisierte Aktionen abgewiesen | Tests direkt auf Datenbankebene mit FIBU-LIGHT-Identität (`role authenticated`): alle verbotenen Aktionen wirkungslos | BESTANDEN |
| 19 | Audit-Protokoll | 12 Pflichtangaben | Benutzer, Zeit, Transaktions-ID, Bankbetrag, Rechnung, Kunde, OP vorher, Zahlbetrag, OP nachher, Matching-Kriterien, Quelle/Bestätigung, Ergebnis vollständig | BESTANDEN |
| 20 | Historische Daten | keine unbeabsichtigten Änderungen | 7.751 Rechnungen unverändert, Nummern unverändert, keine Altumsätze automatisch verbucht | BESTANDEN |

Ergebnis: **20/20 BESTANDEN**

## Gefundener und behobener Fehler

Test 5 (Sammelzahlung) schlug zunächst fehl: Jede Teilbuchung erhielt dieselbe
Zahlungsreferenz, wodurch der eindeutige Index `uq_finance_tx_reference` die zweite
Buchung blockierte. Die Zahlungsreferenz wird jetzt je Rechnung eindeutig gebildet
(Bankreferenz / Rechnungsnummer / Transaktionskürzel) und im Protokoll vermerkt.
Zusätzlich wurde beim Abschluss der Zuordnung das Pflichtfeld „Matching-Score“ korrekt
gefüllt und die erkannte Kundenzuordnung nicht mehr überschrieben.

## Datenintegrität

- Summe Bankzuordnungen: 618,06 €
- Summe protokollierter Zahlungsbuchungen: 618,06 €
- Differenz: **0,00 €**
- Keine Zahlung fließt doppelt in den OP-Saldo (Doppelbuchungssperre serverseitig).

Kontrolle nach allen Tests: 0 Protokolleinträge, 0 Guthaben, 0 Klärungsfälle,
0 Testzuordnungen, 0 Testbankumsätze; 7.751 Rechnungen, 2.068 Zahlungen unverändert;
FIBU-LIGHT-Rolle des Testkontos wieder entzogen.

## Einschränkungen

1. **Test 13** wurde mit zwei Benutzeridentitäten gegen dieselbe Transaktion geprüft;
   ein echter Parallelbetrieb mit zwei gleichzeitig angemeldeten Browser-Sitzungen ist in
   dieser Umgebung nicht durchführbar. Die Absicherung erfolgt serverseitig über
   Zeilensperre (`FOR UPDATE`) und erneute Prüfung bestehender Zuordnungen.
2. **Bildschirmnachweise: UNVOLLSTÄNDIG.** Automatisierte Anmeldung ist nicht möglich
   (externes Anmeldesystem), daher liegen keine der 13 geforderten Bildschirmnachweise vor.

## Abschlussbericht

FIBU LIGHT PHASE 3

- Tests: **20/20 BESTANDEN**
- Datenintegrität: **BESTANDEN** (0,00 € Abweichung)
- Rollen-/Sicherheitstest: **BESTANDEN**
- Doppelbuchungsschutz: **BESTANDEN**
- Bildschirmnachweise: **UNVOLLSTÄNDIG**
- Offene Fehler: **0** (1 gefundener Fehler behoben und nachgetestet)

PHASE 3 – PRODUKTIONSFREIGABE: **NEIN** (bis zur ausdrücklichen Freigabe)

## Geltungsbereich (Abgrenzung)

Dieser Bericht gilt **ausschließlich** für **FIBU LIGHT Phase 3 – Bank & Zuordnung**.

Nicht Bestandteil dieses Berichts und nicht durch diese Abnahme freigegeben:

- **Anwalt / internes Inkasso** (Markierung und Massenübergabe in „Offene Posten Light“,
  `op_light_escalations`, `fibu_light_set_escalation`, `fibu_light_clear_escalation`).
  Separate Erweiterung, nicht Bestandteil der 20 Phase-3-Testfälle, benötigt einen
  eigenen Test- und Freigabestatus (siehe `docs/fibu-light/anwalt-inkasso-status.md`).

Eine spätere Produktionsfreigabe auf Basis dieses Berichts umfasst ausdrücklich nur
„FIBU LIGHT Phase 3 – Bank & Zuordnung“.

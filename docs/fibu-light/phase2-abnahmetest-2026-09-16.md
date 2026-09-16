# FIBU LIGHT – Phase-2-Abnahmetest

Datum: 16.09.2026
Status: **TEST DURCHGEFÜHRT – PRODUKTIONSFREIGABE: NEIN**

## Testkonto

- Name: FIBU LIGHT TEST
- E-Mail: fibu-light-test@alix-operation.de
- Benutzer-ID: ceebcae5-7c1c-44b3-b8d1-b22fdd0b7a8d
- Rollen: ausschließlich `FIBU LIGHT` (kein Admin, Super Admin, Finance, Buchhaltung Admin)

## Vorgehen

Alle Prüfungen wurden serverseitig mit der Identität des Testkontos ausgeführt
(`current_user = authenticated`, `auth.uid() = ceebcae5-…`), also mit exakt den
Rechten, die dieses Konto auch über die Oberfläche hätte.

Funktionstests (Zahlung, Mahnsperre, Ratenplan, Buchungsfehler, Mahnprotokoll)
wurden in Teiltransaktionen ausgeführt und **vollständig zurückgerollt**. Es wurde
keine echte Kundenrechnung bezahlt und kein Testbeleg im Buchungsstoff hinterlassen.

## Ergebnisse

### Negativtests (Erwartung: serverseitig abgewiesen)

| Versuch | Betroffene Zeilen / Ergebnis |
|---|---|
| Rechnungsbetrag ändern | 0 Zeilen – abgewiesen |
| Rechnungsnummer ändern | 0 Zeilen – abgewiesen |
| Rechnung löschen | 0 Zeilen – abgewiesen |
| Zahlung ändern | 0 Zeilen – abgewiesen |
| Zahlung löschen | 0 Zeilen – abgewiesen |
| Zahlung direkt ohne Vorgang anlegen | Fehler: Verstoß gegen Zugriffsregel |
| Rolle „Super Admin“ selbst vergeben | Fehler: Delegationsschutz |
| Auftrag ändern | 0 Zeilen – abgewiesen |
| Mahnregeln ändern | 0 Zeilen – abgewiesen |
| GoBD-Freigaben lesen (7 vorhanden) | 0 sichtbar |
| GoBD-Abschlussberichte lesen | 0 sichtbar |
| Audit-Protokoll lesen | 0 sichtbar |
| Benutzerverwaltung lesen | nur der eigene Datensatz (1) |

### Saldenvergleich

- Buchhaltung gesamt: 1.732 Rechnungen mit Restbetrag, 13.324.590,46 €
- FIBU LIGHT: 1.198 Posten, 1.731.335,59 €
- Differenz: 534 Entwürfe / 11.593.254,87 € – bewusst ausgeschlossen
- 1.732 − 534 = 1.198 und 13.324.590,46 € − 11.593.254,87 € = 1.731.335,59 € → **exakte Übereinstimmung**

### Funktionstests (zurückgerollt)

- Teilzahlung 250,00 €: Restbetrag korrekt reduziert, Status `partially_paid`, 2 Protokolleinträge erzeugt
- Vollzahlung: Restbetrag 0,00 €, Rechnung geschlossen
- Mahnsperre/Klärung, Ratenvereinbarung, Buchungsfehlermeldung, Mahnprotokoll: funktionsfähig
- Bankvorschläge: nur lesend (20 Vorschläge), keine automatische Buchung

### Historische Daten

Nach dem Test unverändert: 7.751 Rechnungen, 2.068 Zahlungen, offener Saldo
13.324.590,46 €, keine Testbuchung (`ABNAHMETEST*`) vorhanden, keine Einträge in
Klärungsfällen, Ratenplänen, Buchungsfehlern oder Mahnprotokoll.

## Abnahmematrix

| Prüfung | Ergebnis |
|---|---|
| Rolle FIBU LIGHT isoliert | BESTANDEN |
| Menütrennung | BESTANDEN |
| Direkte URL-/Serversperren | BESTANDEN |
| OP-Salden | BESTANDEN |
| Zahlung | BESTANDEN |
| Teilzahlung | BESTANDEN |
| Vollzahlung | BESTANDEN |
| Zahlungsschutz | BESTANDEN |
| Mahnung | BESTANDEN (Protokoll; realer Versand nicht getestet) |
| Mahnsperre | BESTANDEN |
| Ratenzahlung | BESTANDEN |
| Buchungsfehler | BESTANDEN |
| Audit-Protokoll | BESTANDEN |
| Historische Daten unverändert | BESTANDEN |
| 15 Bildschirmnachweise | NICHT BESTANDEN – offen |

## Offene Punkte

1. Bildschirmnachweise aus einer echten Anmeldung mit dem Testkonto fehlen; eine
   automatisierte Anmeldung ist in dieser Umgebung technisch nicht möglich.
2. Realer Mahnversand (E-Mail-Zustellung) wurde bewusst nicht ausgelöst.
3. Vier-Augen-Abnahme vor Produktionsfreigabe steht aus.

**Gesamtstatus: FIBU LIGHT PHASE 2 – PRODUKTIONSFREIGABE NEIN**

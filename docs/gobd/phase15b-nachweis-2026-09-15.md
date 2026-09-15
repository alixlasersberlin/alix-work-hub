# Phase 15B – Vollsicherung & Wiederherstellungs-Nachtest (Abschlussnachweis)

Datum: 2026-09-15

## Grundlage
- Vollsicherung: `45c73608-7651-4ebf-8820-02d4b31afac3`
  (Manifest `2026-09-15/backup-2026-09-15T03-55-10-104Z-45c73608/manifest.json`, 1.570 Dateien)
- Wiederherstellung ausschliesslich in der abgeschotteten Testumgebung (`gobd_restore`),
  kein produktives Zurueckspielen, keine Aenderung an Rechnungen, Zahlungen, Buchungen,
  Nummernkreisen, Perioden oder Protokolldaten.

## Ergebnis des Nachtests
- Lauf: `bf8ac8cb-4a3c-4964-a876-68cc4995e416`
- Status: **BESTANDEN** (0 Fehler, 0 Warnungen)
- Wiederhergestellte Datensaetze: 80.217
- RPO: 18.247 s (Abstand Sicherungszeitpunkt), RTO: 1.230 s
- Prüfungen:
  - 26 Vollstaendigkeitspruefungen: BESTANDEN (u. a. 55.338 Protokolleintraege vollstaendig)
  - 20 Identitaetspruefungen: BESTANDEN
  - 20 Inhalts-/Hashpruefungen (md5 je Datensatz): BESTANDEN, 0 Abweichungen
  - 2 Audit-Trail-Pruefungen: BESTANDEN
  - 6 Schutztests nach Wiederherstellung: BESTANDEN
    (Aenderung/Loeschung ohne Bedingung blockiert, Legal Hold greift,
     finalisierte Rechnung weder aenderbar noch loeschbar,
     Aufhebung einer Aufbewahrungssperre nur mit Berechtigung)

## Technische Korrekturen im Rahmen des Nachtests
- Inhaltsvergleich auf Pakete zu max. 250 Datensaetzen mit Cursor (kein OFFSET),
  Zwischenstand nach jedem Paket, 350 ms Pause, Backoff, Health-Gate.
- Zaehlfehler behoben: Abweichungen wurden zuvor ueber alle Tabellen hinweg gezaehlt.
- Prüfsummenbildung korrigiert: Hash der wiederhergestellten Daten wird jetzt ueber
  exakt dieselbe Feldliste gebildet wie der Hash der Sicherung.

## Historie
Die frueheren Laeufe (u. a. `b065a4a0-...`, `749ac5d6-...`, `c46da2e1-...`) bleiben mit
ihren Warnungen und Fehlern unveraendert erhalten und werden nicht ueberschrieben.

## Status
Phase 15 / 15B: **BESTANDEN**.
Gesamtstatus GoBD weiterhin: „Technische GoBD-Pruefung bestanden – organisatorischer
Abschluss laeuft" (bis Phase 17).

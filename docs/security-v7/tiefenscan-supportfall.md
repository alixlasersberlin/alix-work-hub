# Supportfall: Tiefenscanner endet wiederholt unvollständig

## Beobachtung
- Scanner `agent_security_v2`, Version 1.94.
- Letzte Läufe enden mit `completion_status=incomplete`, ohne Fehlermeldung oder Diagnose.
- Läufe prüfen jeweils den zuletzt gespeicherten älteren Commit statt des aktuellen Standes: zuletzt `4beda073f1102ec43f6061faab3a83b25cc69449` (Lauf 28.11.2026 17:26 UTC, 338 Meldungen: 121 kritisch / 217 Warnungen), frühere Läufe `b64d586…`, `86707d200…`, `8a94fc3ad…`.
- `up_to_date=true` wurde trotz älterem Commit gemeldet; inzwischen `false`.
- Bereits korrigierte und als behoben gemeldete IDs tauchen bei Läufen auf älteren Commits erneut auf.
- Projekt: sehr groß (über 900 öffentliche Tabellen, über 880 Datenbankfunktionen, über 200 Edge Functions).

## Bereits ausgeschlossen
- Keine parallelen Scans gestartet; identische Wiederholungen eingestellt.
- Kein Berechtigungsfehler sichtbar; Ergebnisse werden geliefert, nur unvollständig.

## Vermutete Ursache (nicht bestätigt)
Ressourcen- oder Zeitlimit des Scanners bei dieser Projektgröße; Commit-Bindung an den Zeitpunkt des Scanstarts.

## Bitte an Lovable
1. Ursache für `incomplete` und betroffene Bereiche mitteilen.
2. Scan auf aktuellem Commit ermöglichen bzw. Limit für dieses Projekt erhöhen.
3. Liste der nicht geprüften Bereiche bereitstellen.

Projekt-ID: 13914134-4b95-4f3f-a064-71f725c7d887

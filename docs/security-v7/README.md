# ALIXWORK Security V7 – persistentes Ledger

Einziger Fortsetzungsmechanismus der Sicherheitsbereinigung. Keine neuen Master-Prompts, keine Gesamtanalysen wiederholen.

## Ablauf je Arbeitspaket
1. Im Security Control Center → „Bereinigung fortsetzen“ (oder `continuationPrompt`) das nächste Paket ablesen.
2. Analyse → sichere Korrektur → automatisierte Tests → Regression → kontrollierte Bereitstellung → Verifizierung.
3. Pro bearbeiteter ID eine Zeile in `progress.csv` (`id,status,package,fix,evidence,deployedVersion,lastChecked,nextStep,blocker`).
   Status: OPEN, IN_PROGRESS, FIXED, TESTED, DEPLOYED, VERIFIED, FALSE_POSITIVE, BLOCKED_EXTERNAL, BLOCKED_TECHNICAL.
   VERIFIED nur mit unabhängigem Nachweis (vollständiger Scan auf aktuellem Commit, Linter-Abwesenheit plus Regressionsprobe, oder angemeldeter Rollentest).
4. Bei neuem Linter/Scan: `linter-latest.txt` bzw. `scan-latest.json` ersetzen und `version.json` aktualisieren (Commit, Migration, Zeitpunkt, Tests).
5. `python3 scripts/security/build-ledger.py` ausführen; erzeugt `supabase/functions/security-remediate/ledger.json` und `ledger.csv`; danach `security-remediate` bereitstellen.

## Regeln
- Kategorien (native Scanner, ursprüngliches Register, Datenbank-Linter, Prüfungen) nie addieren; ursprüngliche IDs, die im Scan vorkommen, sind Duplikate.
- Scan auf älterem Commit oder `incomplete` ist nie Abschlussnachweis.
- Keine Sicherheitsfreigabe, solange kritische/hohe Positionen nicht VERIFIED oder FALSE_POSITIVE sind.
- Schutzvorgaben: siehe Prompt in der App; Geschäfts-/Produktdaten, Zeitpläne, Secrets, Product-Hub-Sperren und Notstopp bleiben unverändert.

## Dokumente
- `externe-aufgaben.md` – einzige Liste der Aufgaben für den Systeminhaber
- `rollen-testkonten.md` – Rollenmatrix und benötigte Testkonten
- `restore-test-anleitung.md` – isolierter Restore-Test
- `tiefenscan-supportfall.md` – Fehleranalyse und Supportfall Tiefenscanner
- `zoho-vorfallbericht.md` – Vorfall 28.11.2026

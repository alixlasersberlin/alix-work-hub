# Anleitung: isolierter Restore-Test „ALIXWORK RESTORE TEST“

Keine Wiederherstellung in die produktive Datenbank.

## Benötigt
- Neues, leeres Supabase-Projekt „ALIXWORK RESTORE TEST“ (gleiche Postgres-Hauptversion), nur für Super Admins zugänglich.
- Lesender Zugriff auf das Hetzner-Backupziel (vorhandene Secrets `HETZNER_S3_*` werden nur gelesen).
- Backup-Quelle: letzte Vollsicherung `2dad621c-2c25-4d21-9558-46c3fd84a249` (Manifest v5 mit SHA-256 je Teil).

## Ablauf
1. Schema aus den Migrationen im Testprojekt aufbauen; Schema-Hash (Tabellen, Spalten, Policies, Funktionen) mit Produktion vergleichen.
2. Backup-Teile herunterladen, SHA-256 gegen Manifest und `x-amz-meta-sha256` prüfen.
3. Daten einspielen; Zeilenzahlen je Tabelle mit Manifest vergleichen.
4. Integrität: Fremdschlüssel, eindeutige Nummernkreise, Rechnungssummen.
5. Rollen/Rechte: Policies und Ausführungsrechte mit Produktion vergleichen; Testkonto je Rolle anmelden.
6. Funktionstest: Anmeldung, Auftrag öffnen, Rechnung anzeigen, Dateien laden.
7. Danach: Extension-Umzug (`citext`, `vector`, `pg_trgm`) zuerst im Testprojekt erproben.

## Datenschutz
Bevorzugt anonymisierte Daten. Falls Produktionsdaten nötig: Zugriff nur Super Admin, verschlüsselte Speicherung, Löschung des Testprojekts spätestens 14 Tage nach Abschluss mit Protokoll.

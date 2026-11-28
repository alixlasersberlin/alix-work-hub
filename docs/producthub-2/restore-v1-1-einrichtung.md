# ALIXWORK RESTORE TEST – isolierte Wiederherstellung v1.1

## Aktueller Stand

Der Administrator hat am 28.11.2026 bestätigt: **Noch kein separates Restore-Testprojekt vorhanden.** Daher ist der endgültige Test **Nicht vollständig geprüft**. Der bisherige Arbeitsspeichervergleich bleibt Vorprüfung und wird niemals als endgültiger Freigabenachweis gespeichert.

## Sichere Zielumgebung

Bevorzugt für das beiliegende Werkzeug: eigene abgeschottete VM mit lokalem PostgreSQL, Datenbankname `alixwork_restore_test`, keine Verbindung zur Produktionsdatenbank. Firewall: keine ausgehenden Verbindungen zu Webseiten, E-Mail, WhatsApp, Shops oder Banken. Den lesenden Download der Sicherung erledigt der Administrator separat über den vorhandenen geschützten Sicherungsdownload; das Werkzeug bekommt ausschließlich lokale Dateien.

Falls stattdessen ein neues Supabase-Projekt gewünscht ist:

1. Supabase → Organisation → New project → **ALIXWORK RESTORE TEST**, eigenes Passwort, eigene Projektkennung, EU-Region. Dieses AlixWork-Projekt nicht umhängen.
2. Keine Produktionsdomains, SMTP, Einladungen, Webhooks, Cron-Jobs, Veröffentlichungsfunktionen oder produktive Integrations-Secrets. Kein E-Mail-/WhatsApp-Versand; externe Netzwerkaufrufe außerhalb der administrativen Sicherungsbeschaffung sperren.
3. Schema und Daten nur in das getrennte Ziel einspielen; alle app-eigenen Trigger vor dem Import deaktivieren und sämtliche Cron-/Netzwerkautomatisierungen entfernen bzw. im Ziel gar nicht installieren.
4. Für das beigefügte streng lokale Werkzeug zusätzlich eine lokale Testdatenbank aus diesem isolierten Ziel bereitstellen. Es lehnt Remote- und Produktionsverbindungen absichtlich ab. Ein eigener abgesicherter Remote-Adapter ist **nicht** Bestandteil dieses Auftrags und wird nicht simuliert.

## Benötigte Sicherungsunterlagen

- Originalmanifest mit Sicherungs-ID und Zeitpunkt.
- Alle im Manifest aufgeführten NDJSON-Teile, SHA-256 und Zeilenzahlen.
- Tatsächliche Dateien aus `product-hub-docs` / `ph-catalog-media`, nicht nur Speicherindex-Einträge. Private Medien ausschließlich über autorisierte Sicherungswege beschaffen.
- Schema-Snapshot **zum Sicherungszeitpunkt**, inklusive Tabellen, Typen, Spalten, Beziehungen, Indizes und der notwendigen Nicht-Product-Hub-Abhängigkeiten.
- Authentifizierte Zuordnung des Schema-Snapshots zum Sicherungsmanifest.

Das bisherige Manifest v5 enthält keinen `schema_sha256`-Nachweis und die Speicherindizes allein keine vollständigen Datei-Prüfsummen. Ein aktueller Schema-Dump darf nicht rückwirkend als historischer Sicherungsnachweis ausgegeben werden. Ohne diese Unterlagen kann ein Restore ausgeführt werden, aber **keine vollständige Abnahme** bestehen. Keine Veränderung des bestehenden Bundle-API-Vertrags erforderlich oder vorgenommen.

## Ausführung des tatsächlichen isolierten Imports

Datei `restore-isolated.py` verwendet nur den vorhandenen PostgreSQL-Client; es ist ein bewusst gestartetes Prüfwerkzeug, kein neuer App-Server und keine Automatisierung.

1. Administrator provisioniert die lokale leere Zielstruktur aus dem geprüften Schema. Benutzertrigger müssen deaktiviert sein, externe Datenbankserver und `pg_cron` / `pg_net` / `http` dürfen nicht vorhanden sein.
2. Sichere lokale Umgebung setzen: `RESTORE_DATABASE_URL` auf die lokale Datenbank und `RESTORE_ISOLATION_CONFIRMED=ALIXWORK RESTORE TEST`. Zugangsdaten ausschließlich in der geschützten Umgebung, nie im Chat oder Bericht.
3. Sicherungsdateien in der ursprünglichen Pfadstruktur bereitstellen; echte Medien unter `storage/<bucket>/<path>`.
4. Aufruf:

```text
python3 restore-isolated.py --root /srv/restore-input --manifest /srv/restore-input/manifest.json --read-api-url http://127.0.0.1:9090/bundle?channel=de&include_offline=1 --report /srv/restore-result.json
```

5. Die optionale lokale lesende API muss separat im isolierten Ziel eingerichtet sein, ausschließlich den wiederhergestellten Datenbestand lesen und keine Versand-/Publish-Funktionen besitzen. Ohne sie fällt der entsprechende Prüfpunkt durch. Alle Weiterleitungen werden abgelehnt.

Das Werkzeug prüft den leeren lokalen Zielnamen und Isolation, validiert Manifest-Teile vor dem Schreiben und importiert die enthaltenen Tabellen tatsächlich in einer Transaktion. Es überschreibt oder löscht keine Zielzeilen. Anschließend vergleicht es die wiederhergestellten Zeilen mit den geprüften Sicherungsteilen, kontrolliert Beziehungen, tatsächliche Dateiverfügbarkeit, Größe, SHA-256, Schema-Zuordnung und die lokale lesende API. Dauer, Sicherungs-ID, Abweichungen und Einzelprüfungen werden protokolliert.

**Keine automatische Übernahme dieses Berichts als erfolgreicher AlixWork-Nachweis.** Ein vertrauenswürdiger serverseitiger Nachweisadapter für das tatsächlich bereitgestellte Ziel muss nach Bereitstellung mit dessen sicheren Identitäts-/Isolationseinstellungen eingerichtet werden. Manuell hochgeladene JSON-Dateien oder Screenshots gelten nicht als vertrauenswürdiger erfolgreicher Nachweis.
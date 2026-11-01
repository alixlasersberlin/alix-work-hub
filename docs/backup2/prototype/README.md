# ALIX BACKUP 2.0 – isolierter Phase-9B-Prototyp

Dieser Ordner ist nicht an die laufende App, Edge Functions, Cron oder Supabase angeschlossen.
Alle Testobjekte und Identitäten sind synthetisch. Keine Zugangsdaten oder produktiven Originaldateien verwenden.

Tests: `python3 -m unittest discover -s docs/backup2/prototype -p 'test_*.py' -v`

`control-center.html` separat im Browser öffnen: ausschließlich synthetische Ansicht, keine externen Ressourcen,
keine Netzwerkaufrufe, keine Speicherung, kein Backup-/Restore-/Löschknopf.
Die Ansicht ist kein Infrastruktur-Nachweis. Das Python-Modell ist keine produktive Sicherungssoftware.

Grenzen: In-Memory-Ziel und Checkpoint-Serialisierung statt haltbarer Queue; HMAC statt externer Ed25519/KMS-Signatur;
sortierte Fixture-Seiten statt PostgreSQL-/S3-Adapter; keine Verschlüsselungs-, Multipart-, Crash-/Last- oder Restoretests.
`check_v4` prüft nur synthetische NDJSON-Struktur und Zähler; aktuelle Originalmanifeste werden nicht gelesen.
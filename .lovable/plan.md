# ALIXDocs AI 2.0 – Umsetzungsplan

Riesiges Modul — wird strikt **additiv** aufgebaut. Bestehende AlixDocs-Funktionen (Bulk Import, AI-Suche, Sharing, Compliance-Export, Smart-Match, RLS) bleiben unverändert. Alle neuen Tabellen haben Prefix `alixdocs2_` und laufen parallel zu `alixdocs_*`, sodass wir Schritt für Schritt migrieren können.

## Phase 1 — Nextcloud-Anbindung (Foundation)
- Neue Tabellen: `alixdocs2_nc_servers` (mehrere Server: WebDAV-URL, App-Password, TLS), `alixdocs2_nc_watched_folders` (Server + Pfad + Doku-Kategorie + Polling-Intervall), `alixdocs2_nc_sync_runs` (Audit).
- Edge Function `alixdocs2-nc-scan` (Cron alle 5 Min): listet via WebDAV `PROPFIND`, vergleicht ETag/mtime, legt neue Dateien in `alixdocs2_documents` mit Status `neu` an. Datei bleibt in Nextcloud; nur ein signierter Download-Token wird gecached für OCR/Vorschau.
- Admin-UI `/operation/alixdocs2/nextcloud` — CRUD für Server & überwachte Ordner, Test-Verbindung-Button, letzte Sync-Runs.
- App-Password wird über `add_secret` pro Server abgelegt, nie im Klartext in DB.

## Phase 2 — Metadaten-Store & Beziehungen
- `alixdocs2_documents` (nc_server_id, nc_path, etag, size, mime, sha256, status, doc_type, ai_confidence, JSONB `ai_entities`, JSONB `ai_tags[]`).
- `alixdocs2_relations` (document_id + linked_type: kunde/geraet/auftrag/rechnung/service/garantie/ticket/techniker/vertrag + linked_id + confidence + source: ai/manuell). Ein Dokument → n Beziehungen, keine Duplikate.
- `alixdocs2_versions` (SHA256-Dedupe: gleiche Datei erzeugt neue Version am selben logischen Dokument, Historie unveränderlich).
- `alixdocs2_audit` (view, edit, download, delete, relation_change) — append-only, RLS read-only.
- RLS: `has_role` gestuft (Super Admin voll, Admin Lesen+Zuordnen, Fachrollen nur eigene Kunden/Aufträge).

## Phase 3 — OCR & KI-Analyse-Pipeline
- Edge Function `alixdocs2-analyze` wird pro neuem Dokument getriggert (DB-Trigger → `pg_net` → Function).
- Ablauf: Download aus Nextcloud → PDF-Text via `pdf-parse` (bestehende Lib) → falls leer → OCR via Gemini Vision (mehrsprachig DE/EN/TR/AR/RU/VI) → Entity-Extraktion via `google/gemini-3-flash-preview` mit strikter JSON-Schema-Antwort (alle geforderten Felder: Kunde, Auftrag, Serien-Nr., Rechnungs-Nr., Beträge, MwSt., Positionen, QR/Barcode-Text …) → Klassifizierung Doku-Typ.
- Alle KI-Ausgaben validiert (zod) und in `ai_entities`/`ai_tags` gespeichert. Confidence pro Feld.
- Große Dateien >8 MB: OCR nur seitenweise (Reuse der Logik aus `alixdocs-ai-process`).

## Phase 4 — Auto-Zuordnung mit Wahrscheinlichkeiten
- Edge Function `alixdocs2-match` scored gegen `customers`, `orders`, `lager_devices`, `zoho_invoices`, `finance_contracts`, `repair_orders`, `tickets`. Reihenfolge: Auftrags-Nr → Serien-Nr → Kunden-Nr → Rechnungs-Nr → Email → Telefon → Adresse → Firmenname (Token-Match wie Auftragsabgleich).
- UI `/alixdocs2/inbox`: Karten pro Dokument mit Top-3-Vorschlägen (z. B. „96 % Auftrag 24018"), 1-Klick-Übernahme, Multi-Zuordnung möglich.
- Dokumententypen als Stammdaten-Tabelle `alixdocs2_doctypes` (Admin kann Typen ergänzen).

## Phase 5 — Suche
- Postgres FTS auf `alixdocs2_documents.search_tsv` (title + ocr_text + ai_entities + tags), Trigram-Index für Tippfehler (`pg_trgm`).
- Klassische Suchseite `/alixdocs2/suche` — Filter nach Typ, Kunde, Gerät, Zeitraum, Techniker.
- KI-Suche `/alixdocs2/ai` — Edge Function `alixdocs2-ai-search` (RAG, wie bestehende `alixdocs-ai-search`, aber mit Zitier-Quellen und Fußnoten). Antwort nur aus indexierten Dokumenten, keine Halluzinationen.

## Phase 6 — Viewer & Versionierung
- `AlixDocs2Viewer.tsx` erweitert bestehende `PdfPreview` um Rotation, Miniaturen, Kommentare (`alixdocs2_comments`), Notizen, Versions-Vergleich (Split-View), Druck.
- Signed URLs direkt aus Nextcloud, kein Storage-Duplikat außer Cache-Vorschau (`nc-cache` Bucket, TTL 7 Tage).

## Phase 7 — Workflow & Automatik
- Status-Flow: neu → importiert → analysiert → zugeordnet → geprüft → freigegeben → archiviert (`alixdocs2_status_history`).
- Trigger:
  - Garantie-Ende in `ai_entities.garantie_bis` < 30 Tage → Task in `finance_reminders` oder neue `alixdocs2_tasks`.
  - Wartung fällig → Techniker-Benachrichtigung via bestehendes `app_notifications`.
  - Vertragsende → Erinnerung.
  - Fehlendes Pflichtdokument je Auftrag → Ticket in `tickets`.
- Vier-Augen-Prinzip als optionales Flag pro Doku-Typ (nutzt vorhandene `sig_approval_chains`-Idee, aber leichtgewichtig).

## Phase 8 — Dashboard & Sicherheit-Feinschliff
- `/alixdocs2` Dashboard: Importe heute/Woche, Nicht zugeordnet, OCR-Fehler, offene Freigaben, Top-Doku-Typen, Docs pro Kunde/Mitarbeiter, Ø Importdauer, Speicherverbrauch pro Server.
- Watermark-Option bei Export, Download-Audit vollständig, DSGVO-Löschkonzept (Soft-Delete + 30-Tage Wiederherstellung, dann Hard-Delete nur durch Super Admin).
- Aurora-Design (Weiß / Hellgrau / Alix-Rot, Glaskarten, Dark-Mode-kompatibel via bestehende Tokens).

## Phase 9 — Plugin-Architektur (Vorbereitung)
- Source-Adapter-Interface in Edge-Function-Shared-Lib (`nextcloud`, später `imap`, `graph`, `gdrive`, `dropbox`, `sharepoint`, `scanner`, `whatsapp`).
- Neue Quellen implementieren nur das Adapter-Interface, Kern-Pipeline (Analyse → Match → Store) bleibt gleich.

## Menü & Routing
- Neue Gruppe **OPERATIONS → ALIXDocs AI 2.0** (nur Admin/Super Admin sichtbar):
  - Dashboard
  - Posteingang
  - Suche
  - KI-Suche
  - Nextcloud-Server
  - Doku-Typen
- Bestehende ALIXDOCS-Menüs bleiben unverändert erhalten.

## Umfang / Vorgehen
Das ist mehrere Wochen Arbeit. Ich empfehle Phasen-Rollout: **jetzt Phase 1 + 2** (Nextcloud-Anbindung + Metadaten-Struktur), damit wir echte Dateien im System haben und die KI-Pipeline in Phase 3 daran validieren können. Danach Phase für Phase.

Frage:
- Startet mit **Phase 1 + 2** (empfohlen) oder soll ich alles in einem Rutsch bauen (deutlich länger, höheres Risiko)?
- Welche Nextcloud-URL / Test-Server soll ich für Phase 1 hinterlegen?

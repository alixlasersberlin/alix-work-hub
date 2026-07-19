## Etappe 6 – Wissens-Vernetzung & Duplikat-Kontrolle

### 1. Duplikat-Erkennung
- **DB**: Backfill `content_hash` (SHA-256 aus Storage-Objekt) via Edge Function `alixdocs-hash-backfill`; Trigger prüft bei Insert/Update auf existierenden `content_hash` und schlägt `duplicate_of` vor (nicht automatisch – nur Vormerkung).
- **Seite `/dokumente/duplikate`**: Gruppen-Ansicht nach `content_hash`. Aktionen: „Als Duplikat markieren", „Alle bis auf neueste archivieren", „Ignorieren" (setzt Flag im neuen JSON-Field `dedupe_ignored`).
- **Upload-Hook**: `AlixDocsUpload` warnt vor dem Save, wenn Hash bereits existiert.

### 2. Cross-Doc-Verknüpfungen
- **Neue Tabelle `alixdocs_document_links`** (`from_doc_id`, `to_doc_id`, `link_type`, `confidence`, `source` = ai|manual, `created_by`).
- **Link-Typen**: `related_order`, `invoice_for`, `delivery_for`, `references`, `supersedes`.
- **Edge Function `alixdocs-link-suggest`**: läuft nach OCR; matcht Auftragsnummern/Seriennummern zwischen Dokumenten und schlägt Links vor.
- **UI**: Dokument-Detail bekommt Tab „Verknüpfte Dokumente" mit Graph-artiger Anzeige + Manuell-Verknüpfen-Dialog.

### 3. AI-Volltextsuche (RAG)
- **Edge Function `alixdocs-ai-search`**: nimmt Frage, ruft PostgreSQL Full-Text-Search auf `search_tsv` (top 15 Snippets), sendet Kontext an Gemini (`google/gemini-3-flash-preview`) mit Zitier-Instruktion, gibt Antwort + Quellenliste zurück.
- **Seite `/dokumente/ai-suche`**: Eingabefeld, Antwort mit Fußnoten `[1]`, `[2]`, die auf Dokument-Detail klickbar sind.
- Nutzt bestehende `alixdocs_documents.ocr_text` + `search_tsv`; kein neuer Index nötig.

### 4. Menü & Rechte
- Neue Menüpunkte unter **Dokumente**: „Duplikate" und „AI-Suche" (nur Admin/Super Admin).
- RLS: neue Tabelle `alixdocs_document_links` nach identischen Sichtbarkeitsregeln wie `alixdocs_documents` (via `has_role`).

### Technische Details
- `content_hash` bereits vorhanden → nur befüllen, Index anlegen.
- Backfill iteriert Storage-Objekte in Batches à 50; idempotent.
- AI-Suche cached Antworten nicht (jede Frage neu).
- Volltext-Snippets werden mit `ts_headline` extrahiert.

Nach OK starte ich mit Migration + Edge Functions.

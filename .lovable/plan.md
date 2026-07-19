
# ALIXDocs Smart Import & Auto-Matching

Ausbaustufe „Smart Import" – hebt den bestehenden Upload auf mehrstufige, gewichtete Auto-Zuordnung mit Massenverarbeitung und lernender KI.

## Umsetzung in 4 Etappen

### Etappe 1 – Matching-Engine (Kern)
Neue Edge Function `alixdocs-smart-match` (Deno) mit gewichtetem Score-Algorithmus.

Ablauf pro Dokument:
1. **Dateiname-Parser** – Regex für Auftrag (`AW-\d{4}-\d+`), Rechnung, Seriennummer, Kundennummer.
2. **OCR-Kontext** – nutzt vorhandenen `alixdocs-ai-process` Output (`ocr_text`, `extracted_entities`).
3. **Feld-Extraktion via Gemini 2.5 Flash** – strukturierte JSON-Ausgabe:
   ```
   { order_no, invoice_no, serial_no, customer_no, customer_name,
     company, email, phone, address{street,zip,city,country},
     device_name, sku, contract_no, iban, doc_type }
   ```
4. **Kandidaten-Suche** in `orders`, `customers`, `lager_devices` (parallel, top-20 je Feld).
5. **Score-Berechnung** pro Kandidat (Auftrag / Kunde / Gerät):
   ```
   Auftragsnummer 100 · Seriennummer 90 · Kundennummer 80
   Email 70 · Telefon 60 · Firma 50 · Name 40
   Anschrift 35 · Gerät 25 · Rechnungsnr 20
   ```
6. **Entscheidung**:
   - `≥ 95` und Abstand zum 2. Treffer `≥ 20` → **Auto-Assign**
   - `≥ 60` → **Suggestions** (max. 5)
   - sonst → **Unassigned**

### Etappe 2 – Persistenz & UI
- Neue Spalten in `alixdocs_documents`: `match_score`, `match_confidence`, `match_method` (`filename`|`ocr`|`ai`|`manual`), `match_candidates` (jsonb, Vorschlagsliste).
- Neue Tabelle `alixdocs_match_feedback` – speichert manuelle Korrekturen (Basis für Lernen).
- Review-Seite `/dokumente/smart-review` – Liste offener Vorschläge mit Karten:
  - Score-Balken, Top-3-Vorschläge, „Zuweisen" / „Anderes wählen" / „Später".
- Erweiterung `AlixDocsUpload`: nach Upload zeigt Toast Score + Zielauftrag oder „Vorschläge prüfen".

### Etappe 3 – Massenupload (ZIP + Bilder)
- Upload-Komponente akzeptiert `.zip`, `.heic`, `.webp`, `.jpg`, `.png`, `.pdf`.
- Neue Edge Function `alixdocs-bulk-ingest`: entpackt ZIP (via `jszip` npm), HEIC→JPEG (`heic-convert`), reiht jede Datei in Queue.
- Fortschritts-UI: „300 Dokumente · 278 zugeordnet · 18 Vorschläge · 4 Fehler" mit Realtime auf `alixdocs_ai_jobs`.

### Etappe 4 – Lernende KI + Admin
- Nach jeder manuellen Zuweisung: Feedback nach `alixdocs_match_feedback`, Aggregation zu Regeln in `alixdocs_matching_rules` (Absender-Präfixe → Kategorie/Kunde).
- Beim nächsten Import werden Regeln vor der Gemini-Analyse angewandt (+30 Bonuspunkte).
- Admin-Seite `/admin/alixdocs/smart-config`:
  - Score-Gewichte editieren, Auto-Assign-Schwelle, Lieferantenvorlagen, Blacklist, Dublettenregeln.
- Dashboard-Erweiterung `/dokumente/dashboard`:
  - Heute importiert · Auto-Match-Quote · Offene Vorschläge · OCR-Erfolg · KI-Trefferquote (7d-Trend).

## Technische Details

**Neue/geänderte Tabellen**
- `alixdocs_documents`: + `match_score int`, `match_confidence text`, `match_method text`, `match_candidates jsonb`, `matched_by uuid`.
- `alixdocs_match_feedback` (neu): `document_id`, `chosen_entity_type`, `chosen_entity_id`, `rejected_candidates jsonb`, `user_id`, `created_at`.
- `alixdocs_matching_rules` (neu): `pattern`, `field` (filename/ocr), `target_type`, `target_id`, `weight_bonus`, `hit_count`, aktiviert-Flag.
- `alixdocs_smart_config` (neu, single-row): Gewichte + Schwellenwerte als jsonb.

**Edge Functions**
- `alixdocs-smart-match` – Kern-Matcher (LLM: `google/gemini-2.5-flash` via Lovable AI Gateway).
- `alixdocs-bulk-ingest` – ZIP/HEIC-Entpacker, Queue-Runner.
- Erweiterung `alixdocs-ai-process` – ruft nach OCR direkt Smart-Match auf.

**Frontend**
- `src/pages/AlixDocs/SmartReview.tsx` – Review-Queue.
- `src/pages/Admin/AlixDocsSmartConfig.tsx` – Gewichte/Regeln.
- `src/components/alixdocs/MatchScoreBar.tsx`, `CandidateCard.tsx`.
- `src/lib/alixdocs/smartMatch.ts` – Client-Wrapper + Type-Defs.

**RLS**: alle neuen Tabellen intern (`is_internal_user()`), Admin-Config nur Admin/Super Admin.

**Model**: `google/gemini-2.5-flash` (Chat) für Feldextraktion; Vision bereits in `alixdocs-ai-process` für OCR.

## Reihenfolge & Approval
Etappen werden nacheinander gebaut, jede endet mit lauffähigem UI. Ich starte nach deinem OK mit **Etappe 1 (Matching-Engine + DB-Felder)**.

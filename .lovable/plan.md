## AlixDocs – Auftragsbezogenes Dokumentenmanagement

Ich baue das Modul in drei Etappen. **Phase 1 + Versionierung aus Phase 2** zuerst (deine Empfehlung), danach optional Freigabe/Suche und später die KI‑Phase.

---

### Etappe A — Phase 1: Sicheres Grundsystem (jetzt bauen)

**Backend / Datenbank (Migration)**
- Neue Tabellen im `public` Schema:
  - `alixdocs_categories` (Seed: Angebot, Auftrag, Kaufvertrag, Mietvertrag, Finanzierung, Rechnung, Lieferschein, Übergabe, Gerätefoto, Seriennummer, Servicebericht, Reparatur, Wartung, Garantie, Schulung, NiSV, Mediapaket, Reklamation, Kundenkommunikation, Intern vertraulich, Sonstiges)
  - `alixdocs_documents` (order_id, customer_id, device_id, category_id, title, storage_path, mime_type, file_size, document_date, confidentiality_level `normal|vertraulich|streng_vertraulich`, status `entwurf|geprueft|freigegeben|archiviert`, current_version, uploaded_by, deleted_at)
  - `alixdocs_versions` (document_id, version_number, storage_path, file_hash, file_size, uploaded_by, change_note)
  - `alixdocs_audit_log` (document_id, user_id, action, metadata, ip, ua) – append-only, keine Update/Delete-Policy
- GRANT + RLS in jeder Tabelle (authenticated only, `service_role` für Edge Functions).
- Zugriff per `has_role()` — Rollenmatrix wie im Prompt (Geschäftsführung/Admin/SuperAdmin = alles; Buchhaltung/Order = view+upload+approve; Vertrieb/Service = view+upload; Techniker = nur zugewiesene Aufträge; Externe = keiner).
- Streng vertrauliche Dokumente nur Super Admin + Geschäftsführung.
- Trigger für `updated_at`, Trigger schreibt automatisch in `alixdocs_audit_log` bei INSERT/UPDATE/soft-delete.

**Storage**
- Privater Bucket `alixdocs-private` (public=false).
- Pfadschema: `tenants/{tenant_id}/customers/{customer_id}/orders/{order_id}/{document_id}/v{version}/{sanitized_filename}`
- RLS auf `storage.objects` — Lesen/Schreiben nur über Edge Function, keine direkten Client-Uploads.

**Edge Functions**
- `alixdocs-upload` — validiert MIME + Größe (max 50 MB), sanitized Filename, erzeugt document + v1, schreibt Audit-Log.
- `alixdocs-signed-url` — prüft Rechte + Vertraulichkeit, erzeugt Signed URL (10 min), loggt Aktion.
- `alixdocs-delete` — Soft-Delete (Papierkorb, 30 Tage), Purge nur Super Admin.
- `alixdocs-new-version` — hängt neue Version an, alte bleibt sichtbar.

**Frontend**
- Neuer Tab **„Dokumente"** in `OrderDetail` (und analog in RepairOrder/ProductionOrder wenn gewünscht — sag Bescheid).
- Komponente `AlixDocsPanel`:
  - Toolbar: Upload (Drag&Drop), Kategorie-Filter, Suche, Umschalter Liste ↔ Galerie.
  - Listenansicht: Titel, Kategorie, Version, Uploader, Datum, Status, Vertraulichkeit, Aktionen (Öffnen / neue Version / Papierkorb).
  - Galerieansicht: Thumbnails für Bilder, PDF-Icon für PDFs.
  - Inline-Viewer: PDF (`<iframe>` mit Blob-URL), Bilder (Lightbox mit Zoom). Kein direkter Download-Link im DOM.
- Nur erlaubte Formate Phase 1: PDF, JPG, JPEG, PNG, WEBP, HEIC.
- Papierkorb-Ansicht (30 Tage) + Wiederherstellen.

**Versionierung (Phase 2 vorgezogen)**
- „Neue Version hochladen" statt Überschreiben, `current_version` steigt, alte Versionen aufklappbar.
- SHA-256 Hash pro Version.

---

### Etappe B — später (nach deiner Freigabe von A)

- Freigabe-Workflow (Entwurf → Geprüft → Freigegeben) inkl. Sperre gegen Löschen freigegebener Verträge/Rechnungen.
- Globale Dokumentensuche `/dokumente` (Kunde, Auftrag, Seriennummer, Kategorie, Zeitraum, Volltext auf Metadaten).
- Auto-Ablage bereits generierter PDFs (Angebot, AB, Rechnung, Servicebericht, Übergabeprotokoll) → schreibt automatisch in AlixDocs.
- E-Mail-Anhänge aus MailCenter „an Auftrag anheften".

### Etappe C — AlixDocs KI

- OCR (Gemini via Lovable AI), Auto-Kategorisierung, Serien-/Auftragsnummer-Erkennung, Dubletten, Zusammenfassungen, Ablauf-Warnungen.

---

### Sicherheitsprinzipien (verbindlich)
- Bucket **immer privat**, Zugriff nur über Signed URLs mit 10 min TTL.
- Keine Storage-Pfade im Frontend sichtbar.
- Jede Aktion → Audit-Log (append-only, kein UPDATE/DELETE per RLS).
- MIME + Magic-Bytes-Check server-seitig, ausführbare Dateien blockiert.
- Soft-Delete Standard; Hard-Delete nur Super Admin.
- Vertraulichkeitsstufe entscheidet zusätzlich zum Rollen-Check.

---

**Frage vor Start:** Soll AlixDocs in Etappe A nur in **`OrderDetail`** erscheinen, oder gleich auch in **Reparaturaufträgen** und **Produktionsaufträgen**? (Datenmodell unterstützt es von Anfang an — es geht nur um die UI-Tabs.)

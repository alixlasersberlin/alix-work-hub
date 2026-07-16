# PDF-Auftragsimport für AlixWork

Ein Assistent, mit dem berechtigte Mitarbeiter PDF-Aufträge (Kaufvertrag, Angebot, Auftragsbestätigung, Leasing usw.) hochladen. Die KI extrahiert Kunden-, Produkt-, Finanz- und Vertragsdaten, gleicht sie mit dem bestehenden Katalog / CRM ab, und der Mitarbeiter bestätigt vor dem endgültigen Anlegen des Auftrags.

**Grundregeln (nicht verhandelbar):**
- Keine neuen Kunden-, Auftrags- oder Artikel-Tabellen. Import läuft über neue **Staging-Tabellen** und schreibt erst nach Bestätigung in `customers` / `orders` / `order_items`.
- KI-Ausgabe wird **nie** direkt produktiv. Immer Review durch Mensch.
- Private Supabase-Storage-Bucket, signierte URLs, RLS mit `has_role`.
- Original-PDF unverändert speichern + SHA-256 Hash für Dublettenprüfung.
- Bestehendes Design (Black/Gold Enterprise), keine neuen Design-Systeme.

---

## Rollout in 5 Phasen

Ich empfehle, in kleinen Phasen zu bauen und jede Phase getrennt zu testen. Ich starte nach deiner Freigabe mit **Phase 1**.

### Phase 1 – Fundament (Datenbank + Storage + Rollen)
- Neuer privater Storage-Bucket `order-imports`.
- Neue Tabellen: `order_imports`, `order_import_fields`, `order_import_items`, `order_import_logs`.
  Alle mit `tenant_id`, RLS, `has_role`-Policies, Zeitstempeln, Grants.
- Neue Berechtigungen (via bestehende Rollenlogik):
  - Upload/Analyse: `Super Admin`, `Admin`, `Geschäftsführung`, `Order`, `Vertrieb`.
  - Import bestätigen: `Super Admin`, `Admin`, `Geschäftsführung`, `Order`.
  - Löschen: nur `Super Admin` (bestehende Regel).
- Bestehende Tabellen (`customers`, `orders`, `catalog_items` …) werden **nicht** verändert.

### Phase 2 – Upload & Edge Function „analyze"
- Edge Function `order-import-analyze`:
  1. PDF-Validation (MIME, Größe ≤ 20 MB, kein passwortgeschützt).
  2. SHA-256 Hash → Dublettencheck gegen `order_imports`, `orders.external_reference`.
  3. Text-Extraktion (pdfjs) + OCR-Fallback (Tesseract / Cloud) für Scans.
  4. Klassifikation Dokumenttyp.
  5. Lovable AI Gateway (`google/gemini-3-flash-preview`), strukturierte JSON-Ausgabe mit Konfidenzwerten pro Feld + Seitenreferenz.
  6. Prompt-Injection-Schutz: PDF-Inhalt als user-Content, System-Prompt fixiert.
  7. Speichert Rohergebnis in `order_imports.raw_extraction_json`.
- Neue Seite `/auftraege/pdf-import/upload`: Drag-and-drop, Dokumenttyp-Auswahl, DSGVO-Hinweis.

### Phase 3 – Review-Assistent (5 Schritte)
- Route `/auftraege/pdf-import/:id/review`.
- Zweispaltig: links PDF-Preview (react-pdf) mit Highlight-Sprung, rechts editierbare Felder gruppiert (Auftrag/Kunde/Produkte/Finanzen/Lieferung/Vertrag/Mitarbeiter/Unterschriften).
- Konfidenz-Ampel: grün ≥ 90, gelb 70–89, rot < 70, grau = leer.
- Kunden-Matching-Widget (E-Mail, Telefon, USt-ID, Fuzzy Name/Adresse) → Auswahl bestehender Kunde / neu anlegen / zusammenführen.
- Artikel-Matching pro Position: SKU exact → Fuzzy Name → manuelle Zuordnung / freier Text.
- Automatische Prüfungen: Netto+MwSt=Brutto, Brutto−Anzahlung=Rest, USt-Plausibilität, Signatur vorhanden, Duplikatverdacht.
- Manuelle Änderungen → `order_import_fields` (original + korrigiert + user + timestamp).

### Phase 4 – Import & Folgeprozesse
- Edge Function `order-import-commit`:
  - Serverseitige Re-Validation aller Werte.
  - Kunde: bestehende ID nutzen oder in `customers` INSERT (nur wenn User bestätigt „neu anlegen").
  - Auftrag in `orders` INSERT (Nummernkreis via bestehendes `number-ranges`), `external_reference` = erkannte externe Nummer.
  - Positionen in `order_items`.
  - PDF-Link in `order_documents`.
  - Audit-Eintrag in `order_import_logs` + `audit_logs`.
  - Folgeaufgaben nur wenn Modul existiert (Lieferplanung, Mediapaket, Finanzierung, NiSV) – als optionale Checkboxen im Review-Schritt.
- Status-Übergang `order_imports.status`: `analyzing → review → committed | cancelled | duplicate`.

### Phase 5 – Übersicht, Admin & Feinschliff
- Seite `/auftraege/pdf-import`: Tabelle aller Importe mit Filtern (Zeitraum, Status, Kunde, Verkäufer, Warnungen, Duplikate).
- Admin-Seite `/einstellungen/pdf-import`: max. Dateigröße, aktive Dokumenttypen, Konfidenzgrenzen, OCR an/aus, Standard-Status/Niederlassung/Währung, Aufbewahrungsfrist Entwürfe.
- Dashboard-Schnellaktion + Button „Auftrag aus PDF importieren" neben „Neuer Auftrag".
- Abschluss-QA gegen die 18 Abnahmekriterien.

---

## Technische Details (für dich als Entwickler-Zusammenfassung)

- **KI-Modell:** Lovable AI Gateway, `google/gemini-3-flash-preview`, `response_format: json_object`, feste JSON-Schema-Definition, Temperature niedrig.
- **PDF:** `pdfjs-dist` serverseitig via `npm:` in Edge Function; OCR-Fallback via `tesseract.js` (langsam) oder – falls gewünscht – Google Cloud Vision (Secret nötig).
- **Storage:** `order-imports/{tenant}/{yyyy-mm}/{uuid}.pdf`, RLS via `tenant_id` claim.
- **Realtime-Status** (optional): `order_imports` in `supabase_realtime` publication für Live-Progress.
- **Ausgeschlossen im ersten Wurf:** biometrische Signaturprüfung, Malware-Scan (Hook nur vorbereitet), Foto/E-Mail/Excel-Import, automatische Zahlungszuordnung.

---

## Was ich zuerst brauche

Zwei Entscheidungen, dann lege ich mit Phase 1 (Migration + Bucket) los:

1. **OCR für Scans:** eingebautes `tesseract.js` (kostenlos, langsamer, ok für ~10 Seiten) **oder** Google Cloud Vision (schneller/genauer, du müsstest Secret bereitstellen)?
2. **Automatische Folgeprozesse in Phase 4:** alle Module (Lieferung, Mediapaket, NiSV, Finanzierung) oder erstmal nur Auftrag + Dokumentenablage und Folgeaufgaben später?

Sag mir kurz „Phase 1 starten" mit deiner Wahl, dann geht's los.

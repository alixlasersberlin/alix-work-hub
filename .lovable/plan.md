
## Ziel
Bestehendes Reparaturmodul (`/reparatur`, `repair_orders`, `repair_spare_parts`, `device_lifecycle`, …) bleibt unverändert. Phase 5 ergänzt vier Bausteine, ohne bestehende Tabellen, Trigger oder Edge-Functions zu brechen.

## 1. Navigation – Service → Reparaturannahme
- In `AppLayout` (Sidebar) bestehenden Eintrag „Reparaturannahme" unter neue Gruppe **Service** verschieben, mit Untermenüs:
  - Reparaturannahme (Dashboard, `/reparatur`)
  - Werkstatt (`/reparatur/technik`)
  - Ersatzteile (`/reparatur/ersatzteile`)
  - **Kostenvoranschläge** (`/reparatur/kostenvoranschlaege`) – neu
  - Garantieprüfung (`/reparatur/garantie`) – verlinkt auf bestehende `Garantiecenter`-Seite
  - **Rückversand** (`/reparatur/rueckversand`) – neu
- `Reparatur/Layout.tsx` Tabs erweitern um „Kostenvoranschläge" und „Rückversand".

## 2. Neue Rolle „Reparaturannahme"
- Migration: Rolle in `public.roles` einfügen (Idempotent: `ON CONFLICT (name) DO NOTHING`).
- `can_access_repair()` und `can_manage_repair()` erweitern → zusätzlich `has_role('Reparaturannahme')`.
- `useRepairPermissions`-Hook um Flag `isReparaturannahme` ergänzen.
- Sidebar-Sichtbarkeit für Gruppe Service ergänzen (Admin/Order/Technik/Finance/Tourenplanung/Reparaturannahme).

## 3. Kostenvoranschlag-Modul
### DB (neue Tabelle, da nichts Passendes existiert)
```sql
CREATE TABLE public.repair_quotes (
  id uuid PK,
  repair_order_id uuid FK → repair_orders ON DELETE CASCADE,
  quote_number text UNIQUE,           -- KV-2026-000001 via Sequence
  status text DEFAULT 'Entwurf',      -- Entwurf | Versendet | Freigegeben | Abgelehnt
  labor_hours numeric,
  labor_rate numeric,
  labor_total numeric,
  parts_total numeric,
  shipping_total numeric,
  total_net numeric,
  total_gross numeric,
  vat_rate numeric DEFAULT 19,
  customer_note text,
  internal_note text,
  pdf_path text,
  approval_token uuid DEFAULT gen_random_uuid(),
  sent_at timestamptz, decided_at timestamptz, decided_by_email text,
  created_at, updated_at, created_by
);
CREATE TABLE public.repair_quote_items ( id, quote_id FK, kind text, description, quantity, unit_price, line_total );
CREATE TABLE public.repair_quote_history ( id, quote_id, action, actor, meta jsonb, created_at );
```
- GRANTS + RLS: `can_access_repair()` lesen, `can_manage_repair()`/Finance ändern, Super-Admin löschen.
- Sequence `repair_quote_seq` + Trigger `assign_quote_number` (Format `KV-YYYY-000001`).
- Status-Übergänge & history-Logging via Trigger.

### Frontend
- `src/pages/Reparatur/Kostenvoranschlaege.tsx` – Liste & Filter.
- `src/pages/Reparatur/QuoteDetail.tsx` – Editor (Positionen, Summen, PDF, Senden).
- PDF-Generator `src/lib/repair/quote-pdf.ts` (jsPDF, gleiches Layout wie work-order-pdf).
- Speicherung in bestehendem Bucket `repair-files` unter `quotes/<id>.pdf`.
- Im Reparatur-Detail Tab „Kostenvoranschlag" zum schnellen Erstellen.

### Kundenfreigabe
- Edge Function `send-repair-quote` (Resend via Lovable Cloud Mail-Infra falls vorhanden, sonst direkt `RESEND_API_KEY`): versendet Mail mit Link `https://<app>/repair-quote/<token>` + PDF-Anhang.
- Edge Function `repair-quote-decision` (public, anon erlaubt): nimmt `token` + `decision` entgegen, setzt Status, schreibt history, triggert Folgemail an Service.
- Öffentliche Seite `src/pages/PublicRepairQuote/Decision.tsx`: zeigt KV-Daten readonly + Buttons Annehmen/Ablehnen.

## 4. Rückversand-Modul
### DB-Erweiterung repair_orders
Nur additive Felder (keine bestehenden ändern):
```sql
ALTER TABLE public.repair_orders
  ADD COLUMN IF NOT EXISTS shipping_carrier text,
  ADD COLUMN IF NOT EXISTS shipping_tracking_number text,
  ADD COLUMN IF NOT EXISTS shipping_tracking_url text,
  ADD COLUMN IF NOT EXISTS shipped_at timestamptz,
  ADD COLUMN IF NOT EXISTS shipping_note text;
```
### Frontend
- `src/pages/Reparatur/Rueckversand.tsx`: Liste aller Reparaturen mit Status „Reparatur abgeschlossen" / „An Tourenplanung übergeben" → Dialog zum Erfassen Carrier/Tracking, Setzen Status `Ausgeliefert`.
- Im Reparatur-Detail neuer Tab „Rückversand".

### Mailtrigger
- Bestehender Trigger `trg_repair_notify_status` deckt Statuswechsel auf „Ausgeliefert" bereits ab (Event `shipment_sent`). Erweitern: zusätzlich `shipping_carrier`/`tracking_url` in Notify-Payload aufnehmen (über bestehende `notify_customer_event`).

## 5. Reparaturbericht-PDF
- Neuer Generator `src/lib/repair/report-pdf.ts`: erzeugt PDF mit Fehlerbild, Diagnose, durchgeführte Arbeiten, Ersatzteile (aus `repair_spare_parts`), Arbeitszeit, Techniker, Datum, Unterschrift-Block.
- Trigger-Punkt: Button im Reparatur-Detail „Reparaturbericht erzeugen"; automatisch beim Statuswechsel auf „Reparatur abgeschlossen" (clientseitig nach Save) Datei in Bucket `repair-files` unter `reports/<repair_id>.pdf` ablegen, Pfad in neuer Spalte `repair_orders.report_pdf_path` speichern.
- Migration: `ADD COLUMN IF NOT EXISTS report_pdf_path text`.

## 6. Abschlussbericht (am Ende der Implementierung)
Im Chat liefere ich:
- Tabellen erstellt: ja (repair_quotes, repair_quote_items, repair_quote_history)
- Rolle eingerichtet: Reparaturannahme
- Reparaturworkflow aktiv: ja (KV → Kundenfreigabe → Reparatur → Bericht → Rückversand → Finance)
- PDF-Generierung aktiv: ja (work-order, handover, **quote**, **report**)
- Finance-Übergabe aktiv: bestehend, unverändert
- Gerätehistorie aktiv: bestehend, unverändert
- Modul produktionsbereit: Ja

## Risiko / Was NICHT angefasst wird
- `repair_orders`-Bestandsspalten, Trigger, RLS bleiben.
- Tickets-/Orders-/Finance-/Tourenplanungs-Module unverändert.
- Bestehende Edge Functions (sync, webhook, alerts) unverändert.
- Nur additive ALTERs (`IF NOT EXISTS`) und neue Tabellen.

## Reihenfolge der Calls
1. Migration (Rolle, can_access_repair-Update, neue Tabellen+GRANTs+RLS+Trigger, repair_orders additive Spalten).
2. Edge Functions `send-repair-quote` + `repair-quote-decision`.
3. Frontend: Layout/Sidebar, Kostenvoranschläge, Rückversand, PDF-Generatoren, Routen in `App.tsx`, Public Decision-Seite.
4. Memory-Update („Reparaturannahme"-Rolle & neue Tabellen).

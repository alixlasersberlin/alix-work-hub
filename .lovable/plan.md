# Bewertungssystem für AlixWork

Komplett neues, eigenständiges Modul. Keine Änderungen an bestehenden Tabellen, Rollen, Workflows oder Menüs (nur additiv: neuer Sidebar-Eintrag, neue Tabellen, neue Edge Function, neue Templates).

## 1. Datenbank (neue Migration)

Zwei neue Tabellen im `public` Schema, plus Sequenz für Tokens. Kein Eingriff in `orders`, `customers`, etc.

**`reviews`**
- order_id, customer_id, customer_name, customer_email, order_number, product_name, delivery_date
- rating_delivery (1–5), rating_driver_friendliness (1–5), training_answer (enum: ja/teilweise/nein), rating_training_text, improvement_text
- review_token (unique), token_expires_at, invitation_sent_at, invitation_sent_by, invitation_status, submitted_at, status (open/submitted/archived)
- created_at, updated_at
- Unique-Constraint: ein Datensatz pro `order_id`

**`review_email_logs`**
- review_id, order_id, customer_email, sent_by, sent_type (automatic/manual), sent_at, delivery_status, error_message

**RLS-Policies**
- SELECT `reviews` + `review_email_logs`: alle authentifizierten Nutzer
- INSERT/UPDATE/DELETE: nur `has_role('Super Admin')`
- Öffentliche Bewertungsabgabe erfolgt ausschließlich über Edge Function mit Service-Role + Token-Prüfung (kein anon-Grant nötig).
- DELETE konform zur bestehenden Regel: nur Super Admin.

Kein `ALTER TABLE orders`. Verknüpfung läuft über `reviews.order_id` ohne FK-Cascade-Eingriff.

## 2. Edge Functions (neu)

**`send-review-invitation`** (verify_jwt = true)
Input: `{ order_id, manual?: boolean }`
- Liest Auftrag (Service-Role, read-only): Kundenname, E-Mail, Auftragsnummer, Produkt, Lieferdatum
- Prüft: E-Mail vorhanden, Auftrag „Geliefert", noch keine Einladung
- Bei manuell: prüft Super-Admin-Rolle des Aufrufers
- Erstellt/aktualisiert `reviews`-Eintrag, generiert Token (`crypto.randomUUID()` + Hash, 90 Tage gültig)
- Ruft `send-transactional-email` mit Template `review-invitation` auf
- Schreibt `review_email_logs`

**`submit-review`** (verify_jwt = false, öffentlich)
Input: `{ token, answers }`
- Validiert Token + Ablauf + noch nicht abgegeben
- Schreibt Antworten in `reviews`, setzt `submitted_at`, `status='submitted'`

**`get-review-context`** (verify_jwt = false)
Input: `{ token }` → liefert nur: customer_name, order_number, product_name, delivery_date (keine internen IDs)

## 3. E-Mail-Template

`supabase/functions/_shared/transactional-email-templates/review-invitation.tsx`
- Betreff: „Ihre Bewertung zu Ihrer Alix Lasers Lieferung"
- Anrede + kurzer Text + Button „Jetzt Bewertung abgeben" → `https://alix-finance.de/bewertung/<token>`
- Registrierung in `registry.ts`

## 4. Automatik bei Statuswechsel „Geliefert"

Nicht-invasiv: **kein** DB-Trigger auf `orders`. Stattdessen Hook in der bestehenden Status-Update-Logik im Frontend / vorhandenen Edge-Function-Stellen, an denen `order_status` auf `Geliefert` gesetzt wird → ruft `send-review-invitation` mit `manual=false` auf. Fehlschläge werden geloggt, brechen den Statuswechsel nicht ab.

Ergänzend kleiner Service-Helper `src/lib/review-invitation.ts` für einheitlichen Aufruf.

## 5. Frontend – internes Modul

**Sidebar (`AppLayout.tsx`)**: neuer Hauptpunkt „Bewertungen" → `/bewertungen`, sichtbar für alle Rollen.

**`src/pages/Reviews/ReviewsList.tsx`**
- Tabelle: Auftragsnummer, Kunde, Produkt, Lieferdatum, Versandstatus, Bewertungsstatus, Lieferung ⭐, Fahrer ⭐, Einweisung, Verbesserungswunsch, Datum, Aktionen
- Filter: alle / nicht versendet / versendet / erhalten / nicht erhalten / Lieferdatum / Produkt / Sterne
- Aktionen (Super Admin): senden, erneut senden, bearbeiten, archivieren, löschen
- Alle anderen Rollen: nur „Ansehen"

**`src/pages/Reviews/ReviewDetail.tsx`** (Drawer/Dialog) – Anzeige + Edit-Form (Super Admin)

**Auftragsdetailseite (`OrderDetail.tsx`)**: nur ein additiver Button „Bewertung manuell senden" – ausschließlich für Super Admin, nur wenn `order_status='Geliefert'`. Kein Eingriff in bestehende Order-Logik.

## 6. Frontend – öffentliche Bewertungsseite

Neue Routes außerhalb des Auth-Layouts:
- `/bewertung/:token` → `src/pages/PublicReview/ReviewForm.tsx`
- `/bewertung/danke` → `ReviewThanks.tsx`
- Fehlerzustände: ungültig/abgelaufen, bereits abgegeben

Design: hell, neutral, mobil-optimiert, Alix-Lasers-Logo oben, große Submit-Schaltfläche. Komplett ohne Login, ohne Sidebar/AppLayout. Holt Kontext über `get-review-context`, sendet über `submit-review`.

## 7. Sicherheit
- Token = 32-Byte Random (hex), unique, Index, optional Ablauf
- Keine internen IDs im Public-Endpoint sichtbar
- Eine Bewertung pro Auftrag (DB-Unique)
- Doppel-Submit verhindert via `submitted_at IS NULL`-Check serverseitig
- DSGVO: keine Speicherung über das Notwendige hinaus

## Technische Details

- Migration legt Tabellen + GRANTs + RLS + Policies + Trigger `set_updated_at` an.
- Edge Functions verwenden Service-Role-Client für DB-Zugriff, validieren JWT/Rolle manuell wo nötig.
- E-Mail-Versand strikt über bestehende `send-transactional-email`-Pipeline (Queue, Suppression, Unsubscribe-Footer automatisch).
- Public-URL-Basis: aktuelle Custom Domain `https://alix-finance.de`.
- Kein Eintrag von Reviews-Tabellen in `audit_trigger_fn`-Bindungen, um bestehendes Audit-Verhalten nicht zu verändern.

## Offene Punkte zur Bestätigung

1. Public-URL-Basis = `https://alix-finance.de` ok? (Alternativ Published-URL.)
2. Token-Ablauf: Vorschlag **90 Tage**, danach „abgelaufen". Ok?
3. Auto-Versand-Trigger: an welcher Stelle wird `order_status` aktuell auf `Geliefert` gesetzt – zentral im Frontend (OrderEditDialog/OrderDetail) oder auch in einer Edge Function? Bitte kurz bestätigen, damit der Hook genau dort und nirgendwo sonst eingebaut wird.

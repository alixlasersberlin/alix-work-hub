# Kundenportal Phase 1 – Übersicht

Status: Iteration A umgesetzt. Iteration B (AlixWork-Admin-Tab „Kundenportal", Session-Verwaltung, Einladungs-Mail, Audit-Viewer) folgt separat.

## Auth-Flow
1. Kunde ruft `/kunde/login` auf, gibt E-Mail ein.
2. `supabase.auth.signInWithOtp({ email, shouldCreateUser: false })` – Supabase versendet 6-stelligen Code (Standard-Auth-Mail).
3. Kunde gibt Code ein → `verifyOtp({ type: 'email' })`.
4. Nach Erfolg wird `customer_portal_users` geprüft (`status='active'`). Andernfalls sofortiger `signOut`.
5. Client-seitiges Rate-Limit: 5 Fehlversuche → 15 Min lokale Sperre. Server-seitig greifen zusätzlich Supabase-Auth-Limits.
6. Auto-Logout nach 30 Min Inaktivität (Idle-Timer im Portal-Layout).

## Datenmodell
- `customer_portal_users` – bestand bereits, neu: CHECK-Constraint auf `status ∈ (invited|active|suspended|disabled)`.
- `customer_portal_audit_logs` – neu. Speichert Login-Versuche, Downloads, Profil-Öffnungen etc.
- `mail_attachments` – bleibt Quelle der Rechnungs-PDFs (`document_type = 'Rechnung'`).
- `customers` – Stammdaten read-only.
- `customer_portal_tickets` – nimmt „Datenänderung mitteilen"-Anfragen als `category = 'data_change_request'`.

## RLS
- Neue Funktion `public.current_portal_customer_id()` (SECURITY DEFINER) liefert die Kunden-ID des eingeloggten aktiven Portal-Users.
- `mail_attachments`: zusätzliche Policy `portal_user_read_own_invoices` – Portal-User sehen nur eigene Rechnungen.
- `customer_portal_audit_logs`: Portal-User dürfen ausschließlich für die eigene `customer_id` einfügen; lesen nur Super Admin / Admin / Buchhaltung.

## Storage / Rechnungs-Download
- Bucket bleibt privat.
- Client ruft Edge Function `portal-invoice-download` mit `attachment_id`.
- Function prüft: eingeloggter User → `customer_portal_users.status='active'` → `mail_attachments.customer_id` stimmt → `document_type='Rechnung'` → dann `createSignedUrl(60)`.
- Ergebnis: Signierte URL mit 60 s Lebensdauer.

## Portal-UI (Phase 1 sichtbar)
- `/kunde` – Übersicht (Firma/Ansprechpartner/Kundennummer, Rechnungs-KPI, letzte 3 Rechnungen).
- `/kunde/rechnungen` – Liste mit Filter (Status/Jahr/Suche), Sortierung, sicherem PDF-Download.
- `/kunde/meine-daten` – Read-only + „Datenänderung mitteilen" (öffnet Ticket, ändert keine Kundendaten direkt).
- Alle anderen `/kunde/*`-Routen sind hart auf `/kunde` redirected (Phase 1 Feature-Flag; Code bleibt erhalten).

## Sicherheitstest-Checkliste (manuell)
1. Kunde A ruft PDF von Kunde B über Edge Function → **403/404**.
2. Direkter Storage-URL-Aufruf ohne Login → **403**.
3. Deaktivierter Portal-Zugang: `verifyOtp` erfolgreich, danach Portal-Check → sofortiger Logout.
4. Signierte URL nach 60 s aufrufen → **410/expired**.
5. Manipulierte `attachment_id` (fremde UUID) → **404**.
6. Login-Endpoint mit unbekannter E-Mail: gleiche neutrale Meldung wie bei bekannter E-Mail.

## Rollback
1. `App.tsx` – alte Route-Definitionen wiederherstellen (siehe git history).
2. Layout/Login/Dashboard/Invoices/MyData zurücksetzen.
3. Edge Function löschen: `supabase functions delete portal-invoice-download`.
4. Migration rückgängig:
```sql
DROP POLICY IF EXISTS "portal_user_read_own_invoices" ON public.mail_attachments;
DROP POLICY IF EXISTS "internal_read_audit" ON public.customer_portal_audit_logs;
DROP POLICY IF EXISTS "portal_user_insert_own_audit" ON public.customer_portal_audit_logs;
DROP TABLE IF EXISTS public.customer_portal_audit_logs;
DROP FUNCTION IF EXISTS public.current_portal_customer_id();
ALTER TABLE public.customer_portal_users DROP CONSTRAINT IF EXISTS customer_portal_users_status_chk;
```

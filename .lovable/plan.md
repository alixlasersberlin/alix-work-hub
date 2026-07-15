
# Phase 1 — Sicheres Kundenportal (Rechnungen + Stammdaten)

Bestehendes `/kunde` wird umgebaut, keine Parallelstruktur. Rechnungen bleiben `mail_attachments` (document_type='Rechnung'). Kein `tenant_id` auf Portal-Zugängen — Mandant wird über `customers` abgeleitet. OTP über Supabase Standard.

## 1. Login-Umbau (`/kunde/login`)

- Passwortfeld entfernen. Zwei Schritte: E-Mail eingeben → 6-stelliger Code eingeben.
- `supabase.auth.signInWithOtp({ email, shouldCreateUser: false })` + `verifyOtp({ type: 'email' })`.
- Neutrale Fehlermeldung ("Falls die E-Mail hinterlegt ist, wurde ein Code gesendet") — kein Enumeration-Leak.
- Nach Verify: Prüfung ob `customer_portal_users`-Eintrag mit `status='active'` existiert; sonst sofort `signOut` + Hinweis "Bitte Alix Lasers kontaktieren".
- Client-seitiges Rate-Limit-Feedback (5 Fehlversuche → 15 Min Sperre lokal + Audit-Eintrag). Harte Limits über Supabase Auth-Config (`rate_limit_email_sent`).
- Auto-Logout nach 30 Min Inaktivität (Idle-Timer im Layout).

## 2. Portal-Reduktion (`/kunde/*`)

Sichtbar in Phase 1: **Übersicht, Rechnungen, Meine Daten, Abmelden**.
Alle anderen Tabs (Bestellungen, Katalog, Warenkorb, Geräte, Wartungen, Reparaturen, Garantien, Gesundheit, Tickets, Termine, Dokumente, Angebote, Nachrichten, Support, Bewertungen, Verlauf) und deren Routen werden hinter einem Feature-Flag `PORTAL_PHASE=1` ausgeblendet (Routen bleiben im Code, aber redirect auf `/kunde`).

- **Dashboard**: Firmenname, Ansprechpartner, Kundennummer, Gesamt-/Offene Rechnungen, Summe offen, letzte 3 Rechnungen, Buttons "Alle Rechnungen", "Meine Daten", "Abmelden".
- **Rechnungen**: bestehende Seite bleibt; Filter (alle/bezahlt/offen/überfällig/Jahr), Sortierung, Detailansicht mit Netto/USt/Brutto sofern in `mail_attachments`-Metadaten vorhanden (sonst nur Basis-Felder). Download über signierte URL (60s).
- **Meine Daten**: read-only + Button "Datenänderung mitteilen" → schreibt Eintrag in `customer_portal_tickets` (Typ `data_change_request`), nicht in `customers`.

## 3. Datenbank-Änderungen (Migration)

- Neue Tabelle `customer_portal_audit_logs` (id, customer_id, auth_user_id, action, object_type, object_id, success, ip_address, user_agent, metadata jsonb, created_at) + GRANTs + RLS: nur Super Admin / Buchhaltung / Datenschutz lesen; alle Portal-User dürfen INSERT für die eigene `customer_id`.
- `customer_portal_users`: RLS-Verschärfung, Status-Enum-Check (`invited|active|suspended|disabled`).
- SECURITY DEFINER Funktion `public.current_portal_customer_id()` → liest `customer_portal_users.customer_id` für `auth.uid()` mit `status='active'`.
- RLS auf `mail_attachments` prüfen/ergänzen: Portal-User darf nur Zeilen mit `customer_id = current_portal_customer_id()` UND `document_type='Rechnung'` sehen. Bestehende interne Policies bleiben.
- Storage-Policy für `mail-attachments`-Bucket: nur signed URLs, Zugriff via Edge Function `portal-invoice-download` die vorher RLS-Check macht (Bucket bleibt privat).

## 4. Edge Function `portal-invoice-download`

- Input: `attachment_id`.
- Prüft: eingeloggter User → `customer_portal_users.status='active'` → `mail_attachments.customer_id` stimmt → `document_type='Rechnung'`.
- Erst dann `createSignedUrl(60)` und zurückgeben. Audit-Insert.

## 5. AlixWork-Admin: „Kundenportal"-Bereich

Im bestehenden Kundendetail (`/kunden/:id`) neuer Tab **Kundenportal** mit:
- Portalzugang aktivieren/deaktivieren, Login-E-Mail anzeigen/ändern, letzter Login, aktive Sitzungen anzeigen/beenden (via Admin API in Edge Function `portal-admin`), Einladung erneut senden (Supabase Invite), Audit-Log-Viewer.
- Neue Berechtigungen als Rolle-Flags: `customer_portal.view|activate|disable|manage_sessions|view_audit_logs|change_login_email|resend_invitation` — zugewiesen an Super Admin, Geschäftsleitung, Buchhaltung, Datenschutz.

## 6. Design & Sicherheits-Feinschliff

- Login-Screen im bestehenden Alix-Design (dunkles Silber + Gold, mobile-first). Datenschutz/Impressum-Links.
- Keine Marketing-Cookies im Portal-Bereich.
- Manuelle Sicherheits-Testchecks in `docs/portal-phase1-tests.md`.

## 7. Dokumentation

`docs/customer-portal-phase1.md` mit Tabellen, RLS, Storage, Auth-Flow, Rollen, Edge Functions, ENV, Testfällen, Rollback.

## Explizit NICHT in Phase 1

- Keine neue `invoices`/`customers`-Tabelle (Prompt-Vorschlag verworfen — würde AlixWork-Struktur duplizieren).
- Kein `tenant_id` in `customer_portal_users`.
- Keine Änderungen an Bestellungen/Angeboten/Tickets/Geräten/Verträgen — Routen ausgeblendet.
- Keine Datenmigration bestehender Portal-Nutzer (bleiben aktiv, wechseln beim nächsten Login auf OTP).

## Reihenfolge der Umsetzung

1. Migration (audit-Tabelle, RLS, `current_portal_customer_id()`).
2. Edge Function `portal-invoice-download`.
3. Login-Umbau + Layout-Reduktion.
4. Dashboard/Rechnungen/Meine-Daten Feinschliff + Audit-Calls.
5. AlixWork Admin-Tab „Kundenportal" + Edge Function `portal-admin`.
6. Dokumentation + manuelle Sicherheitstests.

Nach jedem Schritt kurzer Zwischencheck durch dich, bevor der nächste startet.

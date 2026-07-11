
# Mediapaket-Integration in AlixWork

Ziel: Das externe Mediapaket (mediapaket.alix-lasers.com) wird als natives, produktionsfähiges Modul in AlixWork übernommen – mit voller Anbindung an Kunde, Auftrag, Gerät, Rollen, RLS, Storage, Audit und Benachrichtigungen. Bestehende Funktionen bleiben unverändert.

Wegen des enormen Umfangs schlage ich eine **phasenweise Umsetzung in 6 Phasen** vor. Jede Phase wird einzeln ausgeliefert und getestet, bevor die nächste startet. Ich möchte dazu vorab ein paar Punkte klären, weil einige Anforderungen Auswirkungen auf Struktur, Rechte und Budget haben.

---

## Rückfragen vor Umsetzung

1. **Externer Datenimport**  
   Existiert ein Zugang (Datenbank-Dump, CSV-Export, API) zum bestehenden `mediapaket.alix-lasers.com`? Ohne Export-Quelle kann Phase 6 (Migration Altbestand) nicht sauber umgesetzt werden – ich würde dann eine leere Import-Maske vorbereiten, die später gespeist wird.

2. **Kundenauthentifizierung auf `/book`**  
   `/book` liegt aktuell im ESC-Public-Bereich (BookingPortal), offenbar ohne Login. Mediapaket setzt aber einen erkannten AlixWork-Kunden voraus. Zwei Optionen:  
   a) Mediapaket-Kachel nur nach Login (via Customer-Portal `/portal` Flow, das existiert bereits) sichtbar.  
   b) Zugang über Magic-Link aus AlixWork/E-Mail statt Passwort.  
   Meine Empfehlung: **(b) Magic-Link pro Auftrag** – der Kunde bekommt aus AlixWork einen personalisierten Link. Passt zur bestehenden Customer-Portal-Struktur.

3. **Neue Rolle „Mediapaket-Mitarbeiter"**  
   Soll ich eine neue Rolle `Mediapaket` in `user_roles` anlegen, oder reichen bestehende Rollen (`Order`, `Super Admin`, `Admin`)? Nach der Rollen-Memory würde ich `Mediapaket` als eigene, enge Rolle ergänzen (nur Mediapaket-Modul + Auftragsreiter lesend).

4. **Ausbaustufe für Start**  
   Der Prompt umfasst ~20 neue Tabellen, Wizard mit 13 Schritten, PDF-Export, Storage, Migration, Admin-Konfigurator, Übersichtsseite, Benachrichtigungen. Realistisch sind das mehrere Arbeitstage. Soll ich:  
   a) **Alles nach Plan** in 6 Phasen umsetzen (empfohlen, größerer Credits-Verbrauch), oder  
   b) einen **MVP** (Phasen 1–4 ohne PDF, ohne Admin-Konfigurator, ohne Alt-Import) zuerst, danach Ausbau?

---

## Umsetzungsplan (6 Phasen)

### Phase 1 – Datenbank & Storage-Fundament
- Neue Tabellen (alle unter `public`, mit GRANTs + RLS + Audit-Trigger):  
  `media_packages`, `media_package_services`, `media_package_studio_data`, `media_package_devices`, `media_package_prices`, `media_package_contact_data`, `media_package_opening_hours`, `media_package_treatments`, `media_package_team_members`, `media_package_branding`, `media_package_files`, `media_package_consents`, `media_package_history`, `media_package_comments`.
- Fremdschlüssel: `customer_id → customers`, `order_id → orders`, `device_id → lager_devices`, `assigned_user_id → user_profiles`.
- Neuer Enum `media_package_status` (Noch nicht begonnen / In Bearbeitung / Rückfrage / Eingereicht / In Prüfung / In Umsetzung / Korrektur / Freigabe ausstehend / Abgeschlossen).
- Neue Rolle `Mediapaket` in `app_role` (falls Rückfrage 3 = ja).
- Storage-Bucket `mediapaket-files` (privat), Struktur `customers/{cid}/orders/{oid}/media-package/{mpid}/{category}/{version}/{filename}`.
- RLS: Kunde nur eigene (`customer_id` via Portal-Token oder Auth), Mitarbeiter je nach Rolle, Super Admin alles.
- Trigger für `updated_at`, Audit-Trigger auf allen Tabellen → `media_package_history`.

### Phase 2 – Kundenformular (Wizard)
- Route `/book/mediapaket` (integriert in bestehendes BookingLayout, gleiches Design).
- Kachel auf `/book` „Mein Media Paket" mit Live-Statusanzeige (Fortschritt, letzte Bearbeitung, offene Rückfragen).
- Kundenerkennung via Customer-Portal-Session bzw. Magic-Link-Token → Auftragsauswahl bei mehreren Aufträgen.
- Wizard mit 13 Schritten (siehe Prompt Kap. 6–18), Auto-Save nach jedem Feld/Blur, Prozent-Fortschritt.
- Upload-Komponente mit MIME-/Größenprüfung, Vorschau, Versionierung.
- Zusammenfassung + verbindliches Absenden (setzt Status `Vollständig eingereicht`, erzeugt immutable Snapshot in `media_package_history`).
- Vollständig responsiv (Mobile-first).

### Phase 3 – Auftragsreiter „Mediapaket"
- Neuer Tab in bestehender Auftragsdetailseite (parallel zu existierenden Reitern).
- Kopfbereich, Aktionsleiste (Öffnen, Bearbeiten, Kundenlink kopieren, Rückfrage, Mitarbeiter zuweisen, Status ändern, Download, Historie, Freigabe anfordern, Abschließen).
- Interne Sub-Bereiche: Übersicht, Webseite, Flyer, Social Media, Studiodaten, Preise, Texte, Dateien, Rückfragen, Aufgaben, Freigaben, Historie.
- Rückfrage-Panel → schreibt in `media_package_comments`, benachrichtigt Kunde via bestehendes Notification-System.

### Phase 4 – Mediapaket-Übersicht & Rollen
- Neue Route `/mediapaket` mit Tabelle aller Mediapakete, Filter, Suche, Bulk-Aktionen.
- Sidebar-Eintrag nur für Rollen `Mediapaket`, `Admin`, `Super Admin`, `Order`.
- Kanban-optional (Status-Spalten).

### Phase 5 – Admin-Konfigurator & PDF
- Route `/mediapaket/admin` (Super Admin): Feldkonfiguration, Pflichtfelder, Hilfetexte, Leistungen, Status, Fristen, Einwilligungstexte, E-Mail-Vorlagen, Dateigrößen.
- PDF-Export via Edge Function `mediapaket-pdf` (React-PDF / pdf-lib) im AlixWork-Design.
- Einwilligungs-Versionierung.

### Phase 6 – Altdaten-Import
- Edge Function `mediapaket-import` mit Vorschau, Matching-Reihenfolge (Auftrag → E-Mail → Kundennr → Name → Studio → Telefon → Gerät → manuell), idempotent.
- Import-UI unter `/mediapaket/admin/import`.
- Dublettenprüfung, Fehlerprotokoll, Wiederholbarkeit.

---

## Technische Details

- **Frontend:** React 18 + Vite, bestehende shadcn/ui-Komponenten, Tailwind-Tokens aus `index.css`. Kein neues Design-System.
- **State:** React Hook Form + Zod pro Wizard-Schritt, Auto-Save via `useEffect` + debounced Supabase-Upsert.
- **Storage:** Supabase Storage privat, signierte URLs (1h) für Downloads, MIME-Whitelist serverseitig geprüft.
- **RLS-Muster:** Security-Definer-Function `public.can_access_media_package(_mp_id uuid)` → verhindert Rekursion; Policies referenzieren nur diese Function.
- **Audit:** Generischer Trigger `public.log_media_package_change()` schreibt bei UPDATE/INSERT/DELETE in `media_package_history` (field-level diff via `hstore`).
- **Benachrichtigungen:** Wiederverwendung von `mail_internal_messages` + `customer_communication_log` (bestehend), keine neue Architektur.
- **Kunden-Login `/book`:** Wiederverwendung von `customer_portal_users` + `customer-portal-lookup` Edge Function, Erweiterung um Magic-Link für Mediapaket.
- **Fortschrittsberechnung:** Serverseitige Function `public.calc_media_package_progress(_mp_id uuid)` – Gewichtung wie in Prompt Kap. 30, überspringt nicht ausgewählte Leistungen.
- **Keine Breaking Changes:** Keine Änderungen an `customers`, `orders`, `lager_devices`, `user_roles`-Policies, `esc_*`-Tabellen.

---

**Bitte beantworte die 4 Rückfragen oben, dann starte ich mit Phase 1 (Datenbank + Storage) als erste Migration.**

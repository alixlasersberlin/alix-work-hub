# After Sales Management 2.0 für AlixWork

Großer, eigenständiger CRM-Bereich – additiv, **ohne Eingriff in bestehende Module**. Wegen Umfang in 4 Phasen liefern, jede Phase ist nutzbar.

## Architektur-Prinzipien

- Neuer Top-Menüpunkt **CRM** mit Submenü: Interessenten, Angebote, Aufträge, Kunden, Geräte, **After Sales** (bestehende Routen werden nur unter CRM neu gruppiert verlinkt, **nicht** verändert).
- Eigene Tabellen mit `as_`-Prefix, eigene RLS-Policies, keine Änderungen an `orders`, `customers`, `lager_devices` etc.
- Auto-Erstellung der Fälle via DB-Trigger auf `orders.status` (idempotent, ein Fall pro Auftrag).
- Aurora-Design, vollständig responsive, Wiederverwendung von `infinity/`-Komponenten (PageHeader, KpiTile, InfinityTable, StatusBadge).
- Rollen: Super Admin, Admin, Sales, **After Sales** (neu), Marketing, Service, Geschäftsleitung. Neue Rolle wird `app_role`-Enum hinzugefügt.

## Phase 1 – Fundament & Auto-Fall-Erstellung (diese Iteration)

**DB-Migration**
- Enum `as_case_status` (open, in_progress, waiting_customer, blocked, completed).
- Enum `as_priority` (low, normal, high, urgent).
- Enum `as_traffic_light` (green, yellow, red).
- Tabelle `as_cases`: order_id (uniq), customer_id, device_id, assignee_id, sales_user_id, status, priority, traffic_light, progress_pct, health_score, last_contact_at, next_callback_at, satisfaction_rating, satisfaction_note, closed_at, closed_by, metadata jsonb.
- Tabelle `as_checklist_items`: case_id, section (enum: erstkontakt, geraet, nisv, app, mediapaket, schulung, marketing, zufriedenheit, rueckruf, upselling), key, label, checked, checked_at, checked_by, note.
- Tabelle `as_mediapaket_status`: case_id (uniq), stage enum (not_started…abgeschlossen), updated_at.
- Tabelle `as_timeline_events`: case_id, event_type, title, body, source (system/user/integration), created_by, created_at.
- Tabelle `as_callbacks`: case_id, due_at, priority, reason, done_at, done_by.
- Tabelle `as_reminders`: case_id, kind (login, app, nisv, schulung, mediapaket, callback), scheduled_at, sent_at, channel (dashboard, email, sms, push).
- Tabelle `as_upsell_suggestions`: case_id, product_key, label, accepted, offer_id.
- Enum `app_role` erweitern um `After Sales`.
- GRANTs für alle Tabellen (authenticated CRUD, service_role ALL).
- RLS: lesen alle internen Rollen oben; schreiben nur eigene Rolle + Admin/Super Admin.
- Trigger `as_create_case_on_order_status()`: Bei orders.status IN (bestätigt, anzahlung_bezahlt, produktion_gestartet, ausgeliefert, abgeschlossen) und kein Fall existiert → `as_cases` + Default-Checklisten + Timeline-Event "Fall automatisch erstellt".
- Backfill-Insert für existierende Aufträge in diesen Status.
- Cron: `as-daily-reminders` 06:00 UTC (Edge Function, schreibt Reminder + setzt Ampel).

**Frontend**
- Route `/crm` – Layout mit Sub-Nav (Links auf bestehende Seiten + neue After-Sales-Seiten).
- Route `/crm/after-sales` – Dashboard (KPI-Kacheln + Filter + InfinityTable aller offenen Fälle mit allen geforderten Spalten + Ampel).
- Route `/crm/after-sales/erledigt` – abgeschlossene Fälle.
- Route `/crm/after-sales/:id` – After-Sales-Akte:
  - Header (Kunde, Gerät, Garantie, Servicevertrag, Ansprechpartner)
  - Tabs: Checkliste (große Sections mit Checkboxen), Mediapaket (Stage-Selector), Schulung/Marketing/Zufriedenheit, Upselling, Timeline, Rückrufe, Dokumente (Link auf Kundenakte).
  - Fortschritt %, Ampel, Health-Score, "Fall abschließen"-Button (server-validiert).
- Hook `useAsCases`, `useAsCase(id)`.
- Reuse: `PageHeader`, `KpiTile`, `InfinityTable`, `StatusBadge`.

**Edge Functions**
- `as-daily-reminders` – tägliche Erinnerungen + Ampel-Neuberechnung.
- `as-close-case` – Validiert Abschluss-Bedingungen serverseitig.

## Phase 2 – Workflows & Kommunikation

- Edge Functions: `as-send-email-reminder`, `as-send-sms-reminder` (Twilio bestehend), Push via bestehender PWA.
- Workflows: App-fehlt (3 Tage), NiSV-fehlt, Schulung-fehlt → Kalender-Vorschlag, Mediapaket-offen → Marketing, Rückruf überfällig → Chef.
- Integration mit bestehenden `email_templates`, `sms_templates`, `mail_*`-System.

## Phase 3 – KI (AI-Service-Copilot Integration)

- `as-ai-suggest` Edge Function: nutzt Lovable AI Gateway (`google/gemini-3-flash-preview`).
- Liefert: Health Score (0–100), nächster Kontaktzeitpunkt, Risiko-Score, Upselling-Vorschläge, Mail/SMS-Drafts, Gesprächs-Zusammenfassung.
- UI: KI-Panel in der Akte (analog `AiAnalysisPanel`).

## Phase 4 – Reporting & Premium-Charts

- KPIs erweitert: After-Sales-Quote, Ø Bearbeitungszeit, NPS.
- Charts (recharts) im Dashboard.
- Export CSV.

## Technische Details

- Keine Änderungen an: `orders`, `customers`, `lager_devices`, Sales-Wizard, bestehende Routen.
- Neue Rolle `After Sales` wird in `role-labels.ts`, `has_role`-Aufrufen und `AuroraTopNav` ergänzt.
- TenantContext wird respektiert (alle Queries filtern `tenant_id` analog zu bestehenden Tabellen).
- Trigger ist idempotent (`ON CONFLICT (order_id) DO NOTHING`).
- Mobile-Layout über bestehende Tailwind-Breakpoints + `useIsMobile`.

## Was Phase 1 liefert (sofort sichtbar)

1. Menüpunkt CRM → After Sales
2. Automatische Fall-Erstellung + Backfill
3. Dashboard mit KPIs + Tabelle + Ampel
4. Akte mit kompletter Checkliste, Mediapaket, Timeline, Rückrufen, Abschluss-Button
5. Tägliche Ampel-/Erinnerungs-Berechnung via Cron

Bitte Phase 1 freigeben, dann lege ich los. Phasen 2–4 folgen jeweils auf Zuruf.

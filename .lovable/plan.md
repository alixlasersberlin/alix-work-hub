
# AlixWork Enterprise 2.0 – Umsetzungsplan (Phasen 14–17)

Streng additiv. Keine bestehenden Tabellen, Rollen, RLS-Policies, Edge Functions oder Module werden verändert oder gelöscht. Vor jeder neuen Tabelle wird das vorhandene Schema (orders, customers, lager_devices, tickets, repair_orders, route_plans, dispatch_*, bugs, capas, audit_findings, capa_actions, user_roles, roles, source_system) wiederverwendet.

---

## Bestandsaufnahme (wird wiederverwendet, NICHT verändert)

- **Mandantenkennung**: `source_system` (zoho_eu_1=DE, zoho_eu_2=AT) ist auf orders, customers, items bereits gesetzt. Wird als Basis für Multi-Mandant erweitert (additive Werte, keine Schemaänderung).
- **Rollen**: Super Admin, Admin, Order, Technik, Reparaturannahme, Tourenplanung, Finance, Österreich, QM, …
- **Tourenplanung**: `route_plans`, `dispatch_vehicles`, `dispatch_attachments`, `dispatch_used_parts`, `technician_skills`, ServiceReport-PDF.
- **QM**: `bugs`, `capas`, `audit_findings`, `capa_actions` (Modul /bug-capa, Rolle QM).
- **Reparatur/Service**: `repair_orders`, `repair_spare_parts`, `lager_devices`, Storage-Bucket `repair-files`.
- **AI/Edge Functions**: Lovable AI Gateway (`LOVABLE_API_KEY`), bestehende Funktionen für Mail, Ticket-Sync, Backup.
- **Auth**: Supabase Auth + MFA + Turnstile.

---

## Phase 14 – Mobile Techniker-App (PWA + Capacitor-ready)

**Strategie**: Web-basierte responsive Techniker-Oberfläche unter `/m` mit installierbarer PWA (manifest + Service Worker für Offline). Capacitor optional als zweiter Schritt (Export to GitHub nötig).

**Neue Seiten** (alle unter `/m`, eigenes Layout, Touch-optimiert):
- `/m` – Tagesübersicht eigener Einsätze
- `/m/einsatz/:id` – Einsatzakte (Kunde, Gerät, Ticket, Reparatur, Wartung, Garantie)
- `/m/einsatz/:id/fotos` – Foto-Upload (vorher/nachher/Schaden/Ersatzteil/Installation) mit Kamera
- `/m/einsatz/:id/signatur` – Canvas-Signatur Kunde + Techniker
- `/m/einsatz/:id/checkliste` – dynamische Checklisten (Wartung/Reparatur/Installation/MDR)
- `/m/einsatz/:id/bericht` – PDF aus Servicebericht-Generator
- `/m/sync` – Sync-Status, Konflikte

**Offline-Layer**: IndexedDB via `idb`, Outbox-Pattern. Sync-Worker pollt online → POST in bestehende Tabellen (`route_plans`, `dispatch_attachments`, neuer `dispatch_checklists`).

**Neue Tabellen (additiv)**:
- `dispatch_checklists` (templates, JSON-Items)
- `dispatch_checklist_runs` (route_plan_id, antworten, signaturen-pfade)
- `dispatch_signatures` (route_plan_id, role customer|technician, storage_path, signed_at, signer_name)
- `mobile_sync_outbox` (user_id, payload, status, attempts) – nur für Server-seitiges Replay über Edge Function

**Storage-Bucket**: `dispatch-mobile` (privat) für Fotos/Signaturen.

**Push**: Web Push via VAPID + Edge Function `mobile-push-send`. Neue Tabelle `mobile_push_subscriptions`.

**Keine neuen Rollen** – nutzt Technik/Tourenplanung.

---

## Phase 15 – Multi-Mandantenfähigkeit

**Mandanten**: Alix Germany, Alix Austria, Alix USA, Alix Medical, Alix Dubai.

**Strategie**: `source_system` bleibt führend für Zoho-Daten. Zusätzlich neue Tenant-Schicht für nicht-Zoho-Datensätze und einheitliche Konzernsicht.

**Neue Tabellen**:
- `tenants` (code, name, country, currency, flag_emoji, zoho_source_system nullable, is_active)
- `user_tenant_access` (user_id, tenant_id, role_scope) – additive Erlaubnisliste; bestehende Rollen bleiben global.
- `tenant_mapping_source_system` (source_system → tenant_id) – Mapping ohne DB-Migration der Datentabellen.

**RLS-Erweiterung (additiv)**:
- Neue SECURITY-DEFINER Funktion `user_has_tenant(tenant_id)` und `tenant_for_source(source_system)`.
- Neue Policies nur auf neuen Tabellen. Bestehende Tabellen unverändert.
- Filter erfolgt UI-seitig + in neuen Views (`v_orders_by_tenant`, `v_devices_by_tenant`, `v_tickets_by_tenant`, …), die `source_system → tenant_id` auflösen.

**Neue Seiten**:
- `/mandanten` (Super Admin) – Verwaltung
- `/mandanten/:code/dashboard` – Umsatz, Lager, Tickets, Geräte, Servicekennzahlen je Mandant
- `/konzern/dashboard` – Gesamtsicht GF (KPIs aggregiert)

**Neuer TenantContext** (`src/contexts/TenantContext.tsx`) + Header-Switcher in `AppLayout`. Default = alle Mandanten, Rolle Österreich bleibt auf AT festgepinnt (bestehende Logik).

**Seed**:
- DE → zoho_eu_1
- AT → zoho_eu_2
- USA, Medical, Dubai → keine Zoho-Quelle, eigene Datenerfassung

---

## Phase 16 – ISO 13485 / MDR Audit Center

Baut auf bestehendem `/bug-capa` auf (Rolle QM), erweitert um Audit, Schulung, Lieferantenbewertung, Change, Vigilanz.

**Neue Seiten** unter `/qm`:
- `/qm/capa/dashboard` – Status/Wirksamkeit/Fristen (nutzt bestehende `capas`, `capa_actions`)
- `/qm/audits` – Planung, Kalender, Berichte, Maßnahmen
- `/qm/schulungen` – Mitarbeiter, Schulungen, Zertifikate, Reminder
- `/qm/lieferanten` – Bewertung, Auditstatus, Reklamationen, Risikoklasse (verlinkt `suppliers`)
- `/qm/change` – Change Requests, Freigaben, Historie
- `/qm/vigilanz` – Beschwerden, Vorkommnisse, Behördenmeldungen, Trendanalysen

**Neue Tabellen**:
- `qm_audits` (typ intern|extern|lieferant, scope, datum, auditor, status, bericht_pfad)
- `qm_audit_actions` (audit_id → bestehende `capa_actions`-ähnliche Struktur)
- `qm_audit_calendar_entries`
- `qm_trainings` (titel, pflicht, gueltigkeit_monate)
- `qm_training_assignments` (training_id, user_id, abgeschlossen_am, zertifikat_pfad, faellig_am)
- `qm_supplier_assessments` (supplier_id, periode, score, risikoklasse, audit_id)
- `qm_change_requests` (titel, beschreibung, antragsteller, status, freigaben jsonb)
- `qm_change_approvals`
- `qm_vigilance_reports` (typ beschwerde|vorkommnis|vigilanz, geraet_id, kunde_id, behoerdenmeldung bool, meldedatum, status)

**Storage**: Bucket `qm-files` (privat).

**Rolle**: bestehende `QM` wird auf alle neuen Seiten ausgedehnt. Super Admin Vollzugriff.

**Reminder/Trendanalyse**: Edge Functions `qm-training-reminder` (Cron täglich), `qm-vigilance-trends` (Cron wöchentlich → Mail an QM).

---

## Phase 17 – AI 2.0 (Lovable AI Gateway)

Modell-Default: `google/gemini-3-flash-preview`. Alle Modellaufrufe in Edge Functions, `LOVABLE_API_KEY` server-side.

**Neue Edge Functions**:
- `ai-predictive-failures` – analysiert `repair_orders` + `lager_devices` + Garantie → Risikoscore je Serie/Gerät/Kunde
- `ai-service-planner` – schlägt Wartungstouren + Techniker-Zuordnung vor (verwendet `route_plans`, `technician_skills`, `dispatch_vehicles`)
- `ai-spareparts-forecast` – Bestellvorschläge auf Basis `repair_spare_parts`, Verbrauchshistorie
- `ai-management-reports` – täglich/wöchentlich/monatlich (Cron); Versand per Resend an GF/Service/Finance
- `ai-executive-forecast` – Prognosen Umsatz/Service/Garantie/Lager

**Neue Tabellen**:
- `ai_predictions` (typ, ziel_typ, ziel_id, score, payload jsonb, valid_until)
- `ai_recommendations` (typ, status offen|akzeptiert|verworfen, payload, created_by_function, accepted_by, accepted_at)
- `ai_report_runs` (typ, period, status, pdf_pfad, sent_to[])

**Neue Seiten**:
- `/ai/executive` – Executive Dashboard mit Prognosen
- `/ai/recommendations` – Inbox für Service-, Touren-, Ersatzteil-Vorschläge (akzeptieren/verwerfen → schreibt in bestehende Module)
- `/ai/reports` – Liste generierter Reports

**Cron**: pg_cron Jobs werden über supabase--insert (nicht migration) eingerichtet, damit Anon-Key/URL nicht in Migration landet.

---

## Umsetzungsreihenfolge

1. **Phase 15** zuerst (Mandanten + TenantContext) – Basis für 14/16/17.
2. **Phase 14** Mobile App (nutzt Mandantenfilter).
3. **Phase 16** QM-Erweiterung.
4. **Phase 17** AI 2.0 zuletzt (braucht Daten aus 14–16).

Jede Phase wird als eigenständiger PR-äquivalenter Schritt geliefert: Migration (mit GRANTs) → Edge Functions → Frontend → Sidebar/Routes → Memory-Update.

---

## Aufwandsschätzung (grob)

| Phase | Migrationen | Edge Fns | Seiten | Aufwand |
|---|---|---|---|---|
| 15 Multi-Mandant | 1 | 0 | 3 | M |
| 14 Mobile/PWA | 2 | 2 | 7 | L |
| 16 QM-Erweiterung | 2 | 2 | 6 | L |
| 17 AI 2.0 | 1 | 5 | 3 | L |

---

## Risiken

- **RLS-Komplexität** bei Mandantenfilter – bewusst über Views statt Tabellenänderung gelöst.
- **PWA in Lovable-Preview**: Service Worker nur in Produktion registrieren (Preview-Guard).
- **AI-Kosten**: Cron-Frequenz konservativ (täglich), Prompts kompakt.
- **Offline-Konflikte**: Outbox + `updated_at`-Check; Konflikt-Seite `/m/sync`.

## Produktivstatus je Phase
- Phase 15: produktiv nach Mandanten-Seed.
- Phase 14: produktiv als PWA; Capacitor optional.
- Phase 16: produktiv mit Rolle QM.
- Phase 17: produktiv, Vorschläge erst nach Akzeptanz wirksam.

---

## Klärungsfragen vor Start

1. **Mandanten USA/Medical/Dubai** – ohne Zoho-Quelle: sollen Kunden/Aufträge dort manuell erfasst werden, oder sind weitere Zoho-Orgs / andere ERP-Quellen geplant?
2. **Mobile App** – reicht PWA (sofort lauffähig, Kamera/Push via Web-APIs) oder zwingend native Capacitor-App (Export zu GitHub + Xcode/Android Studio erforderlich)?
3. **AI-Cron-Frequenz** – täglich um wieviel Uhr (UTC) für Management-Reports? Empfänger-Mailadressen je Report-Typ?
4. **Reihenfolge** – mit Phase 15 (Multi-Mandant) starten wie vorgeschlagen, oder eine andere Phase priorisieren?

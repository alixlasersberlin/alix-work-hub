---
name: Kundenportal Delivery Journey
description: Animierter Lieferstatus unter /portal/status, Tabellen order_delivery_status/_events, Admin-Tab "Lieferstatus (Portal)", E-Mail-Trigger delivery-notify
type: feature
---

- Öffentliches Portal `/portal` → `/portal/status` zeigt eine animierte Delivery Journey (Hero mit Liefertermin, Timeline, Geräteanimation, Freigaben, Tour, Historie).
- Payload kommt aus Edge Function `customer-portal-lookup` (Feld `delivery`), Ableitungslogik in `supabase/functions/_shared/delivery-journey.ts`.
- Phasen: order_received → order_check → production_planned → in_production → qc → provisioning → tour_planning → out_for_delivery → delivered. `phase = 'auto'` ⇒ automatische Ableitung aus production_orders, delivery_approvals, delivery_appointments, delivery_tours.
- Tabellen: `order_delivery_status` (1 Zeile/Auftrag, Overrides + Produktions-/Prüfschritte als JSONB) und `order_delivery_events` (Historie, `visible_to_customer`). DB-Trigger schreibt Historieneintrag bei Phasen-/ETA-/Verzögerungswechsel.
- Admin: Auftrag → Menü "Auftrag" → Tab **Lieferstatus (Portal)** (`?tab=lieferstatus`), Komponente `src/components/delivery/OrderDeliveryStatusPanel.tsx`.
- **E-Mail-Trigger (Phase 2)**: Edge Function `delivery-notify` sendet Kundeninfo bei Phasenwechsel (automatisch beim Speichern, wenn `notify_customer` aktiv) oder manuell über "Kunde benachrichtigen". Vorlagen pro Phase admin-editierbar in `app_settings.key = 'delivery_journey_mail_templates'` (Dialog `DeliveryMailTemplatesDialog.tsx`), Platzhalter: kunde, auftragsnummer, phase, termin, grund, hinweis.
- **Portal "NEU"-Badge**: Historieneinträge neuer als der letzte Portalbesuch (localStorage `dj-seen-<auftragsnummer>`) werden mit NEU markiert; Zähler am Button "Lieferhistorie".
- Regeln: interne Kommentare (`delay_reason_internal`) nie im Portal ausgeben; Fortschritt nur aus echten Schritten (kein Fake-Prozent); nie "null"/"kein Datum" zeigen, stattdessen "Liefertermin wird geplant".
- Frontend-Komponenten: `src/components/portal/delivery/DeliveryJourney.tsx`, `DeviceAssembly.tsx`, CSS `src/styles/delivery-journey.css` (reduced-motion respektiert).
- **Phase 3**: Kundenbestätigung des Liefertermins im Portal (`DeliveryConfirm.tsx` + Edge Function `portal-delivery-confirm`, verifiziert Auftragsnr+PLZ+E-Mail) schreibt `customer_response`/`customer_responded_at`/`customer_alternative_date`/`customer_response_note` in `order_delivery_status`; Bestätigung setzt `eta_confirmed = true`.
- Phase 3: optionaler **SMS-Versand** in `delivery-notify` über Twilio (`notify_sms` + `notify_phone` in `order_delivery_status`).
- Phase 3: Admin-Cockpit **/dispatch/lieferstatus** (`src/pages/Dispatch/Lieferstatus.tsx`, Menü ALIX DISPATCH CENTER) mit KPI-Kacheln (gesamt, verzögert, Termin unbestätigt, Terminwunsch Kunde), Suche, Phasenfilter und Sprung in den Auftrags-Tab.
- **Standardbelegung**: DB-Trigger `trg_ods_default_on_order_insert` auf `orders` ruft `ods_default_row()` und legt für jeden neuen Auftrag automatisch `order_delivery_status` an: `eta_planned = Auftragsdatum + 3 Monate`, `eta_earliest/-latest = ±14 Tage`, `production_end_planned = ETA-21 Tage`, Zeitfenster 08:00–16:00, Standard-Produktions-/QC-Schritte (pending), `phase='auto'`, `eta_state='forecast'`, `traffic_light='gruen'`, `confirm_due_date = ETA-14 Tage`, Kundenhinweis-Text. Bestehende Aufträge wurden nachbefüllt (nur leere Felder).
- Liefertermin-Quelle: `orders.expected_shipment_date` hat Vorrang (Trigger `trg_ods_order_eta_change` übernimmt Änderungen sofort); nur wenn leer, greift die 3-Monats-Standardplanung.

---
name: Kundenportal Delivery Journey
description: Animierter Lieferstatus unter /portal/status, Tabellen order_delivery_status/_events, Admin-Tab "Lieferstatus (Portal)" im Auftrag
type: feature
---

- Öffentliches Portal `/portal` → `/portal/status` zeigt eine animierte Delivery Journey (Hero mit Liefertermin, Timeline, Geräteanimation, Freigaben, Tour, Historie).
- Payload kommt aus Edge Function `customer-portal-lookup` (Feld `delivery`), Ableitungslogik in `supabase/functions/_shared/delivery-journey.ts`.
- Phasen: order_received → order_check → production_planned → in_production → qc → provisioning → tour_planning → out_for_delivery → delivered. `phase = 'auto'` ⇒ automatische Ableitung aus production_orders, delivery_approvals, delivery_appointments, delivery_tours.
- Tabellen: `order_delivery_status` (1 Zeile/Auftrag, Overrides + Produktions-/Prüfschritte als JSONB) und `order_delivery_events` (Historie, `visible_to_customer`). DB-Trigger schreibt Historieneintrag bei Phasen-/ETA-/Verzögerungswechsel.
- Admin: Auftrag → Menü "Auftrag" → Tab **Lieferstatus (Portal)** (`?tab=lieferstatus`), Komponente `src/components/delivery/OrderDeliveryStatusPanel.tsx`.
- Regeln: interne Kommentare (`delay_reason_internal`) nie im Portal ausgeben; Fortschritt nur aus echten Schritten (kein Fake-Prozent); nie "null"/"kein Datum" zeigen, stattdessen "Liefertermin wird geplant".
- Frontend-Komponenten: `src/components/portal/delivery/DeliveryJourney.tsx`, `DeviceAssembly.tsx`, CSS `src/styles/delivery-journey.css` (reduced-motion respektiert).

---
name: ALIX CONNECT Phase 43
description: Realtime Collaboration — Multi-Agent Co-Notes, Presence, Live-Handover mit Kontext
type: feature
---
- Route `/connect/realtime-collab` (Admin/Super Admin only, ProtectedRoute).
- Supabase Realtime Channel `ac-collab:<room>` — Presence (Track per user) + Broadcast Events `note` & `handover`.
- Kein neues Table: rein transient über Realtime.
- Edge Function `ac-realtime-collab` (verify_jwt Standard): action `handover_context` liefert 360° JSON aus customers/orders/tickets via Service Role, RBAC-Check gegen has_role.
- UI: Raum-Join, Presence-Liste, Live-Notes, Handover-Kontext-Loader (Kunden-/Auftrags-ID) + Broadcast an Raum.
- Nav-Eintrag „Realtime Collab" in Intelligence-Gruppe des Connect-Layouts.

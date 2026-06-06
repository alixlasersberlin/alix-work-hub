---
name: Ersatzteil-Bestellvorschläge
description: Techniker erzeugen aus Reparaturaufträgen Bestellvorschläge für das Bestellwesen (Rolle Bestellwesen)
type: feature
---
- Button "Ersatzteil benötigt" im Header von /reparatur/:id (Komponente `src/pages/Reparatur/SparePartRequestDialog.tsx`).
- Schreibt in bestehende Tabelle `repair_spare_parts` mit Status `Bestellvorschlag`. Neue Spalten: `priority`, `device_label`, `serial_number`, `ticket_id`, `ticket_number`, `requested_by`, `requested_at`.
- Übernimmt Gerät, Seriennummer, Reparaturnummer und (sofern verknüpft) Ticket-Nummer/-ID.
- Benachrichtigung an Einkauf via `mail_internal_messages` (recipient_department='einkauf'); Fehler werden geschluckt.
- Bestellwesen-Übersicht unter `/bestellwesen/ersatzteile` (Sidebar BESTELLWESEN → "Ersatzteil-Bestellvorschläge") für Rollen Admin, Super Admin, Bestellwesen, Order, Technik. Status-Updates dort wirken durch dieselbe Tabelle direkt im Reparatur-Tab "Bestellungen".
- Zusätzliche RLS-Policies: `repair_spare_parts bestellwesen select/update` für Rolle "Bestellwesen".

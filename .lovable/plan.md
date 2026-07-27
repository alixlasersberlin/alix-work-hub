# ALIX Audit Center — 5-Phasen-Plan

Neues Modul unter `/audit-center`, Menüpunkt in **OPERATIONS**, ausschließlich **Super Admin**. 24 Monate Aufbewahrung, volle Erfassung (Geo, Device-Fingerprint, Maus/Tastatur-Zähler), Write-Once/Read-Many, revisionssicher.

DSGVO-Hinweis: Vor Go-Live muss ein Info-Text im Login + Betriebsvereinbarung erfolgen. Das Tracking wird per Feature-Flag scharf geschaltet.

---

## Phase 1 — Fundament (Erfassung)

**Tabellen (WORM, RLS: nur Super Admin SELECT, keine UPDATE/DELETE außer Retention-Job)**
- `audit_sessions` — Login/Logout, Session-Dauer, Idle-Zeit, aktive Zeit
- `audit_devices` — Device-Fingerprint (UA, OS, Auflösung, Sprache, TZ, Device-ID Cookie)
- `audit_geo` — IPv4/IPv6, ASN, Provider, Land/Stadt, VPN/Proxy/TOR-Flags, GPS (opt.)
- `audit_actions` — sekundengenaue Timeline: user_id, ts, module, action, object_type, object_id, duration_ms, meta
- `audit_changes` — Alt/Neu-Diffs: table, record_id, field, old_value, new_value, user_id, ts
- `audit_access_log` — jede Einsicht ins Audit Center wird selbst geloggt

**Edge Functions**
- `audit-session-start` — schreibt Session inkl. Geo-Lookup (ipapi/ipinfo)
- `audit-session-heartbeat` — jede 30s Idle/Active-Tracking
- `audit-session-end` — Logout/Beacon
- `audit-track` — Batch-Endpoint für Frontend-Actions

**Frontend**
- `useAuditTracker()` Hook — hookt in Router, klick/scroll/keyboard-Zähler, Tab-Focus
- Globaler DB-Trigger `audit_trigger_fn` (existiert bereits!) auf relevante Tabellen erweitern für Alt/Neu-Diffs

## Phase 2 — Kunden-, Dokument- & KI-Protokoll

- `audit_customer_touches` — wer öffnete welchen Kunden, wie lange, was geändert
- `audit_document_events` — PDF geöffnet/gedruckt/geladen/gelöscht/signiert
- `audit_ai_usage` — Modell, Prompt-Hash, Tokens, Kosten, Ergebnis übernommen ja/nein
- Integration in `OrderDetail.tsx`, `AlixDocs2Detail`, `AiCenter.tsx`

## Phase 3 — Sicherheitscenter

- `audit_security_alerts` — Regel-Engine (Cron alle 5 min):
  - Mehrfachlogin, neues Gerät, Login Ausland, VPN, Nachtarbeit, ≥5 Fehlversuche, Massen-Export, Massen-Änderung
- Alert-Feed + E-Mail an Super Admin bei Severity ≥ warn

## Phase 4 — Management Dashboard + Live Monitor

Neue Seiten unter `/audit-center`:
- `Overview.tsx` — KPIs (online/aktiv/Pause/offline), Produktivität heute, Stunden-Heatmap
- `LiveMonitor.tsx` — Leitstand-Ansicht, Realtime via Supabase Channel `audit_presence`
- `Employee.tsx` — Profil je Mitarbeiter: Arbeitszeit, Top-Module, Top-Kunden, Ø-Bearbeitungszeit
- `Timeline.tsx` — sekundengenaue Timeline (filterbar), Export PDF/Excel/CSV
- `Changes.tsx` — Alt/Neu-Diff-Browser
- `Security.tsx` — Alert-Feed
- `Reports.tsx` — Tages/Wochen/Monats/Jahresreports

## Phase 5 — UPS (Ultimate Productivity Score)

- Nightly Cron `ups-calculate` (03:00 UTC):
  - Berechnet 0-100 Score pro Mitarbeiter/Tag aus:
    Arbeitszeit vs. Produktivzeit, erledigte Aufgaben, Reaktionszeiten, Kundenkontakte, Ticket-Durchlauf, Angebote/Rechnungen, Serviceeinsätze, Doku-Qualität, KI-Nutzung, Termintreue
- `audit_ups_scores` (user_id, date, score, breakdown_json, trend_pct)
- Dashboard-Widget mit Vergleichen (Vortag/Vorwoche/Vormonat) und KI-Erkennung von Verbesserungspotenzialen (Gemini via Lovable AI)

---

## Compliance & Technik

- **RLS**: Alle Tabellen nur Super Admin SELECT via `has_role(auth.uid(),'Super Admin')`; INSERT nur via Edge Function mit Service Role; UPDATE/DELETE **generell verboten** außer Retention-Job.
- **Retention**: Cron `audit-retention` (täglich 04:00 UTC) anonymisiert Datensätze > 24 Monate (IP/UA → NULL, Content-Hash bleibt).
- **Verschlüsselung**: `pgcrypto` für IP-Adressen und Device-IDs at rest.
- **Menü**: Neuer Eintrag "Audit Center" in `AppLayout.tsx` unter OPERATIONS, sichtbar nur bei `Super Admin`.
- **Rate Limits**: `audit-track` gedrosselt auf 100 req/min/user.

## Reihenfolge der Umsetzung

Phase 1 in dieser Session (Tabellen + Edge Functions + Tracker-Hook + minimales `/audit-center` Overview mit Session-Liste).
Phasen 2-5 in Folge-Prompts, jeweils klar abgegrenzt.

## Was ich **nicht** anfasse

- Bestehendes `audit_logs` bleibt unverändert (wird zusätzlich in `audit_actions` gespiegelt).
- Kein Umbau bestehender Module — Tracker hookt sich nur ein.

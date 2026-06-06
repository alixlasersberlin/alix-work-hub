## AI Service Assistent

Neues, **rein additives** Modul. Bestehende Tabellen, Edge Functions und Komponenten werden nicht verändert — nur ergänzt.

### 1. Datenbank (neu)

Vier neue Tabellen + RLS + Indizes:

- **`service_knowledge_base`** – Wissensquelle (Gerätetyp, Fehlercode, Symptom, Ursache, Lösung, Ersatzteile JSONB, Arbeitszeit Min/Erwartet/Max, Quelle/Tags).
- **`service_ai_analyses`** – Cache aller AI-Analysen pro Ticket/Reparatur (Ursache, Confidence, Prüfungsschritte, Reparatur, Ersatzteile JSONB, Arbeitszeit JSONB, Technikerempfehlung, Raw-Response, Modell, Tokens, erstellt_von).
- **`service_ai_repair_guides`** – Generierte Reparaturanleitungen (Prüfschritte, Reparaturschritte, Sicherheit, Abschlussprüfung, PDF-Pfad).
- **`service_ai_feedback`** – Daumen-hoch/runter + Korrektur pro Analyse (für späteres KB-Lernen).

**Rollen-Policy (über vorhandene Helfer):**
- Lesen: `is_admin()` OR `has_role('Service')` OR `has_role('Technik')` OR `has_role('Kundenservice')` OR `has_role('Finance')` (Finance read-only) OR `has_role('Reparaturannahme')`.
- Schreiben (AI ausführen / Feedback): wie oben **ohne** Finance und **ohne** Tourenplanung.
- KB schreiben: `is_admin()` OR `has_role('Technik')`.
- Löschen: nur Super Admin (Projekt-Standard).

### 2. Edge Functions (neu, alle `verify_jwt=true`)

Alle nutzen Lovable AI Gateway (`google/gemini-3-flash-preview`, `LOVABLE_API_KEY` schon vorhanden) via OpenAI-kompatiblem Endpoint.

| Function | Zweck |
|---|---|
| `service-ai-analyze` | Fehleranalyse + Ersatzteilvorschlag + Arbeitszeit + Technikerempfehlung in einem strukturierten JSON-Call. Lädt Kontext (Ticket/Reparatur, Gerät, SN, bisherige Tickets/Reparaturen desselben Geräts, KB-Treffer per ILIKE). Speichert Ergebnis in `service_ai_analyses`. |
| `service-ai-repair-guide` | Erzeugt Reparaturanleitung (Prüfschritte, Reparatur, Sicherheit, Abschluss). Speichert in `service_ai_repair_guides`. |
| `service-ai-repair-guide-pdf` | Rendert vorhandenen Guide als PDF (jsPDF serverseitig) und liefert Bytes zurück (Client lädt herunter). |
| `service-ai-suggest-technician` | Eigenständige Technikerempfehlung (nutzt `technician_skills` + Ticket-Historie). Wird zusätzlich auch von `service-ai-analyze` aufgerufen. |
| `service-ai-cockpit-stats` | Aggregierte KPIs für das Cockpit (top Fehler, top Ersatzteile, offene kritische Tickets, Geräte mit hoher Fehlerquote, Techniker-Auslastung). |

429/402-Fehler werden sauber an die UI durchgereicht.

### 3. UI – additiv eingehängt

- **Neuer „AI Fehleranalyse"-Button** auf bestehenden Detailseiten:
  - `src/pages/TicketDetail.tsx` (bzw. äquivalente Ticket-Detailansicht)
  - `src/pages/RepairOrderDetail.tsx`
  
  Klick öffnet ein neues Side-Panel **`AiAnalysisPanel`** mit Tabs: *Analyse · Ersatzteile · Anleitung · Arbeitszeit · Techniker*. Buttons: „Analyse starten", „Anleitung als PDF", „Bestellvorschlag erzeugen" (legt Entwurf in `production_orders` mit `is_reclamation=false` und `approval_status='pending'` — bestehender Genehmigungsflow greift).
  
- **Neue Seite `/ai-service-center`** (`src/pages/AiServiceCenter.tsx`)
  - Cockpit-Kacheln: häufigste Fehler, Top-Ersatzteile, kritische offene Tickets, AI-Empfehlungen-Stream, Geräte mit hoher Fehlerquote, Techniker-Auslastung.
  - Tabelle: zuletzt erstellte Analysen mit Direkt-Sprung ins Ticket/Reparatur.
  - KB-Editor für Admin/Technik.

- **Sidebar-Eintrag** unter *Service/Tickets*: „AI Service Center" — sichtbar für Admin, Service, Technik, Kundenservice, Finance (read-only), Reparaturannahme.

### 4. Rollen-Mapping in der UI

| Rolle | Buttons sichtbar | Aktionen |
|---|---|---|
| Super Admin / Admin | alle | alle, inkl. KB-Editor & Delete |
| Service | „AI Fehleranalyse", Anleitung, PDF | ausführen, Feedback |
| Technik | alle (außer Delete), KB-Editor | ausführen, KB editieren |
| Kundenservice | Fehleranalyse, Anleitung anzeigen | ausführen |
| Finance | Cockpit + Analysen lesen | nur lesen |
| Tourenplanung | **nichts** (Modul ausgeblendet) | — |

### 5. Was **nicht** angefasst wird

- Keine Änderung an `tickets`, `repair_orders`, `production_orders`, `customers`, `whatsapp_*`, `mail_*`, `lager_devices`.
- Keine bestehenden Edge Functions umgeschrieben.
- Keine Sidebar-/Layout-Refactors außerhalb des einen neuen Menüpunkts.
- Keine Auto-Trigger — AI läuft nur auf User-Klick (kostenkontrolliert).

### Lieferung in dieser Reihenfolge

1. Migration (Tabellen, Grants, RLS, Indizes, Seed-KB leer).
2. 5 Edge Functions + `config.toml`.
3. `AiAnalysisPanel`-Komponente + Buttons in Ticket-/Reparatur-Detail.
4. `/ai-service-center`-Seite + Routing + Sidebar.
5. Memory-Eintrag `mem://features/ai-service-assistent`.

---

**Offene Punkte zur Bestätigung:**
- Soll der „Bestellvorschlag erzeugen"-Button direkt einen `production_orders`-Entwurf (pending) anlegen, oder nur eine Vorschau ohne DB-Schreibvorgang anzeigen?
- PDF-Anleitung: einfache jsPDF-Version (deutsche Texte, Logo-frei) reicht — okay so?

Wenn du mit beidem „ja, los" antwortest oder einfach nur „los", baue ich Punkt 1–5 in einem Rutsch.
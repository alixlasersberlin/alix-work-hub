# Multi-Mandanten- & Workspace-System für AlixWork

Rein additive Erweiterung: kein bestehendes Menü, keine bestehende Seite, Tabelle oder Edge Function wird verändert oder entfernt. Alles Neue liegt neben dem heutigen System und ist über einen Schalter zuschaltbar.

## Ausgangslage

- Mandanten existieren bereits (`tenants`, `user_tenant_access`, TenantContext, TenantSwitcher im Header).
- CMR ist bereits ein vollwertiger Mandant (`/cmr` mit Belegen, Artikeln, Buchhaltung, Mahnwesen, Vorlagen, Nummernkreisen).
- Alix Lasers (DE) und Alix Austria laufen über die bestehenden Zoho-Quellsysteme.
- Die Navigation ist eine große statische Liste (`navItems`) mit rund 40 Hauptbereichen.

## Phase 1 — Mandanten- und Workspace-Fundament (dieser Schritt)

Datenbank (additiv, neue Tabellen):
- `workspaces` (Code, Name, Icon, Sortierung, aktiv) — Verkauf, Buchhaltung, Lager, Fertigung, Operation.
- `workspace_nav_items` (Workspace, Label, Pfad, Icon, Sortierung, Rollen) — Navigation datengetrieben, neue Einträge ohne Code-Änderung.
- `user_workspace_access` (Benutzer, Workspace) — Workspace-Rechte je Benutzer.
- Mandant „Alix Medical“ wird in `tenants` ergänzt; CMR-Stammdaten (Adresse Dubai, Telefon, WhatsApp, Web, E-Mail) werden in den Mandantenstamm übernommen.
- `tenants` erhält additive Profilfelder (Adresse, Kontakt, Logo-URL, Steuerkonfiguration) für die Mandantenverwaltung.

Frontend:
- Header: Mandantenauswahl bleibt, wird um Logo/Flagge und Firmenkurzinfo erweitert.
- Neue Workspace-Leiste unterhalb des Headers (🏠 Verkauf · 💰 Buchhaltung · 📦 Lager · 🏭 Fertigung · ⚙️ Operation), ohne Seitenreload, Auswahl wird gespeichert.
- Neuer Modus „Workspace-Navigation“: die Sidebar zeigt nur die Einträge des aktiven Workspaces. Ein Schalter „Klassische Navigation“ stellt jederzeit die heutige vollständige Menüstruktur wieder her (Default beim ersten Start: klassisch, damit nichts verloren geht).
- Workspace-Dashboards (`/w/verkauf`, `/w/buchhaltung`, `/w/lager`, `/w/fertigung`, `/w/operation`) mit den beschriebenen KPI-Karten, die bestehende Daten lesen.

Rechte:
- Sichtbar sind nur Mandanten aus `user_tenant_access` und Workspaces aus `user_workspace_access`; Super Admin sieht alles.

## Phase 2 — Mandantenverwaltung & Dokumente

- Adminseite „Mandantenverwaltung“: Firmendaten, Logo, Briefpapier, Bankverbindung, Steuerkonfiguration, Nummernkreise, PDF- und E-Mail-Vorlagen je Mandant.
- Nummernkreise und Vorlagen strikt je Mandant getrennt (Muster wie bereits bei CMR umgesetzt).

## Phase 3 — Mandant Alix Medical

- Eigener Belegkreis (Angebot, AB, Rechnung, Gutschrift, Lieferschein, Vertrag, Serviceauftrag, Wartung), Artikel, Stücklisten, Fertigungs- und ISO-13485/MDR/CE-Dokumentation, eigene Buchhaltung und Auswertungen — nach dem bewährten CMR-Muster als eigener Bereich, ohne Eingriff in Alix Lasers.

## Phase 4 — Gemeinsamer Kundenstamm & globale Suche

- Kunden, Ansprechpartner, Adressen, Geräte, Dokumente und Notizen bleiben mandantenübergreifend; Geschäftsvorgänge bleiben getrennt.
- Globale Suchleiste mittig im Header, mandantenabhängig über Kunden, Belege, Artikel, Seriennummern, Verträge, Dokumente, Tickets, Projekte.

## Technische Hinweise

- Mandantentrennung über `tenant_id` in neuen Tabellen plus RLS via `has_tenant_access(tenant_id)`; bestehende Tabellen bleiben unangetastet.
- Navigation und Workspaces kommen aus der Datenbank, damit neue Mandanten und Bereiche später ohne Code-Änderung angelegt werden können.
- Lazy Loading und Caching der Workspace-Navigation, Wechsel ohne Reload.

## Abgrenzung

- Bestehende Routen, Menüs und Prozesse bleiben unverändert erreichbar.
- Der Workspace-Modus ist optional pro Benutzer aktivierbar.

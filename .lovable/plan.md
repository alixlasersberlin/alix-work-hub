## Ziel

Visuelles Refresh auf „Aurora 2.0" (Light + Dark, Inter, Glass, mehr Whitespace) ohne jede Änderung an Routen, Datenbank, RLS, Edge Functions, Rollen, Business-Logik oder Seitenstruktur.

## Scope Phase 1 (dieser Schritt)

1. **Design-Foundation**
   - Neuer Theme-Token-Layer `aurora2` zusätzlich zu vorhandenen Themes (Black/Gold, theme-neo bleiben unangetastet als Fallback).
   - Tokens in `src/index.css` unter `[data-theme="aurora2"]` und `[data-theme="aurora2-dark"]` exakt wie im Prompt: `--background`, `--card`, `--foreground`, `--muted-foreground`, `--border`, `--primary` (#2563EB / #60A5FA), `--success`, `--warning`, `--destructive`.
   - Glass-Tokens: `--glass-bg`, `--glass-border`, `--shadow-elegant`.
   - Spacing/Radius-Skala: `--radius` 14px (Forms) / 24px (Sidebar), Container `max-w-[1600px]`.
   - Inter Variable via Google Fonts in `index.html`, in `tailwind.config.ts` als `font-sans` mit `system-ui, -apple-system, "SF Pro Display"` Fallback.
   - Typo-Klassen: `text-h1/h2/h3/body/small/label` mit den geforderten Größen + 150% line-height.
   - `useTheme` erweitert um Variante `aurora2` + `aurora2-dark`, persistiert in localStorage; Black/Gold bleibt wählbar.

2. **Sidebar Aurora 2.0**
   - Neue Komponente `src/components/AuroraSidebar.tsx`, gleiches `navItems`-Array wie heutiges `AppLayout` (keine Route ändern).
   - 280px breit, floating, `rounded-3xl`, Glass-Surface, gruppiert nach: Dashboard, Sales, Customers, Devices, Tickets, Service Center, Academy, Finance, Administration, AI Center.
   - Aktiver Eintrag: blauer Glow + linke 3px-Statuslinie.
   - Hover: 150ms ease-out fade + leichtes scale-[1.01].
   - Kollabierbar auf 72px (Icon-Only) via shadcn `SidebarProvider` Pattern.
   - `AppLayout` wird so umgebaut, dass es bei aktivem `aurora2`-Theme die neue Sidebar rendert, sonst die alte. Damit ist Rollback ein 1-Zeilen-Toggle.

3. **Dashboard Aurora 2.0**
   - Nur `src/pages/Dashboard.tsx` betroffen.
   - Header-Band: Begrüßung („Guten Morgen, {Vorname}"), Datum, Schnellaktionen (Neue Anfrage, Neuer Auftrag, Suche).
   - 12-Spalten-Grid, `gap-6`, Max-Breite 1600px.
   - KPI-Karten (existierende Datenquellen, nichts neu abfragen): Umsatz, Geräte, Tickets, Kunden, Wartungen, Garantien, Offene Aufgaben. Jede Karte: Icon, Wert, Trend-Pill (↑/↓ %), Sparkline (recharts, bereits installiert).
   - Activity-Feed + Timeline-Sektion nutzen vorhandene Datenhooks; nur Präsentation neu.
   - Framer Motion `fade-in`/`scale-in` 200ms beim Mount, keine durchgehenden Loops.

4. **Globale Cmd+K-Suche**
   - Neue Komponente `src/components/CommandPalette.tsx` auf Basis von shadcn `Command` (bereits in `components/ui/command.tsx`).
   - Trigger: globaler Hotkey `⌘K`/`Ctrl+K`, im neuen Header sichtbarer Suchbutton mit Shortcut-Hint.
   - Quellen (alle bestehende Tabellen, keine neuen):
     - `customers` (name, company_name, email)
     - `lager_devices` (serial_number, model)
     - `tickets` (subject, ticket_number)
     - `zoho_invoices` (invoice_number, customer_name)
     - `academy_sessions` (title)
     - `order_documents` (file_name)
   - Debounced `ilike`-Queries (300ms), je Quelle Limit 5, gruppiert dargestellt.
   - Treffer routen über `useNavigate` auf die existierenden Detail-Routen — keine neue Route, keine neue Edge Function.
   - Respektiert RLS automatisch (Queries laufen mit User-Token).

5. **Accessibility**
   - Font-Scale-Switcher S/M/L/XL existiert bereits (`useFontScale`); nur ins neue Header-Menü integrieren.
   - Alle neuen interaktiven Elemente: `aria-label` bei Icon-Buttons, `focus-visible:ring-2 ring-primary`, Tap-Targets ≥ 44px.

## Out of Scope (spätere Phasen, hier explizit NICHT enthalten)

- Tabellen, Formulare, AI Center, Finance-Cockpits, Mobile-PWA — diese ziehen automatisch über die neuen semantischen Tokens nach, strukturell unverändert.
- Heatmaps und neue Diagrammtypen.
- Keine Migration, keine Edge Function, keine RLS-Policy-Änderung.

## Garantien

- `supabase/migrations/**` wird **nicht** angefasst.
- `supabase/functions/**` wird **nicht** angefasst.
- `App.tsx`-Routen bleiben Zeichen-identisch.
- Bestehende Themes (`black-gold`, `theme-neo`, alle DesignVariants) bleiben funktionsfähig und per Switcher wählbar; Aurora 2.0 wird neuer **Default für neue Sessions**, alte Auswahl wird respektiert.
- Rollback: ein Token-Wechsel im `useTheme`-Default reicht.

## Technische Details

- Dateien neu: `src/components/AuroraSidebar.tsx`, `src/components/AuroraHeader.tsx`, `src/components/CommandPalette.tsx`, `src/styles/aurora2.css`.
- Dateien editiert (minimal): `src/index.css` (Import + ein Theme-Block), `src/hooks/useTheme.tsx` (neue Variante), `src/components/AppLayout.tsx` (Theme-Switch zwischen alter/neuer Sidebar+Header), `src/pages/Dashboard.tsx` (Layout-Refactor, gleiche Datenhooks), `tailwind.config.ts` (Font, Typo-Klassen), `index.html` (Inter-Link).
- Recharts und framer-motion sind bereits installiert — keine neuen Dependencies.

```text
┌─────────────────────────────────────────────────────────────┐
│  AuroraHeader  ⌘K Search    Tenant   Notif   User   Theme   │
├──────────┬──────────────────────────────────────────────────┤
│ Sidebar  │  Dashboard                                       │
│ 280px    │  ┌─── Welcome ─────────────── Quick Actions ──┐  │
│ floating │  └────────────────────────────────────────────┘  │
│ glass    │  ┌── KPI ──┐ ┌── KPI ──┐ ┌── KPI ──┐ ┌── KPI ──┐ │
│ rounded  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ │
│ groups   │  ┌──── Activity Feed ────┐ ┌── Timeline ──────┐  │
│          │  └────────────────────────┘ └──────────────────┘ │
└──────────┴──────────────────────────────────────────────────┘
```

Nach Phase 1 prüfen wir gemeinsam visuell, dann gehen Tabellen / Forms / AI Center in Phase 2.

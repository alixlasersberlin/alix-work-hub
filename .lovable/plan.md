
# AlixWork Premium Visual Upgrade

Reines visuelles Upgrade + Accessibility-Schriftgrößensteuerung. **Keine** Änderung an Datenflüssen, Supabase, RLS, Rollen, Routen, Formularen, Menüs oder Workflows.

Vorgehen ist additiv: bestehendes Theme bleibt erhalten und wird über CSS-Variablen veredelt. Vorherige Versuche (3D Beta / Aurora Ultra / Neo Template) wurden vom User explizit deaktiviert — diese werden **nicht** reaktiviert.

---

## 1. Globales Theme-System (additiv)

**`src/index.css`** erweitern (keine bestehenden Tokens entfernen):
- Premium-Farbpalette für **Light** (Weiß / Soft-Silver / Alix-Blau) und **Dark** (Tiefschwarz / Anthrazit / Alix-Blau / Cyan / dezente Gold-Akzente).
- Neue Utility-Tokens: `--shadow-glass`, `--shadow-glow`, `--gradient-premium`, `--ring-premium`, `--surface-glass`, `--border-glass`.
- Neue Utility-Klassen: `.glass-card`, `.glass-panel`, `.premium-button`, `.kpi-tile`, `.slide-in`, `.fade-in-card`, `.tilt-3d`, `.shimmer-skeleton`.
- `prefers-reduced-motion`-Guards für alle Animationen.
- Smooth Color-Transitions (`transition: background-color/color/border-color 200ms`) auf `html, body` für Theme-Switch ohne Flackern.

## 2. Light/Dark-Mode Schalter (echtes Toggle)

- `src/hooks/useTheme.tsx`: aktuelles Hard-Lock auf `light` aufheben — wieder echtes Toggle Light/Dark mit `localStorage("app-theme")`. Default: `light`. Anti-Flicker-Boot-Script in `index.html` (`<script>` vor `<body>` setzt `html.class` aus localStorage).
- Neue Komponente `src/components/ThemeToggle.tsx`: Premium-Toggle mit Sonne/Mond, Glassmorphism-Style, `aria-label`, i18n.
- Einbau im Header (`AppLayout.tsx`) neben bestehender Navigation, ohne andere Elemente zu entfernen.

## 3. Schriftgrößen-Steuerung (Accessibility)

- Neuer Hook `src/hooks/useFontScale.tsx` mit Stufen: `sm 0.9` · `md 1.0` · `lg 1.15` · `xl 1.3` · `a11y 1.5`.
- Setzt `--font-scale` auf `<html>` + Persistenz `localStorage("font-scale")` + Boot-Script gegen Flicker.
- `index.css`: `html { font-size: calc(16px * var(--font-scale, 1)); }` — alle `rem`-basierten Tailwind-Größen skalieren automatisch (Buttons, Inputs, Cards, Tables, Modals).
- Neue Komponente `src/components/FontScaleSwitcher.tsx`: A− / A / A+ / A++ / ♿ als Glass-Popover, im Header neben ThemeToggle.

## 4. Premium Background (global)

- Generierung `public/backgrounds/alixwork-premium-background.webp` (1920×1080, dezent, dunkle + helle Variante via CSS-Overlay), erstellt mit `imagegen` (standard quality).
- Einbindung global in `src/index.css` über `body::before` als `position: fixed; inset:0; z-index:-1;` mit Overlay-Gradient pro Theme — Inhalte bleiben lesbar (Cards behalten opaken Hintergrund).
- Download-Button in **Einstellungen → Design** (neuer kleiner Abschnitt auf vorhandener Settings-/Operation-Seite, keine neue Route nötig). Direkter `<a href="/backgrounds/alixwork-premium-background.webp" download>` — beeinflusst keine bestehende Funktion.

## 5. Mehrsprachigkeit (additiv)

- **Hinweis**: Das Projekt hat aktuell nur `src/i18n/wizard.ts` (nur Public-Wizard, 7 Sprachen). Es existiert **kein** globales i18n-Framework im Backend.
- **Pragmatischer Ansatz**: Neue UI-Komponenten (Theme/FontScale/Download-Button) erhalten Texte über eine kleine, lokale `t()`-Funktion in `src/i18n/ui.ts` mit Sprachen DE/EN/FR/ES/IT/TR/AR/VI. Sprache wird aus `navigator.language` + `localStorage("ui-lang")` ermittelt.
- RTL-Support für AR über `html[dir="rtl"]` automatisch gesetzt, wenn Sprache `ar`.
- Keys: `theme.light`, `theme.dark`, `display.fontSize`, `display.small`, `display.normal`, `display.large`, `display.xlarge`, `display.a11y`, `design.downloadBackground`, `design.premiumDesign`, `display.settings`.
- **Bestehende deutschsprachige UI bleibt unverändert** — nur die neuen Controls sind sprachfähig.

## 6. Dezente Effekte (opt-in pro Komponente)

- Page-Transition: `<main>` in `AppLayout` bekommt `.slide-in` (CSS-only, ~200ms).
- `card-glow` (bereits vorhanden) wird im Light/Dark passend rebalanced.
- Hover-Lift auf KPI-Karten via neuer `.kpi-tile`-Klasse — bestehende Tiles können diese **optional** annehmen (nicht erzwungen).

## 7. Was **nicht** angefasst wird

- `TemplateSwitcher`, `DesignVariantSwitcher` (bleiben deaktiviert wie vom User gewünscht).
- Sidebar/AppLayout-**Struktur**, Routen, `App.tsx`-Routing.
- PDF-Generatoren, Edge Functions, Supabase Client, RLS, Rollen-Hooks.
- Bestehende Seiten/Komponenten werden **nicht** umgeschrieben — sie erben den neuen Look automatisch über Theme-Variablen.

---

## Geänderte / neue Dateien

**Neu:**
- `src/hooks/useFontScale.tsx`
- `src/components/ThemeToggle.tsx`
- `src/components/FontScaleSwitcher.tsx`
- `src/components/DisplaySettingsMenu.tsx` (Wrapper: Theme + FontScale + BG-Download in einem Glass-Popover)
- `src/i18n/ui.ts`
- `public/backgrounds/alixwork-premium-background.webp`

**Editiert (rein additiv):**
- `src/index.css` — neue Tokens, Glass-Utilities, BG, Font-Scale-Variable, Smooth-Transitions
- `src/hooks/useTheme.tsx` — echtes Light/Dark-Toggle reaktivieren
- `src/components/AppLayout.tsx` — `DisplaySettingsMenu` im Header einhängen
- `index.html` — Anti-Flicker-Boot-Script für Theme + Font-Scale

---

## Risiken & Mitigation

- **Dark-Mode reaktivieren** könnte Komponenten betreffen, die seit dem White-Lock auf `light` optimiert wurden. → Mitigation: Default bleibt `light`; User wählt aktiv Dark.
- **Font-Scale > 1.3** kann in dichten Tabellen Spalten brechen. → `a11y`-Stufe explizit als "Accessibility" gelabelt; Tables behalten `overflow-x-auto`.
- **Background** kann auf langsamen Geräten stören. → WebP, einmalig geladen, `position: fixed`, kein Parallax-JS.

---

## Offene Frage

Soll der **Dark Mode wirklich wieder aktivierbar** sein? Du hattest zuvor das Standard-Template auf reines Weiß/Grau festgelegt. Ohne Dark Mode kann ich Light-Only lassen und nur den Font-Scale-Switcher + Premium-Background + Download liefern. Bitte kurz bestätigen, dann setze ich um.

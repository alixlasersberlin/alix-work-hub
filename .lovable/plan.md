# AlixWork Mega Design System 2026 — Umsetzungsplan

Reines additives Visual-/UX-Upgrade. **Keine** Änderung an Supabase, RLS, Routen, Formularen, Workflows, API-Calls oder Businesslogik. Bestehende Komponenten erben den neuen Look automatisch über CSS-Variablen + opt-in Modi-Klassen am `<html>`.

---

## 1. Experience Mode Switcher (Kernstück)

Neuer Hook `src/hooks/useExperienceMode.tsx` mit drei Modi:

- `classic` → keinerlei zusätzliche Effekte (heutiger Zustand, garantiert unverändert)
- `premium` → Glassmorphism, Premium Cards, sanfte Animationen, modernisierter Header/Sidebar
- `mega` → alles aus Premium **plus** 3D-Tiefenebenen, Dynamic Lighting, Mission-Control-KPIs, animierte Statusindikatoren

Setzt `data-experience="classic|premium|mega"` auf `<html>` + `localStorage("alix-experience")`. Anti-Flicker-Boot-Script in `index.html`.

Neue Komponente `src/components/ExperienceModeSwitcher.tsx` — Glass-Karte unten links in der Sidebar mit ✨-Icon, drei Optionen, Live-Preview ohne Reload, integrierter Download-Button für den Premium-Background.

Einbau in `AppLayout.tsx` Sidebar-Footer (existierender Bereich, keine Strukturänderung).

## 2. Light / Dark Mode (echtes Toggle)

`src/hooks/useTheme.tsx` reaktivieren: echtes Light/Dark mit `localStorage("app-theme")`, Default `light` (kein Bruch für Bestandsuser). Toggle-Button in `DisplaySettingsMenu` (bereits im Header vorhanden) — Sonne/Mond mit i18n-`aria-label`. Anti-Flicker-Boot-Script in `index.html` ergänzen.

Dark-Tokens werden in `src/index.css` rebalanced (Tiefschwarz / Anthrazit / Alix-Blau / Cyan / dezente Gold-Akzente).

## 3. Schriftgrößen-Steuerung (bereits vorhanden — bestätigen)

`useFontScale` ist live. Stufen Small/Normal/Large/XLarge/A11y bleiben. Im `DisplaySettingsMenu` neben dem neuen Theme-Toggle weiterhin sichtbar.

## 4. Globales Theme + Effekte (CSS-only, modi-gated)

`src/index.css` erweitern (rein additiv, alte Tokens bleiben):

- Neue Tokens: `--shadow-glass`, `--shadow-glow`, `--gradient-premium`, `--gradient-mega`, `--ring-premium`, `--surface-glass`, `--border-glass`, `--alix-gold`, `--alix-blue`
- Utility-Klassen: `.glass-card`, `.glass-panel`, `.premium-button`, `.kpi-tile`, `.slide-in`, `.fade-in-card`, `.tilt-3d`, `.shimmer-skeleton`, `.glow-hover`, `.depth-layer-1/2/3`
- Modi-Gating: Effekte greifen nur unter `html[data-experience="premium"]` bzw. `html[data-experience="mega"]`. Unter `classic` ist die Ausgabe **byte-identisch** zu heute.
- `prefers-reduced-motion` deaktiviert alle Animationen
- Smooth Color-Transitions auf `html, body` für Theme-Switch ohne Flackern

## 5. Premium Background

Generierung `public/backgrounds/alixwork-premium-background.jpg` (1920×1080, dunkle Variante mit Schwarz/Anthrazit/Alix-Blau/Gold, dezente Tech-Linien + Weltkarten-Andeutung). Light-Variante `…-light.jpg`.

Einbindung in `index.css` via `body::before` (fixed, z-index -1, Overlay-Gradient pro Theme). **Nur** unter Premium/Mega aktiv — Classic bleibt unberührt. Cards behalten opaken Hintergrund für Lesbarkeit.

Download-Button im Experience-Mode-Switcher: direkter `<a href="…" download>`.

## 6. Mehrsprachigkeit

`src/i18n/ui.ts` (bereits vorhanden) erweitert um Keys für: `experience.title`, `experience.classic`, `experience.premium`, `experience.mega`, `experience.download`, `theme.toggle`. Sprachen DE/EN/FR/ES/IT/TR/AR/VI. RTL via `html[dir="rtl"]` automatisch bei `ar`. Bestehende deutschsprachige UI bleibt unverändert.

## 7. Was **nicht** angefasst wird

- `TemplateSwitcher`, `DesignVariantSwitcher` (bleiben deaktiviert wie vom User gewünscht)
- `App.tsx`-Routing, Seiten-Logik, Sidebar-Struktur (nur Footer-Bereich erhält den Switcher)
- PDF-Generatoren, Edge Functions, Supabase Client, RLS, Rollen-Hooks
- Keine Tabellen-/Form-Komponenten werden umgeschrieben — sie erben Premium/Mega-Look über Tokens

---

## Neue / geänderte Dateien

**Neu:**
- `src/hooks/useExperienceMode.tsx`
- `src/components/ExperienceModeSwitcher.tsx`
- `public/backgrounds/alixwork-premium-background.jpg` (dark)
- `public/backgrounds/alixwork-premium-background-light.jpg`

**Editiert (additiv, modi-gegated):**
- `src/index.css` — neue Tokens, Glass/Mega-Utilities, Background, Smooth-Transitions; alles hinter `data-experience`
- `src/hooks/useTheme.tsx` — echtes Light/Dark-Toggle
- `src/components/AppLayout.tsx` — `ExperienceModeSwitcher` unten in der Sidebar einhängen
- `src/components/DisplaySettingsMenu.tsx` — Theme-Toggle aktivieren
- `src/i18n/ui.ts` — neue Keys + 8 Sprachen
- `index.html` — Anti-Flicker-Boot-Script (Theme + Experience + FontScale)

---

## Risiken & Mitigation

- **Classic muss byte-identisch bleiben** → alle neuen Styles strikt hinter `html[data-experience="premium"]` / `="mega"`-Selektoren; Default ist `classic`
- **Dark Mode** könnte Komponenten betreffen, die seit dem White-Lock auf `light` optimiert wurden → Default bleibt `light`; User wählt aktiv Dark
- **Mega-Effekte auf langsamen Geräten** → CSS-only (keine WebGL/Canvas), `prefers-reduced-motion` Guards, Background als statisches JPG mit `position:fixed`
- **Font-Scale > 1.3 in dichten Tabellen** → bestehender `overflow-x-auto` greift; A11y-Stufe explizit gelabelt

---

## Offene Fragen

1. **Default-Modus für Bestandsuser?** Vorschlag: `classic` (kein User merkt einen Unterschied, bis er aktiv wechselt). Alternativ: `premium`.
2. **Mega-Mode Background-Variante:** dunkel mit Weltkarte + Goldlinien wie beschrieben — ok so, oder soll ich mehrere Varianten zur Auswahl generieren?

Bitte kurz bestätigen, dann setze ich um.

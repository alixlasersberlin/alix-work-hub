# Aurora 2.0 — Premium UI Layer

Aurora 2.0 ist ein **nicht-invasiver** UI-Layer für Alix Work. Er aktiviert sich ausschließlich, wenn das Wurzel-Element das Attribut `data-aurora="2"` trägt. Das normale Theme bleibt unverändert.

```html
<html data-aurora="2"> … </html>
```

Toggeln per Template-Switcher oder im DevTools.

---

## Datei-Struktur

| Datei | Zweck |
| --- | --- |
| `src/styles/aurora2.css` | Komplette Aurora-2-Stylesheet (10 Phasen, ~900 Zeilen) |
| `src/components/aurora/ActivityHeatmap.tsx` | 52-Wochen Ticket-Aktivitäts-Heatmap |
| `src/components/aurora/ToursHeatmap.tsx` | 52-Wochen Tourenplan-Auslastung |
| `src/components/aurora/CursorSpotlight.tsx` | Globales Mouse-Tracking für Card-Spotlight (in `App.tsx` gemountet) |
| `src/components/aurora/NumberTicker.tsx` | Animierter KPI-Hochzähler |

---

## Phasen-Übersicht

| Phase | Inhalt |
| ----- | ------ |
| **1** | Design-Tokens, Glass-Cards, Gold-Akzente, Basis-Variant `data-aurora="2"` |
| **2** | Hover-Glows, Aurora-Borders, micro-shadows |
| **3** | KPI-Cards, Recharts-Tuning, Slim-Scrollbars, Toasts, Breadcrumbs |
| **4** | Premium-Tabellen, Focus-Ringe, Tab-Underlines, Button-Lift, Dialog-Shadows |
| **5** | Sidebar-Glas mit Gold-Rail, Nav-Underlines, Shimmer-Skeletons, Page-Transitions, Popovers |
| **6** | Live-Status-Pulse, Notification-Dots, premium Toasts, Progress-Shine, Switch/Checkbox/Radio |
| **7** | Ambient-Aurora-Hintergrund, Film-Grain, Scroll-Reveal (`animation-timeline: view()`), `prefers-reduced-motion`, Print, forced-colors |
| **8** | Recharts-Polish, Delta-Pfeile (▲▼), Glas-Command-Palette, `<mark>`, Empty-States |
| **9** | Hero-Gradient-Text, Cursor-Spotlight auf Karten, `.a2-tilt` 3D-Hover, `<kbd>`/`<code>`, Inline-Link-Underlines |
| **10** | Boot-Flash, `.a2-numeral`, Gold-`<hr>`, FAB-Polish, `[data-a2-group]`-Marker, `<NumberTicker>` |

---

## Hilfs-Klassen & Attribute

| Klasse / Attribut | Wirkung |
| --- | --- |
| `.a2-hero` / `<h1 data-hero>` | Animierter Gold-Shine Hero-Text |
| `.a2-tilt` | 3D-Tilt beim Hover |
| `.a2-numeral` | Premium-Typo für große Zahlen |
| `[data-status="live\|aktiv\|offen"]` | Pulsierender Status-Dot |
| `[data-notification-count="3"]` | Gold-Glow-Badge mit Zahl |
| `[data-delta="up\|down\|flat"]` | KPI-Delta mit ▲▼— Symbol + Farbe |
| `[data-sparkline]` | Container mit Aurora-Verlauf |
| `[data-empty-state]` | Zentrierter Empty-State |
| `[data-fab]` | Floating-Action-Button mit Lift |
| `[data-a2-group]` | Gold-Marker-Bar vor Card-Gruppen |
| `[data-skeleton]` / `*[class*="skeleton"]` | Shimmer-Animation |

---

## Komponenten-Nutzung

```tsx
import { ActivityHeatmap } from "@/components/aurora/ActivityHeatmap";
import { ToursHeatmap }    from "@/components/aurora/ToursHeatmap";
import { NumberTicker }    from "@/components/aurora/NumberTicker";

<NumberTicker value={1234} format={(n) => `€ ${n.toLocaleString("de-DE")}`} />
```

`CursorSpotlight` ist global einmal in `App.tsx` aktiv — keine zusätzliche Einbindung pro Seite nötig.

---

## A11y

- Honoriert `prefers-reduced-motion` (alle Animationen werden auf 0 ms reduziert).
- Sichtbarer `focus-visible`-Ring mit Gold-Glow.
- `forced-colors` (Windows High-Contrast) deaktiviert dekorative Layer.
- Print-Styles entfernen Aurora-Effekte und liefern saubere s/w-Ausgabe.

---

## Erweitern

Neue Phasen einfach unten an `src/styles/aurora2.css` anhängen, immer hinter `html[data-aurora="2"]`-Selector — so kollidiert nichts mit dem klassischen Theme.

---
name: ALIXWORK NEO Template
description: Parallel-aktivierbares Glassmorphism-Template, Live-Switch über /design-template oder den schwebenden Schalter
type: feature
---
- Parallel zum bestehenden Black/Gold-Layout existiert das Template **ALIXWORK NEO** (Premium Glassmorphism SaaS 2026: Aurora-Gradient-Background, schwebende Glass-Sidebar/Header, Electric-Blue (#3B82F6) + Cyan (#06B6D4) Akzente).
- Aktivierung als CSS-Overlay über die Klasse `theme-neo` auf `<html>`. Steuerung über `src/hooks/useUiTemplate.ts` (localStorage `alixwork.ui_template` = 'standard' | 'neo'), Boot in `src/main.tsx` via `bootUiTemplate()`.
- Styles ausschließlich in `src/styles/theme-neo.css`. Bestehende Komponenten/Seiten dürfen NICHT angefasst werden, um Standard-Look intakt zu lassen.
- UI: Settings-Seite `/design-template` (`src/pages/DesignTemplate.tsx`) + globaler Floating Switch `src/components/TemplateSwitcher.tsx` (in App.tsx gemountet, sichtbar für alle Rollen).
- Keine DB-Änderungen, keine neuen Tabellen.

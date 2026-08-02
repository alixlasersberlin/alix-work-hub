import type { CSSProperties } from 'react';

/** Vollständige Design-Konfiguration einer Umfrage (gespeichert in surveys.design). */
export type SurveyDesign = {
  theme: string;
  layout: 'card' | 'fullscreen' | 'split' | 'minimal' | 'chat';
  colors: {
    bg: string;
    surface: string;
    text: string;
    muted: string;
    primary: string;
    primaryText: string;
    border: string;
  };
  font: string;
  radius: number;
  shadow: 'none' | 'soft' | 'strong';
  background: {
    type: 'solid' | 'gradient' | 'image';
    gradientFrom: string;
    gradientTo: string;
    angle: number;
    imageUrl: string;
    overlay: number;
    blur: number;
  };
  media: { logoUrl: string; logoHeight: number; heroUrl: string; heroHeight: number };
  progress: 'bar' | 'dots' | 'steps' | 'none';
  animation: 'slide' | 'fade' | 'zoom' | 'none';
  buttonStyle: 'solid' | 'outline' | 'pill';
  onePerPage: boolean;
  startPage: { enabled: boolean; headline: string; text: string; button: string };
  personalization: { greeting: string };
  footer: { text: string; privacyUrl: string; imprintUrl: string };
};

export const FONT_PAIRS: { key: string; label: string; css: string; google?: string }[] = [
  { key: 'system', label: 'System (neutral)', css: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif' },
  { key: 'inter', label: 'Inter · modern', css: "'Inter', system-ui, sans-serif", google: 'Inter:wght@400;500;600;700' },
  { key: 'dmsans', label: 'DM Sans · freundlich', css: "'DM Sans', system-ui, sans-serif", google: 'DM+Sans:wght@400;500;700' },
  { key: 'manrope', label: 'Manrope · technisch', css: "'Manrope', system-ui, sans-serif", google: 'Manrope:wght@400;600;800' },
  { key: 'playfair', label: 'Playfair · edel', css: "'Playfair Display', Georgia, serif", google: 'Playfair+Display:wght@500;700' },
  { key: 'lora', label: 'Lora · redaktionell', css: "'Lora', Georgia, serif", google: 'Lora:wght@400;600' },
  { key: 'spacegrotesk', label: 'Space Grotesk · markant', css: "'Space Grotesk', system-ui, sans-serif", google: 'Space+Grotesk:wght@400;600;700' },
];

export const LAYOUTS: { key: SurveyDesign['layout']; label: string; hint: string }[] = [
  { key: 'card', label: 'Karte', hint: 'Zentrierte Karte, klassisch' },
  { key: 'fullscreen', label: 'Vollbild', hint: 'Eine Frage pro Bildschirm' },
  { key: 'split', label: 'Split', hint: 'Bild links, Frage rechts' },
  { key: 'minimal', label: 'Minimal', hint: 'Ohne Rahmen, viel Weißraum' },
  { key: 'chat', label: 'Chat', hint: 'Dialog-Optik, Blase pro Frage' },
];

export const DEFAULT_DESIGN: SurveyDesign = {
  theme: 'alix-dark',
  layout: 'card',
  colors: {
    bg: '#0b0b0d', surface: '#141418', text: '#f5f5f4', muted: '#a1a1aa',
    primary: '#c9a227', primaryText: '#0b0b0d', border: '#2a2a30',
  },
  font: 'inter',
  radius: 16,
  shadow: 'soft',
  background: { type: 'solid', gradientFrom: '#0b0b0d', gradientTo: '#1b1b22', angle: 135, imageUrl: '', overlay: 0.55, blur: 0 },
  media: { logoUrl: '', logoHeight: 40, heroUrl: '', heroHeight: 160 },
  progress: 'bar',
  animation: 'slide',
  buttonStyle: 'solid',
  onePerPage: true,
  startPage: { enabled: false, headline: '', text: '', button: 'Umfrage starten' },
  personalization: { greeting: 'Hallo {{name}},' },
  footer: { text: '', privacyUrl: '', imprintUrl: '' },
};

export type ThemePreset = { key: string; label: string; hint: string; patch: Partial<SurveyDesign> };

export const THEMES: ThemePreset[] = [
  {
    key: 'alix-dark', label: 'ALIX Black / Gold', hint: 'Premium, dunkel',
    patch: { colors: DEFAULT_DESIGN.colors, font: 'inter', radius: 16, shadow: 'soft', background: { ...DEFAULT_DESIGN.background, type: 'gradient', gradientFrom: '#0b0b0d', gradientTo: '#1b1b22' } },
  },
  {
    key: 'clean-light', label: 'Clean Light', hint: 'Hell, sachlich',
    patch: { colors: { bg: '#f7f7f8', surface: '#ffffff', text: '#18181b', muted: '#71717a', primary: '#111827', primaryText: '#ffffff', border: '#e4e4e7' }, font: 'inter', radius: 14, shadow: 'soft', background: { ...DEFAULT_DESIGN.background, type: 'solid' } },
  },
  {
    key: 'medical', label: 'Medical Blue', hint: 'Klinisch, vertrauenswürdig',
    patch: { colors: { bg: '#f2f7fb', surface: '#ffffff', text: '#0f172a', muted: '#64748b', primary: '#0ea5e9', primaryText: '#ffffff', border: '#dbeafe' }, font: 'dmsans', radius: 18, shadow: 'soft', background: { ...DEFAULT_DESIGN.background, type: 'gradient', gradientFrom: '#eaf4ff', gradientTo: '#ffffff' } },
  },
  {
    key: 'aurora', label: 'Aurora Glass', hint: 'Verlauf, modern',
    patch: { colors: { bg: '#0a0f1f', surface: '#111a2e', text: '#e8eefc', muted: '#94a3b8', primary: '#38bdf8', primaryText: '#04121f', border: '#1f2b45' }, font: 'spacegrotesk', radius: 22, shadow: 'strong', background: { ...DEFAULT_DESIGN.background, type: 'gradient', gradientFrom: '#0a0f1f', gradientTo: '#123047', angle: 150 } },
  },
  {
    key: 'warm', label: 'Warm Sand', hint: 'Freundlich, weich',
    patch: { colors: { bg: '#faf6f0', surface: '#ffffff', text: '#2a2118', muted: '#8b7d6b', primary: '#c2703d', primaryText: '#ffffff', border: '#ecdfd0' }, font: 'lora', radius: 20, shadow: 'soft', background: { ...DEFAULT_DESIGN.background, type: 'solid' } },
  },
  {
    key: 'editorial', label: 'Editorial', hint: 'Serif, hochwertig',
    patch: { colors: { bg: '#ffffff', surface: '#ffffff', text: '#111111', muted: '#6b7280', primary: '#111111', primaryText: '#ffffff', border: '#e5e7eb' }, font: 'playfair', radius: 4, shadow: 'none', background: { ...DEFAULT_DESIGN.background, type: 'solid' } },
  },
  {
    key: 'emerald', label: 'Emerald Care', hint: 'Grün, beruhigend',
    patch: { colors: { bg: '#f2fbf6', surface: '#ffffff', text: '#0f2418', muted: '#5c7a68', primary: '#10b981', primaryText: '#04231a', border: '#d5f0e2' }, font: 'manrope', radius: 18, shadow: 'soft', background: { ...DEFAULT_DESIGN.background, type: 'gradient', gradientFrom: '#eafaf1', gradientTo: '#ffffff' } },
  },
  {
    key: 'midnight', label: 'Midnight Violet', hint: 'Dunkel, ausdrucksstark',
    patch: { colors: { bg: '#0f0a1a', surface: '#191130', text: '#f2edff', muted: '#a79bc4', primary: '#a855f7', primaryText: '#12071f', border: '#2c2049' }, font: 'manrope', radius: 20, shadow: 'strong', background: { ...DEFAULT_DESIGN.background, type: 'gradient', gradientFrom: '#0f0a1a', gradientTo: '#2a1550', angle: 160 } },
  },
];

/** Merged Design mit Defaults (robust gegen alte Datensätze). */
export function mergeDesign(raw: any): SurveyDesign {
  const d = raw && typeof raw === 'object' ? raw : {};
  return {
    ...DEFAULT_DESIGN,
    ...d,
    colors: { ...DEFAULT_DESIGN.colors, ...(d.colors ?? {}) },
    background: { ...DEFAULT_DESIGN.background, ...(d.background ?? {}) },
    media: { ...DEFAULT_DESIGN.media, ...(d.media ?? {}) },
    startPage: { ...DEFAULT_DESIGN.startPage, ...(d.startPage ?? {}) },
    personalization: { ...DEFAULT_DESIGN.personalization, ...(d.personalization ?? {}) },
    footer: { ...DEFAULT_DESIGN.footer, ...(d.footer ?? {}) },
  };
}

export function applyTheme(design: SurveyDesign, key: string): SurveyDesign {
  const t = THEMES.find(x => x.key === key);
  if (!t) return design;
  return mergeDesign({ ...design, ...t.patch, theme: key });
}

export function fontCss(key: string) {
  return (FONT_PAIRS.find(f => f.key === key) ?? FONT_PAIRS[0]).css;
}

/** Lädt die benötigte Google-Font einmalig in den <head>. */
export function ensureFontLoaded(key: string) {
  if (typeof document === 'undefined') return;
  const f = FONT_PAIRS.find(x => x.key === key);
  if (!f?.google) return;
  const id = `sv-font-${f.key}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${f.google}&display=swap`;
  document.head.appendChild(link);
}

export function backgroundStyle(d: SurveyDesign): CSSProperties {
  const b = d.background;
  if (b.type === 'image' && b.imageUrl) {
    return {
      backgroundImage: `linear-gradient(rgba(0,0,0,${b.overlay}), rgba(0,0,0,${b.overlay})), url(${JSON.stringify(b.imageUrl).slice(1, -1)})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed',
    };
  }
  if (b.type === 'gradient') {
    return { backgroundImage: `linear-gradient(${b.angle}deg, ${b.gradientFrom}, ${b.gradientTo})` };
  }
  return { backgroundColor: d.colors.bg };
}

export function shadowCss(s: SurveyDesign['shadow']) {
  return s === 'strong' ? '0 30px 80px -20px rgba(0,0,0,.55)' : s === 'soft' ? '0 12px 40px -18px rgba(0,0,0,.35)' : 'none';
}

/** CSS-Variablen für den Umfrage-Container. */
export function designVars(d: SurveyDesign): CSSProperties {
  return {
    ['--sv-bg' as any]: d.colors.bg,
    ['--sv-surface' as any]: d.colors.surface,
    ['--sv-text' as any]: d.colors.text,
    ['--sv-muted' as any]: d.colors.muted,
    ['--sv-primary' as any]: d.colors.primary,
    ['--sv-primary-text' as any]: d.colors.primaryText,
    ['--sv-border' as any]: d.colors.border,
    ['--sv-radius' as any]: `${d.radius}px`,
    ['--sv-shadow' as any]: shadowCss(d.shadow),
    fontFamily: fontCss(d.font),
    color: d.colors.text,
  };
}

export function buttonCss(d: SurveyDesign, variant: 'primary' | 'ghost' = 'primary'): CSSProperties {
  const radius = d.buttonStyle === 'pill' ? 999 : Math.max(6, d.radius - 4);
  if (variant === 'ghost') {
    return { borderRadius: radius, border: `1px solid ${d.colors.border}`, color: d.colors.text, background: 'transparent' };
  }
  if (d.buttonStyle === 'outline') {
    return { borderRadius: radius, border: `1px solid ${d.colors.primary}`, color: d.colors.primary, background: 'transparent' };
  }
  return { borderRadius: radius, background: d.colors.primary, color: d.colors.primaryText, border: '1px solid transparent' };
}

export function animClasses(d: SurveyDesign, phase: 'in-right' | 'in-left' | 'out-left' | 'out-right') {
  if (d.animation === 'none') return '';
  if (d.animation === 'fade') {
    return phase.startsWith('out') ? 'opacity-0' : 'animate-in fade-in duration-300';
  }
  if (d.animation === 'zoom') {
    return phase.startsWith('out') ? 'opacity-0 scale-95' : 'animate-in fade-in zoom-in-95 duration-300';
  }
  return phase === 'out-left' ? 'opacity-0 -translate-x-16'
    : phase === 'out-right' ? 'opacity-0 translate-x-16'
    : phase === 'in-left' ? 'animate-in fade-in slide-in-from-left-16 duration-300'
    : 'animate-in fade-in slide-in-from-right-16 duration-300';
}

/** Ersetzt Platzhalter wie {{name}}, {{firma}} in Texten. */
export function personalize(text: string, vars: Record<string, string | null | undefined>) {
  return String(text ?? '').replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k) => String(vars[k] ?? '').trim());
}

/** #rrggbb → "H S% L%" (Format der shadcn-Design-Tokens). */
export function hexToHslTriple(hex: string): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec((hex || '').trim());
  if (!m) return '0 0% 50%';
  const r = parseInt(m[1], 16) / 255, g = parseInt(m[2], 16) / 255, b = parseInt(m[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const dd = max - min;
    s = l > 0.5 ? dd / (2 - max - min) : dd / (max + min);
    h = max === r ? (g - b) / dd + (g < b ? 6 : 0) : max === g ? (b - r) / dd + 2 : (r - g) / dd + 4;
    h *= 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * Überschreibt die shadcn-Tokens innerhalb des Umfrage-Containers,
 * damit alle UI-Komponenten (Buttons, Inputs, Checkboxen) das Umfrage-Design übernehmen.
 */
export function tokenVars(d: SurveyDesign): CSSProperties {
  const t = hexToHslTriple;
  return {
    ['--background' as any]: t(d.colors.bg),
    ['--foreground' as any]: t(d.colors.text),
    ['--card' as any]: t(d.colors.surface),
    ['--card-foreground' as any]: t(d.colors.text),
    ['--popover' as any]: t(d.colors.surface),
    ['--popover-foreground' as any]: t(d.colors.text),
    ['--primary' as any]: t(d.colors.primary),
    ['--primary-foreground' as any]: t(d.colors.primaryText),
    ['--secondary' as any]: t(d.colors.surface),
    ['--secondary-foreground' as any]: t(d.colors.text),
    ['--muted' as any]: t(d.colors.border),
    ['--muted-foreground' as any]: t(d.colors.muted),
    ['--accent' as any]: t(d.colors.border),
    ['--accent-foreground' as any]: t(d.colors.text),
    ['--border' as any]: t(d.colors.border),
    ['--input' as any]: t(d.colors.border),
    ['--ring' as any]: t(d.colors.primary),
    ['--radius' as any]: `${d.radius}px`,
  };
}

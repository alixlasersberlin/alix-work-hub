import { useCallback, useEffect, useState } from "react";

/**
 * Accessibility Pro — Phase I-11
 * Speichert Benutzer-Einstellungen für Kontrast, Bewegung, Schriftgröße
 * und Fokus-Sichtbarkeit. Setzt globale data-Attribute auf <html>,
 * die im a11y.css ausgewertet werden. Respektiert prefers-reduced-motion.
 */

export type A11yPrefs = {
  highContrast: boolean;
  reducedMotion: "auto" | "on" | "off";
  textScale: 100 | 110 | 125 | 150;
  focusRing: "default" | "bold";
  underlineLinks: boolean;
};

const KEY = "alixwork.a11y_prefs";

const DEFAULTS: A11yPrefs = {
  highContrast: false,
  reducedMotion: "auto",
  textScale: 100,
  focusRing: "default",
  underlineLinks: false,
};

function apply(p: A11yPrefs) {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  el.toggleAttribute("data-a11y-contrast", p.highContrast);
  const systemReduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const reduced = p.reducedMotion === "on" || (p.reducedMotion === "auto" && systemReduced);
  el.toggleAttribute("data-a11y-reduced-motion", !!reduced);
  el.setAttribute("data-a11y-text-scale", String(p.textScale));
  el.setAttribute("data-a11y-focus", p.focusRing);
  el.toggleAttribute("data-a11y-underline", p.underlineLinks);
}

export function getCurrentA11yPrefs(): A11yPrefs {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

export function useA11yPrefs() {
  const [prefs, setPrefs] = useState<A11yPrefs>(() => getCurrentA11yPrefs());

  useEffect(() => { apply(prefs); }, [prefs]);

  // System-Änderung von prefers-reduced-motion respektieren
  useEffect(() => {
    if (prefs.reducedMotion !== "auto" || typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = () => apply(prefs);
    mql.addEventListener?.("change", handler);
    return () => mql.removeEventListener?.("change", handler);
  }, [prefs]);

  const update = useCallback((patch: Partial<A11yPrefs>) => {
    setPrefs(prev => {
      const next = { ...prev, ...patch };
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    localStorage.removeItem(KEY);
    setPrefs(DEFAULTS);
  }, []);

  return { prefs, update, reset };
}

export function bootA11yPrefs() {
  apply(getCurrentA11yPrefs());
}

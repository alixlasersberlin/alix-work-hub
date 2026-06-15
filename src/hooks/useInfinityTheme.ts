import { useCallback, useEffect, useState } from "react";

/**
 * INFINITY DESIGN ENGINE — Phase I-1
 *
 * Zusätzliche Theme-Schicht ÜBER dem bestehenden Aurora/Standard-System.
 * Aurora (data-aurora="2") bleibt 100 % erhalten. Diese Engine setzt nur
 * ein zusätzliches Attribut <html data-infinity="..."> und lädt das passende
 * CSS-Overlay. "off" bedeutet: kein Infinity-Layer (Standard/Aurora pur).
 */

export type InfinityTheme =
  | "off"
  | "infinity-glass"
  | "infinity-neon"
  | "infinity-executive"
  | "infinity-signature";

export const INFINITY_THEMES: { id: InfinityTheme; name: string; description: string }[] = [
  {
    id: "off",
    name: "Aurora pur",
    description: "Kein Infinity-Overlay. Bestehendes Aurora/Standard-Design unverändert.",
  },
  {
    id: "infinity-glass",
    name: "Infinity Glass",
    description: "Tiefe Glasflächen, sanfte Lichtkanten, ruhige Premium-Optik.",
  },
  {
    id: "infinity-neon",
    name: "Infinity Neon",
    description: "Elektrische Akzente, Cyan/Magenta-Glow, futuristische Energie.",
  },
  {
    id: "infinity-executive",
    name: "Infinity Executive",
    description: "Schwarzes Leder, Gold-Akzente, höchste Informationsdichte.",
  },
  {
    id: "infinity-signature",
    name: "ALIX Signature Mode™",
    description: "Hauseigene Signature-Identität — Onyx, Champagner, Aurora-Lichtspur.",
  },
];

const KEY = "alixwork.infinity_theme";

function applyInfinityTheme(theme: InfinityTheme) {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  if (theme === "off") {
    el.removeAttribute("data-infinity");
  } else {
    el.setAttribute("data-infinity", theme.replace(/^infinity-/, ""));
  }
}

export function getCurrentInfinityTheme(): InfinityTheme {
  if (typeof window === "undefined") return "off";
  const stored = localStorage.getItem(KEY) as InfinityTheme | null;
  return stored || "off";
}

export function useInfinityTheme() {
  const [theme, setThemeState] = useState<InfinityTheme>(() => getCurrentInfinityTheme());

  useEffect(() => {
    applyInfinityTheme(theme);
  }, [theme]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY && e.newValue) setThemeState(e.newValue as InfinityTheme);
    };
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent).detail as InfinityTheme | undefined;
      if (detail) setThemeState(detail);
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("alixwork:infinity-theme", onCustom as EventListener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("alixwork:infinity-theme", onCustom as EventListener);
    };
  }, []);

  const setTheme = useCallback((t: InfinityTheme) => {
    localStorage.setItem(KEY, t);
    applyInfinityTheme(t);
    setThemeState(t);
    window.dispatchEvent(new CustomEvent("alixwork:infinity-theme", { detail: t }));
  }, []);

  return { theme, setTheme };
}

/** Boot-time apply so first paint already shows the chosen Infinity theme. */
export function bootInfinityTheme() {
  applyInfinityTheme(getCurrentInfinityTheme());
}

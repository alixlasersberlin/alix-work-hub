import { useCallback, useEffect, useState } from "react";

export type UiTemplate = "standard" | "neo";
const KEY = "alixwork.ui_template";

function apply(_t: UiTemplate) {
  // ALIXWORK NEO wurde auf das Standard-Template angeglichen.
  // Die theme-neo Klasse wird daher nie mehr gesetzt, unabhängig von der Auswahl.
  const el = document.documentElement;
  el.classList.remove("theme-neo");
}

export function getCurrentUiTemplate(): UiTemplate {
  if (typeof window === "undefined") return "neo";
  const stored = localStorage.getItem(KEY) as UiTemplate | null;
  return stored || "neo";
}

/** Globaler Live-Switch zwischen Standard und ALIXWORK NEO. */
export function useUiTemplate() {
  const [template, setTemplateState] = useState<UiTemplate>(() => getCurrentUiTemplate());

  useEffect(() => { apply(template); }, [template]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY && e.newValue) setTemplateState(e.newValue as UiTemplate);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setTemplate = useCallback((t: UiTemplate) => {
    localStorage.setItem(KEY, t);
    apply(t);
    setTemplateState(t);
    // Inform same-tab listeners
    window.dispatchEvent(new CustomEvent("alixwork:ui-template", { detail: t }));
  }, []);

  return { template, setTemplate };
}

/** Boot-time apply so first paint has the right theme. */
export function bootUiTemplate() {
  apply(getCurrentUiTemplate());
}

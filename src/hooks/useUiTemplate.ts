import { useCallback, useEffect, useState } from "react";

export type UiTemplate = "standard" | "neo";
const KEY = "alixwork.ui_template";

function apply(_t: UiTemplate) {
  // Template-Wechsel ist deaktiviert: immer Standard, keine Blue/White-Variante.
  const el = document.documentElement;
  el.classList.remove("theme-neo");
  el.setAttribute("data-lock-template", "standard");
}

export function getCurrentUiTemplate(): UiTemplate {
  return "standard";
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
  try {
    localStorage.setItem(KEY, "standard");
  } catch {
    /* noop */
  }
  apply("standard");
}

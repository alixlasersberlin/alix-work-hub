import { useEffect } from "react";

/**
 * Bekannter Radix-UI-Bug (Dialog/Select/Popover/DropdownMenu):
 * Wird ein Overlay während einer Navigation / eines schnellen Klicks
 * unmountet, bleibt `document.body.style.pointer-events = "none"`
 * hängen. Danach wirken alle Klicks außerhalb von Portalen wie
 * "tot" – Buttons reagieren visuell, öffnen aber keinen Dialog.
 *
 * Dieser Hook beobachtet inline `style`-Änderungen an <body> und setzt
 * `pointer-events` sofort zurück, sobald kein Radix-Overlay mehr offen
 * ist. Zusätzlicher Reset bei Route-Wechsel / Sichtbarkeitswechsel.
 */
export function useRadixBodyPointerEventsFix() {
  useEffect(() => {
    const body = document.body;

    const hasOpenRadixOverlay = () =>
      !!document.querySelector(
        [
          '[data-state="open"][role="dialog"]',
          '[data-state="open"][role="alertdialog"]',
          '[data-radix-popper-content-wrapper] [data-state="open"]',
        ].join(', ')
      );

    const reset = () => {
      if (body.style.pointerEvents === "none" && !hasOpenRadixOverlay()) {
        body.style.removeProperty("pointer-events");
      }
    };

    const observer = new MutationObserver(() => {
      // in den nächsten Frame verschieben, damit Radix erst fertig cleanup'en kann
      requestAnimationFrame(reset);
    });
    observer.observe(body, { attributes: true, attributeFilter: ["style"] });

    const onVisible = () => reset();
    window.addEventListener("pagehide", onVisible);
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    document.addEventListener("pointerdown", onVisible, true);
    document.addEventListener("click", onVisible, true);

    // Sicherheitsnetz: alle 1s prüfen (sehr billig).
    const interval = window.setInterval(reset, 1000);
    reset();

    return () => {
      observer.disconnect();
      window.removeEventListener("pagehide", onVisible);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
      document.removeEventListener("pointerdown", onVisible, true);
      document.removeEventListener("click", onVisible, true);
      window.clearInterval(interval);
    };
  }, []);
}

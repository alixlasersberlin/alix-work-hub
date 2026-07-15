import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Bekannter Radix-UI-Bug (Dialog/Select/Popover/DropdownMenu/Sheet):
 * Wird ein Overlay während einer Navigation / eines schnellen Klicks
 * unmountet, bleibt `document.body.style.pointer-events = "none"`
 * hängen. Danach wirken alle Klicks außerhalb von Portalen wie
 * "tot" – die Seite ist eingefroren, bis der User neu lädt.
 *
 * Strategie: pointer-events auf <body> aggressiv zurücksetzen.
 * - Sofort bei Route-Wechsel
 * - Bei pointerdown / click / focus / visibilitychange (Capture)
 * - Alle 500 ms als Sicherheitsnetz
 * Falls ein Overlay wirklich noch offen ist, setzt Radix das Attribut
 * selbst wieder – ohne Nachteil, da Radix bei jedem Mount neu schreibt.
 */
export function useRadixBodyPointerEventsFix() {
  const location = useLocation();

  useEffect(() => {
    const body = document.body;
    const clear = () => {
      if (body.style.pointerEvents === "none") {
        body.style.removeProperty("pointer-events");
      }
    };

    // Route-Wechsel: sofort + kurz danach (nach Radix-Cleanup-Frame)
    clear();
    const raf = requestAnimationFrame(clear);
    const t = window.setTimeout(clear, 150);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
  }, [location.pathname]);

  useEffect(() => {
    const body = document.body;
    const clear = () => {
      if (body.style.pointerEvents === "none") {
        body.style.removeProperty("pointer-events");
      }
    };

    window.addEventListener("pagehide", clear);
    window.addEventListener("focus", clear);
    document.addEventListener("visibilitychange", clear);
    document.addEventListener("pointerdown", clear, true);
    document.addEventListener("click", clear, true);
    document.addEventListener("keydown", clear, true);

    // Sicherheitsnetz alle 500 ms
    const interval = window.setInterval(clear, 500);

    return () => {
      window.removeEventListener("pagehide", clear);
      window.removeEventListener("focus", clear);
      document.removeEventListener("visibilitychange", clear);
      document.removeEventListener("pointerdown", clear, true);
      document.removeEventListener("click", clear, true);
      document.removeEventListener("keydown", clear, true);
      window.clearInterval(interval);
    };
  }, []);
}

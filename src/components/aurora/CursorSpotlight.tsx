import { useEffect } from "react";

/**
 * Aurora 2.0 — Cursor Spotlight Tracker
 * Sets --a2-mx / --a2-my CSS vars on hovered cards so the radial glow
 * defined in aurora2.css follows the mouse pointer. Zero-cost when
 * Aurora 2.0 is not active.
 */
export function CursorSpotlight() {
  useEffect(() => {
    const root = document.documentElement;
    const isActive = () => root.getAttribute("data-aurora") === "2";

    const handler = (e: MouseEvent) => {
      if (!isActive()) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const card = target.closest<HTMLElement>('[class*="card"]');
      if (!card) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty("--a2-mx", `${e.clientX - rect.left}px`);
      card.style.setProperty("--a2-my", `${e.clientY - rect.top}px`);
    };

    window.addEventListener("mousemove", handler, { passive: true });
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  return null;
}

export default CursorSpotlight;

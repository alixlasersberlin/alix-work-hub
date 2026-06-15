import { useEffect, useRef } from "react";

/**
 * Phase I-12: AI Background Engine
 *
 * Subtle generative canvas backdrop that reacts to time of day and
 * respects reduced-motion. Renders behind everything (z-index -1),
 * never blocks pointer events, and is opt-in via [data-ai-bg="on"]
 * on <html>. Disabled automatically when reduced motion is set.
 */
export const AIBackground = () => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (root.getAttribute("data-a11y-motion") === "reduced") return;
    if (root.getAttribute("data-ai-bg") !== "on") return;

    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);

    const onResize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", onResize);

    // Time-of-day palette: morning -> day -> evening -> night
    const palette = () => {
      const hr = new Date().getHours();
      if (hr < 6) return ["#0b0f1e", "#1a1330", "#2b1d4a"];
      if (hr < 11) return ["#1b1407", "#3a2410", "#6b4416"];
      if (hr < 17) return ["#0e1320", "#1a2342", "#2a3a6b"];
      if (hr < 21) return ["#1f0c1a", "#3b1230", "#6b1f4a"];
      return ["#06070d", "#0d1024", "#1a1f3d"];
    };

    const blobs = Array.from({ length: 4 }).map((_, i) => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 280 + Math.random() * 260,
      dx: (Math.random() - 0.5) * 0.15,
      dy: (Math.random() - 0.5) * 0.15,
      c: palette()[i % 3],
    }));

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      for (const b of blobs) {
        b.x += b.dx;
        b.y += b.dy;
        if (b.x < -b.r || b.x > w + b.r) b.dx *= -1;
        if (b.y < -b.r || b.y > h + b.r) b.dy *= -1;
        const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
        g.addColorStop(0, b.c + "cc");
        g.addColorStop(1, b.c + "00");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        zIndex: -1,
        pointerEvents: "none",
        opacity: 0.55,
        filter: "blur(40px) saturate(120%)",
      }}
    />
  );
};

export default AIBackground;

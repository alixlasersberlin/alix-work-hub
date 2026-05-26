import { useEffect } from 'react';
import { useDesignVariant } from '@/hooks/useDesignVariant';

/**
 * Aurora Spotlight – cursor-gesteuerter Lichtkegel + Tilt-Reaktion auf Cards.
 * Aktiv nur im Aurora-Theme. Respektiert prefers-reduced-motion und coarse pointers.
 */
export default function AuroraSpotlight() {
  const { variant } = useDesignVariant();

  useEffect(() => {
    if (variant !== 'aurora') return;
    if (typeof window === 'undefined') return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    if (reduce || coarse) return;

    const root = document.documentElement;
    root.classList.add('aurora-spotlight-on');

    let rafId = 0;
    let px = window.innerWidth / 2;
    let py = window.innerHeight / 2;
    let tx = px;
    let ty = py;

    const onMove = (e: MouseEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      if (!rafId) rafId = requestAnimationFrame(tick);
    };

    const tick = () => {
      px += (tx - px) * 0.18;
      py += (ty - py) * 0.18;
      root.style.setProperty('--aurora-mx', `${px}px`);
      root.style.setProperty('--aurora-my', `${py}px`);
      if (Math.abs(tx - px) > 0.5 || Math.abs(ty - py) > 0.5) {
        rafId = requestAnimationFrame(tick);
      } else {
        rafId = 0;
      }
    };

    window.addEventListener('mousemove', onMove, { passive: true });

    return () => {
      window.removeEventListener('mousemove', onMove);
      if (rafId) cancelAnimationFrame(rafId);
      root.classList.remove('aurora-spotlight-on');
      root.style.removeProperty('--aurora-mx');
      root.style.removeProperty('--aurora-my');
    };
  }, [variant]);

  return null;
}

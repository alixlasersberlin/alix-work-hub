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

    // Card tilt (sehr dezent)
    const onCardMove = (e: MouseEvent) => {
      const card = (e.target as HTMLElement)?.closest<HTMLElement>('.bg-card');
      if (!card) return;
      const r = card.getBoundingClientRect();
      const cx = (e.clientX - r.left) / r.width - 0.5;
      const cy = (e.clientY - r.top) / r.height - 0.5;
      card.style.setProperty('--tilt-x', `${(-cy * 4).toFixed(2)}deg`);
      card.style.setProperty('--tilt-y', `${(cx * 4).toFixed(2)}deg`);
      card.style.setProperty('--shine-x', `${((e.clientX - r.left) / r.width) * 100}%`);
      card.style.setProperty('--shine-y', `${((e.clientY - r.top) / r.height) * 100}%`);
      card.classList.add('aurora-tilt');
    };
    const onCardLeave = (e: MouseEvent) => {
      const card = (e.target as HTMLElement)?.closest<HTMLElement>('.bg-card');
      if (!card) return;
      card.style.removeProperty('--tilt-x');
      card.style.removeProperty('--tilt-y');
      card.classList.remove('aurora-tilt');
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mousemove', onCardMove, { passive: true });
    document.addEventListener('mouseout', onCardLeave, { passive: true });

    return () => {
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('mousemove', onCardMove);
      document.removeEventListener('mouseout', onCardLeave);
      if (rafId) cancelAnimationFrame(rafId);
      root.classList.remove('aurora-spotlight-on');
      root.style.removeProperty('--aurora-mx');
      root.style.removeProperty('--aurora-my');
    };
  }, [variant]);

  return null;
}

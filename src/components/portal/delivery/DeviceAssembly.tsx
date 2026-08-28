import { cn } from '@/lib/utils';
import type { DjStep } from '@/lib/portal/delivery-types';

/**
 * Technische Geräteanimation: Module (Gehäuse, Elektronik, Laserquelle, Kühlung,
 * Handstück, Software) erscheinen nacheinander und setzen sich zum Gerät zusammen.
 * Bei aktiver Qualitätsprüfung wandert ein Prüfimpuls durch das Gerät.
 */
export function DeviceAssembly({
  steps,
  scanning,
}: {
  steps: DjStep[];
  scanning?: boolean;
}) {
  const state = (key: string) => steps.find((s) => s.key.includes(key))?.status ?? 'pending';
  const cls = (key: string, delay: number) => {
    const st = state(key);
    return {
      className: cn(
        'transition-all duration-700 dj-rise',
        st === 'done' && 'opacity-100',
        st === 'active' && 'opacity-90',
        st === 'pending' && 'opacity-20',
      ),
      style: { animationDelay: `${delay}ms` } as React.CSSProperties,
    };
  };

  return (
    <div className="relative w-full max-w-sm mx-auto aspect-[4/3] select-none">
      <svg viewBox="0 0 200 150" className="w-full h-full">
        {/* Gehäuse */}
        <g {...cls('housing', 0)}>
          <rect x="52" y="26" width="96" height="102" rx="10"
            className="fill-muted/40 stroke-primary/60" strokeWidth="1.5" />
        </g>
        {/* Elektronik */}
        <g {...cls('electronics', 150)}>
          <rect x="64" y="40" width="72" height="22" rx="3" className="fill-primary/10 stroke-primary/50" strokeWidth="1" />
          <path d="M68 51h18M92 44v14M100 51h32" className="stroke-primary/60" strokeWidth="1" fill="none" />
        </g>
        {/* Kühlsystem */}
        <g {...cls('cooling', 300)}>
          <rect x="64" y="68" width="34" height="26" rx="3" className="fill-sky-500/10 stroke-sky-400/60" strokeWidth="1" />
          <path d="M68 74h26M68 80h26M68 86h26" className="stroke-sky-400/60" strokeWidth="1" />
        </g>
        {/* Laserquelle */}
        <g {...cls('laser', 450)}>
          <rect x="104" y="68" width="32" height="26" rx="3" className="fill-primary/15 stroke-primary/70" strokeWidth="1" />
          <circle cx="120" cy="81" r="6" className="fill-primary/40 stroke-primary" strokeWidth="1" />
        </g>
        {/* Handstück */}
        <g {...cls('handpiece', 600)}>
          <rect x="150" y="60" width="10" height="34" rx="5" className="fill-muted stroke-foreground/40" strokeWidth="1" />
          <path d="M155 60V46h18" className="stroke-foreground/40" strokeWidth="1.5" fill="none" />
        </g>
        {/* Software / Display */}
        <g {...cls('software', 750)}>
          <rect x="64" y="100" width="72" height="18" rx="3" className="fill-foreground/5 stroke-primary/40" strokeWidth="1" />
          <path d="M70 109h20M96 109h34" className="stroke-primary/50" strokeWidth="1" />
        </g>
        {/* Standfuß / Endmontage */}
        <g {...cls('assembly', 900)}>
          <path d="M78 128v10h44v-10" className="stroke-primary/50" strokeWidth="1.5" fill="none" />
        </g>
      </svg>
      {scanning && <div className="dj-scan-line rounded-xl" />}
    </div>
  );
}

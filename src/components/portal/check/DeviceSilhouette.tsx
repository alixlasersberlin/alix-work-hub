/** Stilisierte 3D-artige ALIX Gerätesilhouette aus Linien (rein SVG/CSS). */
export function DeviceSilhouette({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 200"
      className={`dc-silhouette w-full h-full text-primary ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Basis (Isometrie) */}
      <path d="M60 168 L120 190 L180 168 L120 148 Z" opacity="0.55" style={{ ['--dc-dash' as string]: 260 }} />
      {/* Säule */}
      <path d="M108 148 L108 96 L132 88 L132 140 Z" style={{ ['--dc-dash' as string]: 240 }} />
      <path d="M108 96 L96 90 L120 82 L132 88" opacity="0.7" style={{ ['--dc-dash' as string]: 140 }} />
      {/* Kopfeinheit */}
      <path d="M74 74 L120 56 L166 74 L120 92 Z" style={{ ['--dc-dash' as string]: 260 }} />
      <path d="M74 74 L74 60 L120 42 L166 60 L166 74" opacity="0.8" style={{ ['--dc-dash' as string]: 240 }} />
      <path d="M120 42 L120 56" opacity="0.6" style={{ ['--dc-dash' as string]: 40 }} />
      {/* Display */}
      <path d="M148 108 L188 92 L188 118 L148 134 Z" opacity="0.75" style={{ ['--dc-dash' as string]: 200 }} />
      <path d="M156 114 L180 104" opacity="0.5" style={{ ['--dc-dash' as string]: 40 }} />
      <path d="M156 122 L172 116" opacity="0.5" style={{ ['--dc-dash' as string]: 30 }} />
      {/* Strahl-Andeutung */}
      <path d="M120 92 L120 130" opacity="0.35" style={{ ['--dc-dash' as string]: 60 }} />
      <circle cx="120" cy="136" r="6" opacity="0.5" style={{ ['--dc-dash' as string]: 60 }} />
      <circle cx="120" cy="136" r="14" opacity="0.22" style={{ ['--dc-dash' as string]: 110 }} />
    </svg>
  );
}

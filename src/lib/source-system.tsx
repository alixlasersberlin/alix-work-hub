/**
 * Anzeige-Label & Flagge für Zoho-Quellsysteme.
 * Wird in Filtern und Tabellen verwendet, damit zoho_eu_1 / zoho_eu_2
 * als „Alix Deutschland" bzw. „Alix Austria" mit Landesflagge erscheinen.
 */

export type SourceSystem = 'zoho_eu_1' | 'zoho_eu_2' | (string & {});

export function sourceLabel(source?: string | null): string {
  switch (source) {
    case 'zoho_eu_1': return 'Alix Deutschland';
    case 'zoho_eu_2': return 'Alix Austria';
    default: return source || '—';
  }
}

export function sourceFlag(source?: string | null): string {
  switch (source) {
    case 'zoho_eu_1': return '🇩🇪';
    case 'zoho_eu_2': return '🇦🇹';
    default: return '';
  }
}

interface BadgeProps {
  source?: string | null;
  className?: string;
  withFlag?: boolean;
}

export function SourceBadge({ source, className, withFlag = true }: BadgeProps) {
  const label = sourceLabel(source);
  const flag = withFlag ? sourceFlag(source) : '';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent-foreground ${className || ''}`}>
      {flag && <span aria-hidden className="text-sm leading-none">{flag}</span>}
      <span>{label}</span>
    </span>
  );
}

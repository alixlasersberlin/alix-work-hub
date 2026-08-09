import { useTenant } from '@/contexts/TenantContext';
import { cn } from '@/lib/utils';

interface Props {
  /** Zoho source_system (z. B. "zoho_eu_1") oder Mandanten-Code (z. B. "AT") */
  source?: string | null;
  tenantId?: string | null;
  className?: string;
  size?: 'sm' | 'md';
}

/** Kompaktes Mandanten-Badge (Flagge + Name) für Listen und Detailansichten. */
export function TenantBadge({ source, tenantId, className, size = 'sm' }: Props) {
  const { tenants } = useTenant();
  if (!source && !tenantId) return null;

  const t = tenants.find(
    (x) =>
      (tenantId && x.id === tenantId) ||
      (source && (x.zoho_source_system === source || x.code === source)),
  );
  if (!t) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 font-medium text-muted-foreground',
        size === 'sm' ? 'text-[10px]' : 'text-xs',
        className,
      )}
      title={t.name}
    >
      {t.flag_emoji && <span aria-hidden>{t.flag_emoji}</span>}
      <span>{t.code}</span>
    </span>
  );
}

export default TenantBadge;

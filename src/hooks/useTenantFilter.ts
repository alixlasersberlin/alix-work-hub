import { useCallback, useMemo } from 'react';
import { useTenant } from '@/contexts/TenantContext';

/**
 * Globaler Mandanten-Filter.
 * - `tenantId`: aktuell gewählter Mandant (null = Alix World / Konzernsicht)
 * - `apply(query)`: hängt bei gewähltem Mandanten `.eq('tenant_id', ...)` an eine Supabase-Query
 * - `matches(id)`: Client-seitige Prüfung für bereits geladene Datensätze
 */
export function useTenantFilter(column = 'tenant_id') {
  const { current, allowedTenants, loading } = useTenant();
  const tenantId = current?.id ?? null;
  const tenantCode = current?.code ?? null;

  const allowedIds = useMemo(() => allowedTenants.map((t) => t.id), [allowedTenants]);

  const apply = useCallback(
    <T extends { eq: (c: string, v: any) => T }>(query: T): T =>
      tenantId ? query.eq(column, tenantId) : query,
    [tenantId, column],
  );

  const matches = useCallback(
    (id?: string | null) => !tenantId || !id || id === tenantId,
    [tenantId],
  );

  return { tenantId, tenantCode, allowedIds, apply, matches, loading };
}

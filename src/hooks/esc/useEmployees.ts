import { useCallback } from 'react';
import { MOCK_EMPLOYEES } from '@/lib/esc/mock-data';
import type { EscEmployee } from '@/lib/esc/types';
import { useEscStore } from '@/lib/esc/store/kvStore';

export function useEmployees() {
  const { items, upsert, remove } = useEscStore<EscEmployee>({
    table: 'esc_store_employees',
    getId: (e) => e.id,
    seed: MOCK_EMPLOYEES,
    legacyLsKeys: ['esc.employees.v1', 'esc.employees.v2'],
  });

  const upsertEmployee = useCallback(async (e: Partial<EscEmployee> & { id?: string; name: string; email: string; role: string; departmentIds: string[] }) => {
    const existing = e.id ? items.find((x) => x.id === e.id) : undefined;
    const item: EscEmployee = existing
      ? ({ ...existing, ...e } as EscEmployee)
      : ({ active: true, publicBookable: false, ...e, id: e.id || crypto.randomUUID() } as EscEmployee);
    await upsert(item);
  }, [items, upsert]);

  const deleteEmployee = useCallback(async (id: string) => { await remove(id); }, [remove]);

  return { employees: items, upsertEmployee, deleteEmployee };
}

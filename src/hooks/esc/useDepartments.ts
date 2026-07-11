import { useCallback } from 'react';
import { MOCK_DEPARTMENTS } from '@/lib/esc/mock-data';
import type { EscDepartment } from '@/lib/esc/types';
import { useEscStore } from '@/lib/esc/store/kvStore';

export function useDepartments() {
  const { items, upsert, remove } = useEscStore<EscDepartment>({
    table: 'esc_store_departments',
    getId: (d) => d.id,
    seed: MOCK_DEPARTMENTS,
    legacyLsKeys: ['esc.departments.v2'],
  });

  const createDepartment = useCallback(async (d: Omit<EscDepartment, 'id'>) => {
    const item: EscDepartment = { ...d, id: crypto.randomUUID() } as EscDepartment;
    await upsert(item);
    return item;
  }, [upsert]);

  const updateDepartment = useCallback(async (id: string, patch: Partial<EscDepartment>) => {
    const cur = items.find((x) => x.id === id);
    if (!cur) return;
    await upsert({ ...cur, ...patch });
  }, [items, upsert]);

  const deleteDepartment = useCallback(async (id: string) => { await remove(id); }, [remove]);

  return { departments: items, createDepartment, updateDepartment, deleteDepartment };
}

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { EscResource } from '@/lib/esc/types';
import { toast } from 'sonner';

type Row = {
  id: string;
  name: string;
  resource_type: string;
  location: string | null;
  capacity: number | null;
  is_active: boolean;
};

const rowToResource = (r: Row): EscResource => ({
  id: r.id,
  name: r.name,
  type: (r.resource_type as EscResource['type']) || 'other',
  location: r.location || undefined,
  capacity: r.capacity ?? undefined,
  active: !!r.is_active,
});

export function useResources() {
  const [resources, setResources] = useState<EscResource[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('esc_resources')
      .select('id, name, resource_type, location, capacity, is_active')
      .order('name', { ascending: true });
    if (error) {
      toast.error('Ressourcen konnten nicht geladen werden');
      setResources([]);
    } else {
      setResources(((data as Row[]) || []).map(rowToResource));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const upsertResource = useCallback(async (r: Partial<EscResource> & { name: string; type: EscResource['type'] }) => {
    const payload: any = {
      name: r.name,
      resource_type: r.type,
      location: r.location || null,
      capacity: r.capacity ?? null,
      is_active: r.active ?? true,
    };
    if (r.id) {
      const { error } = await supabase.from('esc_resources').update(payload).eq('id', r.id);
      if (error) { toast.error(`Speichern fehlgeschlagen: ${error.message}`); return; }
    } else {
      const { error } = await supabase.from('esc_resources').insert(payload);
      if (error) { toast.error(`Anlegen fehlgeschlagen: ${error.message}`); return; }
    }
    await load();
  }, [load]);

  const deleteResource = useCallback(async (id: string) => {
    const { error } = await supabase.from('esc_resources').delete().eq('id', id);
    if (error) { toast.error(`Löschen fehlgeschlagen: ${error.message}`); return; }
    await load();
  }, [load]);

  return { resources, loading, upsertResource, deleteResource, reload: load };
}

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Loader2, Plus, Save, Trash2, Tags } from 'lucide-react';
import { toast } from 'sonner';

type Cat = { id?: string; tenant_id: string; name: string; sort_order: number; is_active: boolean };

/** Verwaltung der Artikelkategorien im Mandanten CMR. */
export default function CmrCategories({ tenantId, onChanged }: { tenantId: string | null; onChanged?: () => void }) {
  const [rows, setRows] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data } = await supabase.from('cmr_item_categories' as any)
      .select('*').eq('tenant_id', tenantId).order('sort_order');
    setRows(((data as any) || []) as Cat[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [tenantId]);

  const add = () => {
    if (!tenantId) return;
    setRows([...rows, { tenant_id: tenantId, name: '', sort_order: rows.length + 1, is_active: true }]);
  };

  const patch = (i: number, p: Partial<Cat>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));

  const saveRow = async (i: number) => {
    const r = rows[i];
    if (!tenantId) return;
    if (!r.name.trim()) { toast.error('Bitte einen Namen angeben.'); return; }
    setSavingKey(r.id ?? `new-${i}`);
    const payload: any = { tenant_id: tenantId, name: r.name, sort_order: Number(r.sort_order) || 0, is_active: !!r.is_active };
    const { error } = r.id
      ? await supabase.from('cmr_item_categories' as any).update(payload).eq('id', r.id)
      : await supabase.from('cmr_item_categories' as any).insert(payload);
    setSavingKey(null);
    if (error) { toast.error(error.message); return; }
    toast.success('Kategorie gespeichert');
    load(); onChanged?.();
  };

  const remove = async (i: number) => {
    const r = rows[i];
    if (r.id) {
      const { error } = await supabase.from('cmr_item_categories' as any).delete().eq('id', r.id);
      if (error) { toast.error(error.message); return; }
      onChanged?.();
    }
    setRows(rows.filter((_, j) => j !== i));
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold flex items-center gap-2"><Tags className="w-4 h-4" /> Artikelkategorien</div>
        <Button size="sm" variant="outline" onClick={add}><Plus className="w-3.5 h-3.5 mr-1" /> Kategorie</Button>
      </div>

      {loading && <div className="py-4 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>}
      {!loading && rows.length === 0 && <div className="text-sm text-muted-foreground">Noch keine Kategorien angelegt.</div>}

      {rows.map((r, i) => (
        <div key={r.id ?? `new-${i}`} className="flex flex-wrap items-center gap-2">
          <Input className="flex-1 min-w-[180px]" placeholder="Name" value={r.name} onChange={(e) => patch(i, { name: e.target.value })} />
          <Input className="w-24" type="number" placeholder="Sort." value={r.sort_order} onChange={(e) => patch(i, { sort_order: Number(e.target.value) })} />
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch checked={!!r.is_active} onCheckedChange={(v) => patch(i, { is_active: v })} /> aktiv
          </label>
          <Button size="icon" variant="ghost" onClick={() => remove(i)}><Trash2 className="w-4 h-4" /></Button>
          <Button size="sm" onClick={() => saveRow(i)} disabled={savingKey === (r.id ?? `new-${i}`)}>
            {savingKey === (r.id ?? `new-${i}`) ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />} Speichern
          </Button>
        </div>
      ))}
    </Card>
  );
}

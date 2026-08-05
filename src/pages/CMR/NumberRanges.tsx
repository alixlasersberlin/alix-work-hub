import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { CMR_DOC_TYPES } from '@/hooks/useCmrTenant';

type Range = {
  id?: string; tenant_id: string; doc_type: string; prefix: string;
  year: number; next_number: number; padding: number;
};

export default function CmrNumberRanges({ tenantId }: { tenantId: string | null }) {
  const [rows, setRows] = useState<Range[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data } = await supabase
      .from('cmr_number_ranges' as any)
      .select('*').eq('tenant_id', tenantId).order('doc_type');
    setRows(((data as any) || []) as Range[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [tenantId]);

  const addRange = () => {
    if (!tenantId) return;
    const used = new Set(rows.map((r) => r.doc_type));
    const next = CMR_DOC_TYPES.find((t) => !used.has(t.value)) ?? CMR_DOC_TYPES[0];
    setRows([...rows, {
      tenant_id: tenantId, doc_type: next.value, prefix: 'CMR-',
      year: new Date().getFullYear(), next_number: 1, padding: 6,
    }]);
  };

  const saveRow = async (idx: number) => {
    const r = rows[idx];
    if (!tenantId) return;
    setSavingKey(r.id ?? `new-${idx}`);
    const payload: any = {
      tenant_id: tenantId, doc_type: r.doc_type, prefix: r.prefix,
      year: Number(r.year) || new Date().getFullYear(),
      next_number: Number(r.next_number) || 1,
      padding: Number(r.padding) || 6,
    };
    const { error } = r.id
      ? await supabase.from('cmr_number_ranges' as any).update(payload).eq('id', r.id)
      : await supabase.from('cmr_number_ranges' as any).insert(payload);
    setSavingKey(null);
    if (error) { toast.error(error.message); return; }
    toast.success('Nummernkreis gespeichert');
    load();
  };

  const removeRow = async (idx: number) => {
    const r = rows[idx];
    if (r.id) {
      const { error } = await supabase.from('cmr_number_ranges' as any).delete().eq('id', r.id);
      if (error) { toast.error(error.message); return; }
    }
    setRows(rows.filter((_, i) => i !== idx));
  };

  const patch = (idx: number, p: Partial<Range>) =>
    setRows(rows.map((r, i) => (i === idx ? { ...r, ...p } : r)));

  const preview = (r: Range) =>
    `${r.prefix ?? ''}${r.year}-${String(r.next_number ?? 1).padStart(Number(r.padding) || 6, '0')}`;

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Nummernkreise</div>
          <div className="text-xs text-muted-foreground">Je Belegart eigener Kreis – gilt nur für den Mandanten CMR.</div>
        </div>
        <Button size="sm" variant="outline" onClick={addRange}><Plus className="w-3.5 h-3.5 mr-1" /> Nummernkreis</Button>
      </div>

      {loading && <div className="py-6 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>}
      {!loading && rows.length === 0 && (
        <div className="text-sm text-muted-foreground py-4">Noch keine Nummernkreise angelegt.</div>
      )}

      {rows.map((r, idx) => (
        <div key={r.id ?? `new-${idx}`} className="rounded-lg border p-3 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <Label>Belegart</Label>
              <select
                className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={r.doc_type} onChange={(e) => patch(idx, { doc_type: e.target.value })}
              >
                {CMR_DOC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div><Label>Präfix</Label><Input value={r.prefix ?? ''} onChange={(e) => patch(idx, { prefix: e.target.value })} /></div>
            <div><Label>Jahr</Label><Input type="number" value={r.year} onChange={(e) => patch(idx, { year: Number(e.target.value) })} /></div>
            <div><Label>Nächste Nr.</Label><Input type="number" value={r.next_number} onChange={(e) => patch(idx, { next_number: Number(e.target.value) })} /></div>
            <div><Label>Stellen</Label><Input type="number" value={r.padding} onChange={(e) => patch(idx, { padding: Number(e.target.value) })} /></div>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">Vorschau: <span className="font-mono text-foreground">{preview(r)}</span></div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => removeRow(idx)}><Trash2 className="w-4 h-4" /></Button>
              <Button size="sm" onClick={() => saveRow(idx)} disabled={savingKey === (r.id ?? `new-${idx}`)}>
                {savingKey === (r.id ?? `new-${idx}`) ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />} Speichern
              </Button>
            </div>
          </div>
        </div>
      ))}
    </Card>
  );
}

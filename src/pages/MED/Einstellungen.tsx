import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMedTenant, medDocLabel } from '@/hooks/useMedTenant';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export default function MedEinstellungen() {
  const { tenantId, canWrite, loading } = useMedTenant();
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);

  const load = async () => {
    if (!tenantId) return;
    setBusy(true);
    const { data } = await supabase.from('med_number_ranges' as any)
      .select('*').eq('tenant_id', tenantId).order('doc_type');
    setRows(((data as any) || []) as any[]);
    setBusy(false);
  };

  useEffect(() => { load(); }, [tenantId]);

  const save = async (r: any) => {
    const { error } = await supabase.from('med_number_ranges' as any).update({
      prefix: r.prefix, padding: Number(r.padding), next_number: Number(r.next_number),
    } as any).eq('id', r.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Nummernkreis gespeichert');
  };

  if (loading) return <div className="p-6"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  return (
    <div className="p-4 lg:p-6 space-y-4 animate-fade-in">
      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">⚕️ Alix Medical</div>
        <h1 className="text-2xl font-display font-bold">Einstellungen · Nummernkreise</h1>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left p-3">Belegart</th>
              <th className="text-left p-3">Präfix</th>
              <th className="text-left p-3">Jahr</th>
              <th className="text-left p-3">Stellen</th>
              <th className="text-left p-3">Nächste Nr.</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {busy && <tr><td colSpan={6} className="p-6 text-center"><Loader2 className="w-4 h-4 animate-spin inline" /></td></tr>}
            {!busy && rows.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Keine Nummernkreise</td></tr>}
            {rows.map((r, idx) => (
              <tr key={r.id} className="border-t border-border">
                <td className="p-3">{medDocLabel(r.doc_type)}</td>
                <td className="p-3"><Input disabled={!canWrite} value={r.prefix} className="h-8 w-28"
                  onChange={e => setRows(rows.map((x, i) => i === idx ? { ...x, prefix: e.target.value } : x))} /></td>
                <td className="p-3">{r.year}</td>
                <td className="p-3"><Input disabled={!canWrite} type="number" value={r.padding} className="h-8 w-20"
                  onChange={e => setRows(rows.map((x, i) => i === idx ? { ...x, padding: e.target.value } : x))} /></td>
                <td className="p-3"><Input disabled={!canWrite} type="number" value={r.next_number} className="h-8 w-24"
                  onChange={e => setRows(rows.map((x, i) => i === idx ? { ...x, next_number: e.target.value } : x))} /></td>
                <td className="p-3 text-right">{canWrite && <Button size="sm" onClick={() => save(r)}>Speichern</Button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

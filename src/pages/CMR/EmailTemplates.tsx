import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { CMR_DOC_TYPES } from '@/hooks/useCmrTenant';

type Tpl = {
  id?: string; tenant_id: string; key: string; name: string;
  subject: string; body_html: string; is_active: boolean;
};

const VARS = ['{{doc_number}}', '{{doc_type}}', '{{customer_name}}', '{{total}}', '{{company}}'];

export default function CmrEmailTemplates({ tenantId }: { tenantId: string | null }) {
  const [rows, setRows] = useState<Tpl[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data } = await supabase
      .from('cmr_email_templates' as any)
      .select('*').eq('tenant_id', tenantId).order('name');
    setRows(((data as any) || []) as Tpl[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [tenantId]);

  const addTemplate = () => {
    if (!tenantId) return;
    const used = new Set(rows.map((r) => r.key));
    const next = CMR_DOC_TYPES.find((t) => !used.has(t.value)) ?? CMR_DOC_TYPES[0];
    setRows([...rows, {
      tenant_id: tenantId, key: next.value, name: `${next.label} – Standard`,
      subject: `${next.label} {{doc_number}} – {{company}}`,
      body_html: `Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie ${next.label} {{doc_number}} über {{total}}.\n\nMit freundlichen Grüßen`,
      is_active: true,
    }]);
  };

  const saveRow = async (idx: number) => {
    const row = rows[idx];
    if (!tenantId) return;
    setSavingKey(row.id ?? `new-${idx}`);
    const payload: any = {
      tenant_id: tenantId, key: row.key, name: row.name,
      subject: row.subject, body_html: row.body_html, is_active: row.is_active,
    };
    const { error } = row.id
      ? await supabase.from('cmr_email_templates' as any).update(payload).eq('id', row.id)
      : await supabase.from('cmr_email_templates' as any).insert(payload);
    setSavingKey(null);
    if (error) { toast.error(error.message); return; }
    toast.success('Vorlage gespeichert');
    load();
  };

  const removeRow = async (idx: number) => {
    const row = rows[idx];
    if (row.id) {
      const { error } = await supabase.from('cmr_email_templates' as any).delete().eq('id', row.id);
      if (error) { toast.error(error.message); return; }
    }
    setRows(rows.filter((_, i) => i !== idx));
  };

  const patch = (idx: number, p: Partial<Tpl>) =>
    setRows(rows.map((r, i) => (i === idx ? { ...r, ...p } : r)));

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">E-Mail-Vorlagen</div>
          <div className="text-xs text-muted-foreground">Platzhalter: {VARS.join(' · ')}</div>
        </div>
        <Button size="sm" variant="outline" onClick={addTemplate}><Plus className="w-3.5 h-3.5 mr-1" /> Vorlage</Button>
      </div>

      {loading && <div className="py-6 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>}
      {!loading && rows.length === 0 && (
        <div className="text-sm text-muted-foreground py-4">Noch keine Vorlagen – beim Versand werden Standardtexte genutzt.</div>
      )}

      {rows.map((r, idx) => (
        <div key={r.id ?? `new-${idx}`} className="rounded-lg border p-3 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Belegart</Label>
              <select
                className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={r.key} onChange={(e) => patch(idx, { key: e.target.value })}
              >
                {CMR_DOC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div><Label>Bezeichnung</Label><Input value={r.name} onChange={(e) => patch(idx, { name: e.target.value })} /></div>
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 text-sm h-10">
                <input type="checkbox" checked={r.is_active} onChange={(e) => patch(idx, { is_active: e.target.checked })} />
                Aktiv
              </label>
            </div>
          </div>
          <div><Label>Betreff</Label><Input value={r.subject} onChange={(e) => patch(idx, { subject: e.target.value })} /></div>
          <div><Label>Nachricht</Label><Textarea rows={5} value={r.body_html} onChange={(e) => patch(idx, { body_html: e.target.value })} /></div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => removeRow(idx)}><Trash2 className="w-4 h-4" /></Button>
            <Button size="sm" onClick={() => saveRow(idx)} disabled={savingKey === (r.id ?? `new-${idx}`)}>
              {savingKey === (r.id ?? `new-${idx}`) ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />} Speichern
            </Button>
          </div>
        </div>
      ))}
    </Card>
  );
}

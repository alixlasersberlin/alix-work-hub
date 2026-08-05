import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Loader2, Plus, Save, Trash2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { CMR_DOC_TYPES } from '@/hooks/useCmrTenant';

type Tpl = {
  id?: string; tenant_id: string; doc_type: string; name: string;
  header_html: string | null; body_html: string | null; footer_html: string | null;
  accent_color: string | null; font_family: string | null;
  logo_url: string | null; watermark_url: string | null;
  show_qr: boolean; is_default: boolean;
};

export default function CmrPdfTemplates({ tenantId }: { tenantId: string | null }) {
  const [rows, setRows] = useState<Tpl[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data } = await supabase
      .from('cmr_pdf_templates' as any)
      .select('*').eq('tenant_id', tenantId).order('doc_type');
    setRows(((data as any) || []) as Tpl[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [tenantId]);

  const addTpl = () => {
    if (!tenantId) return;
    const used = new Set(rows.map((r) => r.doc_type));
    const next = CMR_DOC_TYPES.find((t) => !used.has(t.value)) ?? CMR_DOC_TYPES[0];
    setRows([...rows, {
      tenant_id: tenantId, doc_type: next.value, name: `Vorlage ${next.label}`,
      header_html: '', body_html: '', footer_html: '',
      accent_color: '#C9A227', font_family: 'helvetica',
      logo_url: '', watermark_url: '', show_qr: false, is_default: true,
    }]);
  };

  const patch = (idx: number, p: Partial<Tpl>) =>
    setRows(rows.map((r, i) => (i === idx ? { ...r, ...p } : r)));

  const saveRow = async (idx: number) => {
    const r = rows[idx];
    if (!tenantId) return;
    setSavingKey(r.id ?? `new-${idx}`);
    const payload: any = {
      tenant_id: tenantId, doc_type: r.doc_type, name: r.name || 'Vorlage',
      header_html: r.header_html || null, body_html: r.body_html || null, footer_html: r.footer_html || null,
      accent_color: r.accent_color || null, font_family: r.font_family || null,
      logo_url: r.logo_url || null, watermark_url: r.watermark_url || null,
      show_qr: !!r.show_qr, is_default: !!r.is_default,
    };
    const { error } = r.id
      ? await supabase.from('cmr_pdf_templates' as any).update(payload).eq('id', r.id)
      : await supabase.from('cmr_pdf_templates' as any).insert(payload);
    setSavingKey(null);
    if (error) { toast.error(error.message); return; }
    toast.success('PDF-Vorlage gespeichert');
    load();
  };

  const removeRow = async (idx: number) => {
    const r = rows[idx];
    if (r.id) {
      const { error } = await supabase.from('cmr_pdf_templates' as any).delete().eq('id', r.id);
      if (error) { toast.error(error.message); return; }
    }
    setRows(rows.filter((_, i) => i !== idx));
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">PDF-Vorlagen</div>
          <div className="text-xs text-muted-foreground">
            Layout je Belegart – Akzentfarbe, Logo, Wasserzeichen sowie Kopf-, Text- und Fußbereich.
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={addTpl}><Plus className="w-3.5 h-3.5 mr-1" /> Vorlage</Button>
      </div>

      {loading && <div className="py-6 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>}
      {!loading && rows.length === 0 && (
        <div className="text-sm text-muted-foreground py-4 flex items-center gap-2">
          <FileText className="w-4 h-4" /> Noch keine PDF-Vorlagen angelegt.
        </div>
      )}

      {rows.map((r, idx) => (
        <div key={r.id ?? `new-${idx}`} className="rounded-lg border p-3 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <Label>Belegart</Label>
              <select
                className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={r.doc_type} onChange={(e) => patch(idx, { doc_type: e.target.value })}
              >
                {CMR_DOC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div><Label>Name</Label><Input value={r.name ?? ''} onChange={(e) => patch(idx, { name: e.target.value })} /></div>
            <div>
              <Label>Akzentfarbe</Label>
              <div className="flex gap-2">
                <Input value={r.accent_color ?? ''} onChange={(e) => patch(idx, { accent_color: e.target.value })} />
                <input
                  type="color" aria-label="Akzentfarbe wählen"
                  className="h-10 w-12 rounded-md border border-input bg-background"
                  value={/^#[0-9a-fA-F]{6}$/.test(r.accent_color ?? '') ? (r.accent_color as string) : '#C9A227'}
                  onChange={(e) => patch(idx, { accent_color: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Schriftart</Label>
              <select
                className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={r.font_family ?? 'helvetica'} onChange={(e) => patch(idx, { font_family: e.target.value })}
              >
                <option value="helvetica">Helvetica</option>
                <option value="times">Times</option>
                <option value="courier">Courier</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label>Logo-URL</Label><Input value={r.logo_url ?? ''} onChange={(e) => patch(idx, { logo_url: e.target.value })} /></div>
            <div><Label>Wasserzeichen-URL</Label><Input value={r.watermark_url ?? ''} onChange={(e) => patch(idx, { watermark_url: e.target.value })} /></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div><Label>Kopfbereich (HTML)</Label><Textarea rows={3} value={r.header_html ?? ''} onChange={(e) => patch(idx, { header_html: e.target.value })} /></div>
            <div><Label>Textbereich (HTML)</Label><Textarea rows={3} value={r.body_html ?? ''} onChange={(e) => patch(idx, { body_html: e.target.value })} /></div>
            <div><Label>Fußbereich (HTML)</Label><Textarea rows={3} value={r.footer_html ?? ''} onChange={(e) => patch(idx, { footer_html: e.target.value })} /></div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={!!r.is_default} onCheckedChange={(v) => patch(idx, { is_default: v })} />
                Standardvorlage
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={!!r.show_qr} onCheckedChange={(v) => patch(idx, { show_qr: v })} />
                QR-Code anzeigen
              </label>
            </div>
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

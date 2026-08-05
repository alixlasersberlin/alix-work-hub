import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Loader2, Plus, Save, Trash2, FileText, Upload, Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { generateCmrDocumentPdf, cmrFetchImage } from '@/lib/cmr-document-pdf';
import { toast } from 'sonner';
import { CMR_DOC_TYPES } from '@/hooks/useCmrTenant';

type Tpl = {
  id?: string; tenant_id: string; doc_type: string; name: string;
  header_html: string | null; body_html: string | null; footer_html: string | null;
  accent_color: string | null; font_family: string | null;
  logo_url: string | null; watermark_url: string | null;
  show_qr: boolean; is_default: boolean; language?: string | null;
};

const LANGS = [
  { value: 'de', label: 'Deutsch' },
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'العربية' },
  { value: 'fr', label: 'Français' },
];

export default function CmrPdfTemplates({ tenantId }: { tenantId: string | null }) {
  const [rows, setRows] = useState<Tpl[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const fileRef = useRef<{ idx: number; field: 'logo_url' | 'watermark_url' } | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const load = async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data } = await supabase
      .from('cmr_pdf_templates' as any)
      .select('*').eq('tenant_id', tenantId).order('doc_type');
    setRows(((data as any) || []) as Tpl[]);
    const { data: st } = await supabase.from('cmr_settings' as any).select('*').eq('tenant_id', tenantId).maybeSingle();
    setSettings(st ?? null);
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
      logo_url: '', watermark_url: '', show_qr: false, is_default: true, language: 'de',
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
      language: r.language || 'de',
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

  /** Lädt Logo/Wasserzeichen in den privaten Branding-Bucket und hinterlegt eine signierte URL. */
  const onPickFile = async (file: File) => {
    const target = fileRef.current;
    if (!file || !target || !tenantId) return;
    setUploading(`${target.idx}-${target.field}`);
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const path = `${tenantId}/${target.field}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('cmr-branding').upload(path, file, { upsert: true });
    if (error) { setUploading(null); toast.error(error.message); return; }
    const { data: signed } = await supabase.storage.from('cmr-branding')
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
    setUploading(null);
    if (!signed?.signedUrl) { toast.error('Signierte URL konnte nicht erstellt werden'); return; }
    patch(target.idx, { [target.field]: signed.signedUrl } as Partial<Tpl>);
    toast.success('Bild hochgeladen – bitte Vorlage speichern');
  };

  /** Erzeugt ein Muster-PDF mit den aktuellen (auch ungespeicherten) Vorlagenwerten. */
  const preview = async (idx: number) => {
    const r = rows[idx];
    setSavingKey(`preview-${idx}`);
    const [logoDataUrl, watermarkDataUrl] = await Promise.all([
      cmrFetchImage(r.logo_url), cmrFetchImage(r.watermark_url),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    const pdf = generateCmrDocumentPdf(
      {
        doc_type: r.doc_type, doc_number: 'MUSTER-0001', doc_date: today, due_date: today,
        customer_name: 'Musterkunde LLC', customer_email: 'kunde@example.com',
        billing_address: 'Musterstraße 1\n12345 Musterstadt',
        reference: 'Vorschau', notes: 'Dies ist eine Layout-Vorschau.',
        currency: settings?.default_currency || 'AED',
        net_total: 1000, tax_total: 50, gross_total: 1050,
      },
      [
        { position: 1, name: 'Beratungsleistung', description: 'Beispielposition', quantity: 4, unit: 'Std.', unit_price: 150, discount_pct: 0, tax_rate: 5, line_total: 600 },
        { position: 2, name: 'Kampagnen-Setup', description: null, quantity: 1, unit: 'Pauschal', unit_price: 400, discount_pct: 0, tax_rate: 5, line_total: 400 },
      ],
      settings,
      { tpl: r as any, logoDataUrl, watermarkDataUrl, qrDataUrl: null },
    );
    setSavingKey(null);
    setPreviewUrl(URL.createObjectURL(pdf.output('blob')));
  };

  return (
    <Card className="p-4 space-y-4">
      <input
        ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickFile(f); e.target.value = ''; }}
      />
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
            {(['logo_url', 'watermark_url'] as const).map((field) => (
              <div key={field}>
                <Label>{field === 'logo_url' ? 'Logo' : 'Wasserzeichen'}</Label>
                <div className="flex gap-2">
                  <Input value={r[field] ?? ''} onChange={(e) => patch(idx, { [field]: e.target.value } as Partial<Tpl>)} />
                  <Button
                    size="sm" variant="outline" className="h-10 shrink-0"
                    disabled={uploading === `${idx}-${field}`}
                    onClick={() => { fileRef.current = { idx, field }; inputRef.current?.click(); }}
                  >
                    {uploading === `${idx}-${field}`
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Upload className="w-4 h-4" />}
                  </Button>
                </div>
                {r[field] && (
                  <img src={r[field] as string} alt={field === 'logo_url' ? 'Logo-Vorschau' : 'Wasserzeichen-Vorschau'}
                    className="mt-2 h-10 object-contain" />
                )}
              </div>
            ))}
          </div>

          <div className="md:w-56">
            <Label>Sprache</Label>
            <select
              className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={r.language ?? 'de'} onChange={(e) => patch(idx, { language: e.target.value })}
            >
              {LANGS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
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
              <Button size="sm" variant="outline" onClick={() => preview(idx)} disabled={savingKey === `preview-${idx}`}>
                {savingKey === `preview-${idx}` ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Eye className="w-4 h-4 mr-1.5" />} Vorschau
              </Button>
              <Button size="sm" variant="ghost" onClick={() => removeRow(idx)}><Trash2 className="w-4 h-4" /></Button>
              <Button size="sm" onClick={() => saveRow(idx)} disabled={savingKey === (r.id ?? `new-${idx}`)}>
                {savingKey === (r.id ?? `new-${idx}`) ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />} Speichern
              </Button>
            </div>
          </div>
        </div>
      ))}

      <Dialog
        open={!!previewUrl}
        onOpenChange={(o) => { if (!o && previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); } }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>Layout-Vorschau</DialogTitle></DialogHeader>
          {previewUrl && <iframe title="PDF-Vorschau" src={previewUrl} className="w-full h-[70vh] rounded-md border" />}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

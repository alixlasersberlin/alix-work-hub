import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/infinity/PageHeader';
import { FileText, Save, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

type Config = {
  max_file_size_mb: number;
  active_doc_types: string[];
  confidence_green: number;
  confidence_yellow: number;
  ocr_enabled: boolean;
  default_currency: string;
  default_branch: string | null;
  default_status: string;
  retention_days_drafts: number;
  auto_followups_default: {
    delivery_planning: boolean;
    mediapaket: boolean;
    nisv: boolean;
    financing: boolean;
    deposit_check: boolean;
  };
};

const DEFAULT_CONFIG: Config = {
  max_file_size_mb: 20,
  active_doc_types: ['purchase_order', 'sales_contract', 'rental_contract', 'leasing_contract', 'order_confirmation', 'offer', 'financing_order', 'device_order', 'service_order', 'other'],
  confidence_green: 90,
  confidence_yellow: 70,
  ocr_enabled: true,
  default_currency: 'EUR',
  default_branch: null,
  default_status: 'offen',
  retention_days_drafts: 90,
  auto_followups_default: { delivery_planning: true, mediapaket: true, nisv: true, financing: true, deposit_check: true },
};

const DOC_TYPES: Array<[string, string]> = [
  ['purchase_order', 'Auftrag / Kaufvertrag'],
  ['sales_contract', 'Kaufvertrag'],
  ['rental_contract', 'Mietvertrag'],
  ['leasing_contract', 'Leasingvertrag'],
  ['order_confirmation', 'Auftragsbestätigung'],
  ['offer', 'Angebot'],
  ['financing_order', 'Finanzierungsauftrag'],
  ['device_order', 'Gerätebestellung'],
  ['service_order', 'Serviceauftrag'],
  ['other', 'Sonstiges'],
];

const KEY = 'pdf_order_import_config';

export default function PdfOrderImportKonfiguration() {
  const { roles, loading: authLoading } = useAuth();
  const [cfg, setCfg] = useState<Config>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isSuperAdmin = roles?.some((r: any) => (typeof r === 'string' ? r : r?.name) === 'Super Admin');

  useEffect(() => {
    document.title = 'PDF-Import Konfiguration · Alix Work';
    (async () => {
      const { data } = await supabase.from('app_settings').select('value').eq('key', KEY).maybeSingle();
      if (data?.value) {
        try { setCfg({ ...DEFAULT_CONFIG, ...JSON.parse(data.value) }); } catch { /* keep default */ }
      }
      setLoading(false);
    })();
  }, []);

  if (!authLoading && !isSuperAdmin) return <Navigate to="/dashboard" replace />;

  const save = async () => {
    if (cfg.max_file_size_mb < 1 || cfg.max_file_size_mb > 100) return toast.error('Max. Dateigröße muss 1–100 MB sein');
    if (cfg.confidence_green <= cfg.confidence_yellow) return toast.error('Grün-Schwelle muss über Gelb-Schwelle liegen');
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: KEY, value: JSON.stringify(cfg), updated_by: u.user?.id ?? null }, { onConflict: 'key' });
    setSaving(false);
    if (error) toast.error('Speichern fehlgeschlagen: ' + error.message);
    else toast.success('Konfiguration gespeichert');
  };

  const toggleDocType = (v: string, on: boolean) => {
    setCfg((c) => ({ ...c, active_doc_types: on ? Array.from(new Set([...c.active_doc_types, v])) : c.active_doc_types.filter((x) => x !== v) }));
  };

  if (loading) return <div className="p-8 flex items-center justify-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Lädt …</div>;

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <PageHeader icon={FileText} title="PDF-Import Konfiguration" subtitle="Grenzen, Standardwerte und Verhalten des KI-Auftragsimports" />
        <Button onClick={save} disabled={saving} className="gap-2 bg-amber-500 hover:bg-amber-600 text-black">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Speichern
        </Button>
      </div>

      <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
        <CardHeader><CardTitle className="text-sm">Upload &amp; Limits</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Max. Dateigröße (MB)</Label>
            <Input type="number" min={1} max={100} value={cfg.max_file_size_mb} onChange={(e) => setCfg((c) => ({ ...c, max_file_size_mb: Number(e.target.value) || 0 }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Aufbewahrung Entwürfe (Tage)</Label>
            <Input type="number" min={7} max={365} value={cfg.retention_days_drafts} onChange={(e) => setCfg((c) => ({ ...c, retention_days_drafts: Number(e.target.value) || 90 }))} />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border p-3 col-span-2">
            <div>
              <div className="text-sm font-medium">OCR für Scans aktivieren</div>
              <div className="text-xs text-muted-foreground">Reine Bild-PDFs werden per tesseract.js zusätzlich verarbeitet (langsamer, kostenlos).</div>
            </div>
            <Switch checked={cfg.ocr_enabled} onCheckedChange={(v) => setCfg((c) => ({ ...c, ocr_enabled: v }))} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
        <CardHeader><CardTitle className="text-sm">Konfidenz-Schwellen</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Grün ab (%)</Label>
            <Input type="number" min={0} max={100} value={cfg.confidence_green} onChange={(e) => setCfg((c) => ({ ...c, confidence_green: Number(e.target.value) || 0 }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Gelb ab (%)</Label>
            <Input type="number" min={0} max={100} value={cfg.confidence_yellow} onChange={(e) => setCfg((c) => ({ ...c, confidence_yellow: Number(e.target.value) || 0 }))} />
          </div>
          <p className="col-span-2 text-xs text-muted-foreground">Werte unter der Gelb-Schwelle werden im Review-Assistenten rot markiert und müssen manuell geprüft werden.</p>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
        <CardHeader><CardTitle className="text-sm">Aktive Dokumenttypen</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-2">
          {DOC_TYPES.map(([k, label]) => (
            <label key={k} className="flex items-center justify-between rounded border border-border/60 px-3 py-2 text-sm cursor-pointer">
              <span>{label}</span>
              <Switch checked={cfg.active_doc_types.includes(k)} onCheckedChange={(v) => toggleDocType(k, v)} />
            </label>
          ))}
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
        <CardHeader><CardTitle className="text-sm">Standardwerte für neue Aufträge</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Standard-Währung</Label>
            <Select value={cfg.default_currency} onValueChange={(v) => setCfg((c) => ({ ...c, default_currency: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="EUR">EUR</SelectItem>
                <SelectItem value="CHF">CHF</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Standard-Status</Label>
            <Input value={cfg.default_status} onChange={(e) => setCfg((c) => ({ ...c, default_status: e.target.value }))} />
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs">Standard-Niederlassung (optional)</Label>
            <Input value={cfg.default_branch ?? ''} onChange={(e) => setCfg((c) => ({ ...c, default_branch: e.target.value || null }))} placeholder="z. B. DE, AT, HQ" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
        <CardHeader><CardTitle className="text-sm">Standard-Folgeprozesse (im Review vorausgewählt)</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-2">
          {([
            ['delivery_planning', 'Lieferplanung anstoßen'],
            ['mediapaket', 'Mediapaket anlegen'],
            ['nisv', 'NiSV-Schulung planen'],
            ['financing', 'Finanzierungs-Vorgang öffnen'],
            ['deposit_check', 'Anzahlungs-Prüfung aktivieren'],
          ] as const).map(([k, label]) => (
            <label key={k} className="flex items-center justify-between rounded border border-border/60 px-3 py-2 text-sm cursor-pointer">
              <span>{label}</span>
              <Switch checked={(cfg.auto_followups_default as any)[k]} onCheckedChange={(v) => setCfg((c) => ({ ...c, auto_followups_default: { ...c.auto_followups_default, [k]: v } }))} />
            </label>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

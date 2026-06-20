import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Bell, Plus, Save, Trash2, GripVertical, MessageSquare, Mail, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';

export type MahnStage = {
  id: string;
  name: string;
  days_after_due: number;
  enabled: boolean;
  email_subject: string;
  email_body: string;
  sms_body: string;
};

export type MahnConfig = {
  sender: { email_from: string; email_from_name: string; sms_sender: string };
  bank: { account_holder: string; bank_name: string; iban: string; bic: string };
  stages: MahnStage[];
};

const DEFAULT_CONFIG: MahnConfig = {
  sender: { email_from: '', email_from_name: '', sms_sender: 'ALIXLASERS' },
  bank: { account_holder: '', bank_name: '', iban: '', bic: '' },
  stages: [],
};

const PLACEHOLDERS = [
  '{customerName}', '{orderNumber}', '{depositAmount}',
  '{depositOkDate}', '{iban}', '{bic}', '{bankName}', '{senderName}',
];

export default function MahnungKonfiguration() {
  const { roles, loading: authLoading } = useAuth();
  const [config, setConfig] = useState<MahnConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isSuperAdmin = roles?.some((r: any) => (typeof r === 'string' ? r : r?.name) === 'Super Admin');

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('app_settings').select('value').eq('key', 'anzahlung_mahnung_config').maybeSingle();
      if (!error && data?.value) {
        try { setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(data.value) }); } catch { /* keep default */ }
      }
      setLoading(false);
    })();
  }, []);

  if (!authLoading && !isSuperAdmin) return <Navigate to="/dashboard" replace />;

  const save = async () => {
    // basic validation
    for (const s of config.stages) {
      if (!s.name?.trim()) return toast.error('Jede Mahnstufe braucht einen Namen');
      if (!s.email_subject?.trim() || !s.email_body?.trim() || !s.sms_body?.trim()) {
        return toast.error(`Stufe „${s.name}": Betreff/E-Mail/SMS dürfen nicht leer sein`);
      }
    }
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: 'anzahlung_mahnung_config', value: JSON.stringify(config), updated_by: u.user?.id ?? null }, { onConflict: 'key' });
    setSaving(false);
    if (error) toast.error(`Speichern fehlgeschlagen: ${error.message}`);
    else toast.success('Konfiguration gespeichert');
  };

  const updateStage = (idx: number, patch: Partial<MahnStage>) =>
    setConfig((c) => ({ ...c, stages: c.stages.map((s, i) => i === idx ? { ...s, ...patch } : s) }));

  const addStage = () => setConfig((c) => ({
    ...c,
    stages: [...c.stages, {
      id: `stage_${Date.now()}`,
      name: `Mahnstufe ${c.stages.length + 1}`,
      days_after_due: 7 * (c.stages.length + 1),
      enabled: true,
      email_subject: 'Mahnung – Anzahlung {orderNumber}',
      email_body: 'Sehr geehrte Damen und Herren {customerName},\n\n…\n\nMit freundlichen Grüßen\n{senderName}',
      sms_body: 'Mahnung: Anzahlung {depositAmount} zu Auftrag {orderNumber} ist offen. – Alix Lasers',
    }],
  }));

  const removeStage = (idx: number) => {
    if (!confirm('Mahnstufe wirklich entfernen?')) return;
    setConfig((c) => ({ ...c, stages: c.stages.filter((_, i) => i !== idx) }));
  };

  const moveStage = (idx: number, dir: -1 | 1) => {
    setConfig((c) => {
      const arr = [...c.stages];
      const j = idx + dir;
      if (j < 0 || j >= arr.length) return c;
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
      return { ...c, stages: arr };
    });
  };

  if (loading) return <div className="container mx-auto p-6">Lade …</div>;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        icon={Bell}
        title="Anzahlungs-Mahnung Konfiguration"
        subtitle="Mahnstufen, Texte, Bankverbindung und Absender für SMS- und E-Mail-Mahnungen verwalten."
        noBreadcrumbs
        actions={
          <Button onClick={save} disabled={saving} className="gold-gradient text-primary-foreground">
            <Save className="h-4 w-4 mr-2" />{saving ? 'Speichere …' : 'Speichern'}
          </Button>
        }
      />

      {/* Absender */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Mail className="h-4 w-4" /> Absender</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label>E-Mail Absender-Name</Label>
            <Input value={config.sender.email_from_name}
              onChange={(e) => setConfig((c) => ({ ...c, sender: { ...c.sender, email_from_name: e.target.value } }))} />
          </div>
          <div className="space-y-1.5">
            <Label>E-Mail From-Adresse</Label>
            <Input type="email" value={config.sender.email_from}
              onChange={(e) => setConfig((c) => ({ ...c, sender: { ...c.sender, email_from: e.target.value } }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2"><MessageSquare className="h-3.5 w-3.5" /> SMS-Sender</Label>
            <Input maxLength={11} value={config.sender.sms_sender}
              onChange={(e) => setConfig((c) => ({ ...c, sender: { ...c.sender, sms_sender: e.target.value } }))} />
            <p className="text-xs text-muted-foreground">Max. 11 Zeichen (z.B. ALIXLASERS)</p>
          </div>
        </CardContent>
      </Card>

      {/* Bank */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-4 w-4" /> Bankverbindung</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Kontoinhaber</Label>
            <Input value={config.bank.account_holder}
              onChange={(e) => setConfig((c) => ({ ...c, bank: { ...c.bank, account_holder: e.target.value } }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Bank</Label>
            <Input value={config.bank.bank_name}
              onChange={(e) => setConfig((c) => ({ ...c, bank: { ...c.bank, bank_name: e.target.value } }))} />
          </div>
          <div className="space-y-1.5">
            <Label>IBAN</Label>
            <Input value={config.bank.iban}
              onChange={(e) => setConfig((c) => ({ ...c, bank: { ...c.bank, iban: e.target.value } }))} />
          </div>
          <div className="space-y-1.5">
            <Label>BIC</Label>
            <Input value={config.bank.bic}
              onChange={(e) => setConfig((c) => ({ ...c, bank: { ...c.bank, bic: e.target.value } }))} />
          </div>
        </CardContent>
      </Card>

      {/* Stages */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Mahnstufen</CardTitle>
          <Button size="sm" variant="outline" onClick={addStage}><Plus className="h-4 w-4 mr-1" /> Stufe hinzufügen</Button>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Verfügbare Platzhalter: {PLACEHOLDERS.map((p) => <code key={p} className="mx-0.5 bg-muted px-1 rounded">{p}</code>)}
          </p>
          {config.stages.length === 0 && (
            <div className="text-sm text-muted-foreground py-4 text-center">Keine Mahnstufen konfiguriert.</div>
          )}
          {config.stages.map((s, idx) => (
            <div key={s.id} className="rounded-lg border p-4 space-y-3 bg-card/40">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex flex-col">
                  <button type="button" className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    onClick={() => moveStage(idx, -1)} disabled={idx === 0} title="Hoch"><GripVertical className="h-4 w-4 rotate-180" /></button>
                  <button type="button" className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    onClick={() => moveStage(idx, 1)} disabled={idx === config.stages.length - 1} title="Runter"><GripVertical className="h-4 w-4" /></button>
                </div>
                <Badge variant="secondary">#{idx + 1}</Badge>
                <Input className="max-w-xs" value={s.name} onChange={(e) => updateStage(idx, { name: e.target.value })} />
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Tage nach Fälligkeit</Label>
                  <Input type="number" min={0} className="w-20" value={s.days_after_due}
                    onChange={(e) => updateStage(idx, { days_after_due: Number(e.target.value) || 0 })} />
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <Label className="text-xs">Aktiv</Label>
                  <Switch checked={s.enabled} onCheckedChange={(v) => updateStage(idx, { enabled: v })} />
                  <Button size="icon" variant="ghost" onClick={() => removeStage(idx)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
              <Separator />
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1.5"><Mail className="h-3 w-3" /> E-Mail Betreff</Label>
                  <Input value={s.email_subject} onChange={(e) => updateStage(idx, { email_subject: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1.5"><MessageSquare className="h-3 w-3" /> SMS-Text</Label>
                  <Textarea rows={3} value={s.sms_body} onChange={(e) => updateStage(idx, { sms_body: e.target.value })} />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs flex items-center gap-1.5"><Mail className="h-3 w-3" /> E-Mail Text</Label>
                  <Textarea rows={8} value={s.email_body} onChange={(e) => updateStage(idx, { email_body: e.target.value })} />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="gold-gradient text-primary-foreground">
          <Save className="h-4 w-4 mr-2" />{saving ? 'Speichere …' : 'Speichern'}
        </Button>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Settings, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useLicense } from '@/hooks/useLicense';

export default function LicenseEinstellungen() {
  const { licensor, settings, canWrite, loading, reload } = useLicense();
  const [form, setForm] = useState<any>(null);
  const [log, setLog] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (settings) setForm({ ...settings }); }, [settings]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('license_audit_log' as any).select('*').order('created_at', { ascending: false }).limit(50);
      setLog(((data as any[]) || []));
    })();
  }, []);

  const save = async () => {
    if (!licensor) return;
    setSaving(true);
    const payload = {
      tenant_id: licensor.id,
      billing_mode: form.billing_mode,
      auto_generate: !!form.auto_generate,
      default_rate_percent: Number(form.default_rate_percent || 0),
      payment_terms_days: Number(form.payment_terms_days || 14),
      currency: form.currency || 'EUR',
    };
    const { error } = form.id
      ? await supabase.from('license_settings' as any).update(payload).eq('id', form.id)
      : await supabase.from('license_settings' as any).insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Einstellungen gespeichert.');
    reload();
  };

  if (loading || !form) return <div className="p-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader title="Lizenz-Einstellungen" subtitle="Abrechnungsmodus, Standardsätze und Protokoll" icon={Settings} />

      <Card className="space-y-4 p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Abrechnungsmodus</Label>
            <select disabled={!canWrite} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.billing_mode} onChange={(e) => setForm({ ...form, billing_mode: e.target.value })}>
              <option value="monthly">Monatliche Sammelrechnung</option>
              <option value="single">Einzelrechnung je Verkauf</option>
            </select>
          </div>
          <div className="flex items-end gap-3 pb-1">
            <Switch disabled={!canWrite} checked={!!form.auto_generate} onCheckedChange={(v) => setForm({ ...form, auto_generate: v })} />
            <span className="text-sm">Lizenzabrechnung automatisch erzeugen</span>
          </div>
          <div><Label>Standard-Lizenzsatz %</Label><Input disabled={!canWrite} type="number" step="0.01" value={form.default_rate_percent} onChange={(e) => setForm({ ...form, default_rate_percent: e.target.value })} /></div>
          <div><Label>Zahlungsziel (Tage)</Label><Input disabled={!canWrite} type="number" value={form.payment_terms_days} onChange={(e) => setForm({ ...form, payment_terms_days: e.target.value })} /></div>
          <div><Label>Währung</Label><Input disabled={!canWrite} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></div>
        </div>
        <div className="text-xs text-muted-foreground">
          Nummernkreise: LIC-RG-JJJJ-000000 (Rechnung) · LIC-ROY-JJJJ-000000 (Royalty) · LIC-CON-JJJJ-000000 (Vertrag)
        </div>
        {canWrite && <Button onClick={save} disabled={saving}>{saving ? 'Speichern…' : 'Speichern'}</Button>}
      </Card>

      <Card className="p-4">
        <div className="mb-3 font-medium">Revisionssicheres Protokoll</div>
        <div className="space-y-1 text-xs">
          {log.map((l) => (
            <div key={l.id} className="flex gap-3 border-b border-border/50 pb-1">
              <span className="text-muted-foreground">{new Date(l.created_at).toLocaleString('de-DE')}</span>
              <span className="font-mono">{l.entity}</span>
              <span>{l.action}</span>
              <span className="truncate text-muted-foreground">{l.payload ? JSON.stringify(l.payload) : ''}</span>
            </div>
          ))}
          {log.length === 0 && <div className="text-muted-foreground">Noch keine Einträge.</div>}
        </div>
      </Card>
    </div>
  );
}

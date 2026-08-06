import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { DataCard } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Settings } from 'lucide-react';
import { useCommissionPermissions } from '@/hooks/useCommissionPermissions';

const DEFAULTS: any = {
  rounding_mode: 'half_up', rounding_decimals: 2, default_currency: 'EUR',
  approval_threshold_amount: 1000, four_eyes_enabled: true,
  max_percent_without_superadmin: 10, auto_calculate_enabled: true, notify_emails: [],
};

export default function ProvisionEinstellungen() {
  const perms = useCommissionPermissions();
  const [row, setRow] = useState<any>(DEFAULTS);
  const [emails, setEmails] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('commission_settings').select('*').limit(1).maybeSingle();
      if (data) { setRow(data); setEmails((data.notify_emails ?? []).join(', ')); }
    })();
  }, []);

  const save = async () => {
    const payload = { ...row, notify_emails: emails.split(',').map((e) => e.trim()).filter(Boolean) };
    delete payload.created_at; delete payload.updated_at;
    const { error } = row.id
      ? await supabase.from('commission_settings').update(payload).eq('id', row.id)
      : await supabase.from('commission_settings').insert(payload);
    if (error) return toast.error(error.message);
    toast.success('Einstellungen gespeichert');
  };

  return (
    <div className="p-6 lg:p-8 animate-fade-in space-y-4">
      <PageHeader title="Provisions-Einstellungen" subtitle="Rundung, Freigabegrenzen, Vier-Augen-Prinzip und Benachrichtigungen" icon={Settings} />

      <DataCard title="Grundeinstellungen">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Rundungsmodus</Label>
            <Select value={row.rounding_mode ?? 'half_up'} onValueChange={(v) => setRow({ ...row, rounding_mode: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="half_up">kaufmännisch runden</SelectItem>
                <SelectItem value="down">abrunden</SelectItem>
                <SelectItem value="up">aufrunden</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Nachkommastellen</Label><Input type="number" value={row.rounding_decimals ?? 2} onChange={(e) => setRow({ ...row, rounding_decimals: Number(e.target.value) })} /></div>
          <div><Label>Standardwährung</Label><Input value={row.default_currency ?? 'EUR'} onChange={(e) => setRow({ ...row, default_currency: e.target.value })} /></div>
          <div><Label>Freigabegrenze (Betrag)</Label><Input type="number" step="0.01" value={row.approval_threshold_amount ?? 0} onChange={(e) => setRow({ ...row, approval_threshold_amount: Number(e.target.value) })} /></div>
          <div><Label>Max. % ohne Super Admin</Label><Input type="number" step="0.01" value={row.max_percent_without_superadmin ?? 0} onChange={(e) => setRow({ ...row, max_percent_without_superadmin: Number(e.target.value) })} /></div>
          <div className="md:col-span-2"><Label>Benachrichtigungs-E-Mails (kommagetrennt)</Label><Input value={emails} onChange={(e) => setEmails(e.target.value)} /></div>
          <div className="flex items-center gap-3"><Switch checked={!!row.four_eyes_enabled} onCheckedChange={(v) => setRow({ ...row, four_eyes_enabled: v })} /><Label>Vier-Augen-Prinzip aktiv</Label></div>
          <div className="flex items-center gap-3"><Switch checked={!!row.auto_calculate_enabled} onCheckedChange={(v) => setRow({ ...row, auto_calculate_enabled: v })} /><Label>Automatische Berechnung aktiv</Label></div>
        </div>
        <div className="mt-5">
          <Button onClick={save} disabled={!perms.canManage}>Speichern</Button>
        </div>
      </DataCard>
    </div>
  );
}

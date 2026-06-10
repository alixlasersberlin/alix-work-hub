import { useState } from 'react';
import { Download, FileText, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader, DataCard } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';

const DEFAULT_CFG = {
  berater: '0000000', mandant: '00000', wj_beginn: '0101', skr: '03',
  konto_debitor_default: '10000', konto_erloese: '8400', konto_zahlung: '1200',
};

export default function FinanceDatev() {
  const { roles } = useAuth();
  const isSuperAdmin = roles.includes('Super Admin');
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + '01';
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [downloading, setDownloading] = useState(false);
  const [cfg, setCfg] = useState<any>(DEFAULT_CFG);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('app_settings' as any).select('value').eq('key', 'finance.datev.config').maybeSingle();
      try { if ((data as any)?.value) setCfg({ ...DEFAULT_CFG, ...JSON.parse((data as any).value) }); } catch { /* ignore */ }
    })();
  }, []);

  const download = async () => {
    setDownloading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/finance-datev-export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ date_from: from, date_to: to }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `EXTF_${from}_${to}.csv`; a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'DATEV-Export erstellt' });
    } catch (e: any) {
      toast({ title: 'Fehler', description: e?.message, variant: 'destructive' });
    } finally { setDownloading(false); }
  };

  const saveCfg = async () => {
    if (!isSuperAdmin) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('app_settings' as any).upsert({ key: 'finance.datev.config', value: JSON.stringify(cfg), updated_at: new Date().toISOString() }, { onConflict: 'key' });
      if (error) throw error;
      toast({ title: 'Gespeichert' });
    } catch (e: any) { toast({ title: 'Fehler', description: e?.message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  return (
    <div className="p-4 sm:p-6">
      <PageHeader icon={<FileText className="w-6 h-6 text-primary" />} title="DATEV-Export" subtitle="EXTF Buchungsstapel 700 aus finance_transactions" />

      <DataCard className="p-4 mb-6">
        <h3 className="font-semibold mb-3">Zeitraum</h3>
        <div className="flex gap-3 items-end flex-wrap">
          <div><Label>Von</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><Label>Bis</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
          <Button onClick={download} disabled={downloading} className="gold-gradient text-primary-foreground">
            <Download className="w-4 h-4 mr-2" />{downloading ? 'Erstelle…' : 'CSV herunterladen'}
          </Button>
        </div>
      </DataCard>

      <DataCard className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Konfiguration</h3>
          {isSuperAdmin && (
            <Button size="sm" onClick={saveCfg} disabled={saving} className="gold-gradient text-primary-foreground">
              <Save className="w-4 h-4 mr-2" />{saving ? 'Speichert…' : 'Speichern'}
            </Button>
          )}
        </div>
        {!isSuperAdmin && <p className="text-sm text-amber-500 mb-3">Nur Super Admin kann die Konfiguration ändern.</p>}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Object.entries(cfg).map(([k, v]) => (
            <div key={k}>
              <Label>{k}</Label>
              <Input value={String(v ?? '')} disabled={!isSuperAdmin}
                onChange={e => setCfg({ ...cfg, [k]: e.target.value })} />
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">SKR 03/04, Beraternr./Mandantennr. werden in den DATEV-Header geschrieben. Sachkonten-Mapping bestimmt Erlös- und Zahlungskonten.</p>
      </DataCard>
    </div>
  );
}

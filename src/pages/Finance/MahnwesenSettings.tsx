import { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader, PageLoading, DataCard } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

type Lv = { level: number; days: number; fee: number; interest_pct: number };
type Cfg = { levels: Lv[]; payment_window_days: number };

const DEFAULT_CFG: Cfg = {
  levels: [
    { level: 1, days: 14, fee: 0, interest_pct: 0 },
    { level: 2, days: 28, fee: 5, interest_pct: 0 },
    { level: 3, days: 42, fee: 10, interest_pct: 5 },
    { level: 4, days: 56, fee: 15, interest_pct: 9 },
  ],
  payment_window_days: 7,
};

const LABELS = ['—', 'Zahlungserinnerung', '1. Mahnung', '2. Mahnung', 'Letzte Mahnung'];

export default function FinanceMahnwesenSettings() {
  const { roles } = useAuth();
  const isSuperAdmin = roles.includes('Super Admin');
  const [cfg, setCfg] = useState<Cfg>(DEFAULT_CFG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('app_settings' as any).select('value').eq('key', 'finance.reminder.config').maybeSingle();
      try { if ((data as any)?.value) setCfg({ ...DEFAULT_CFG, ...JSON.parse((data as any).value) }); } catch { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    if (!isSuperAdmin) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('app_settings' as any).upsert({ key: 'finance.reminder.config', value: JSON.stringify(cfg), updated_at: new Date().toISOString() }, { onConflict: 'key' });
      if (error) throw error;
      toast({ title: 'Gespeichert' });
    } catch (e: any) { toast({ title: 'Fehler', description: e?.message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  if (loading) return <PageLoading />;

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        icon={<SettingsIcon className="w-6 h-6 text-primary" />}
        title="Mahnwesen Einstellungen"
        subtitle="Mahnstufen, Gebühren, Verzugszinsen und Zahlungsfrist"
        actions={isSuperAdmin && (
          <Button onClick={save} disabled={saving} className="gold-gradient text-primary-foreground">
            <Save className="w-4 h-4 mr-2" />{saving ? 'Speichert…' : 'Speichern'}
          </Button>
        )}
      />
      {!isSuperAdmin && <div className="mb-3 text-sm text-amber-500">Nur Super Admin kann Einstellungen speichern.</div>}

      <DataCard className="p-4 mb-4">
        <Label>Zahlungsfrist nach Mahnung (Tage)</Label>
        <Input type="number" className="mt-1 max-w-[160px]" value={cfg.payment_window_days}
          onChange={e => setCfg({ ...cfg, payment_window_days: Number(e.target.value || 0) })} disabled={!isSuperAdmin} />
      </DataCard>

      <DataCard className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Stufe</th>
              <th className="text-left px-4 py-3 font-medium">Bezeichnung</th>
              <th className="text-left px-4 py-3 font-medium">Tage überfällig</th>
              <th className="text-left px-4 py-3 font-medium">Mahngebühr (€)</th>
              <th className="text-left px-4 py-3 font-medium">Verzugszinsen (% p.a.)</th>
            </tr>
          </thead>
          <tbody>
            {cfg.levels.map((l, idx) => (
              <tr key={l.level} className="border-t border-border">
                <td className="px-4 py-3 font-mono">{l.level}</td>
                <td className="px-4 py-3">{LABELS[l.level]}</td>
                <td className="px-4 py-3"><Input type="number" value={l.days} className="w-24" disabled={!isSuperAdmin}
                  onChange={e => { const v = [...cfg.levels]; v[idx] = { ...l, days: Number(e.target.value || 0) }; setCfg({ ...cfg, levels: v }); }} /></td>
                <td className="px-4 py-3"><Input type="number" step="0.01" value={l.fee} className="w-24" disabled={!isSuperAdmin}
                  onChange={e => { const v = [...cfg.levels]; v[idx] = { ...l, fee: Number(e.target.value || 0) }; setCfg({ ...cfg, levels: v }); }} /></td>
                <td className="px-4 py-3"><Input type="number" step="0.1" value={l.interest_pct} className="w-24" disabled={!isSuperAdmin}
                  onChange={e => { const v = [...cfg.levels]; v[idx] = { ...l, interest_pct: Number(e.target.value || 0) }; setCfg({ ...cfg, levels: v }); }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataCard>

      <p className="mt-4 text-xs text-muted-foreground">
        Hinweis: Die Mahn-Engine läuft täglich 03:00 UTC und erzeugt nur Entwürfe.
        Versand erfolgt ausschließlich manuell aus der Übersicht.
      </p>
    </div>
  );
}

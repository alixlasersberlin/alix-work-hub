import { useState } from 'react';
import { CheckCircle2, Clock, RefreshCw, PlayCircle } from 'lucide-react';
import { PageHeader } from '@/components/PageShell';
import { Settings as SettingsIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

const STATUS = [
  { name: 'Zoho → Finance Bridge', state: 'aktiv', tone: 'success' as const },
  { name: 'Wiederkehrende Raten', state: 'aktiv', tone: 'success' as const },
  { name: 'Offene Posten', state: 'aktiv', tone: 'success' as const },
  { name: 'DATEV Schnittstelle', state: 'vorbereitet', tone: 'amber' as const },
  { name: 'Mahnwesen', state: 'vorbereitet', tone: 'amber' as const },
  { name: 'Kontoauszugimport', state: 'vorbereitet', tone: 'amber' as const },
  { name: 'Sperrmanagement', state: 'vorbereitet', tone: 'amber' as const },
];

export default function FinanceSystemstatus() {
  const { roles } = useAuth();
  const isSuperAdmin = roles.includes('Super Admin');
  const [running, setRunning] = useState(false);
  const [last, setLast] = useState<any>(null);

  const runSync = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-zoho-to-finance', { body: {} });
      if (error) throw error;
      setLast(data);
      toast({
        title: 'Sync abgeschlossen',
        description: `Rechnungen: ${data?.invoices_seen ?? 0} • neu: ${data?.tx_inserted ?? 0} • aktualisiert: ${data?.tx_updated ?? 0} • Konten: ${data?.accounts_upserted ?? 0}`,
      });
    } catch (e: any) {
      toast({ title: 'Sync fehlgeschlagen', description: e?.message ?? 'Unbekannter Fehler', variant: 'destructive' });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        icon={<SettingsIcon className="w-6 h-6 text-primary" />}
        title="Finance Systemstatus"
        subtitle="Status der Subsysteme & manuelle Synchronisation"
        actions={isSuperAdmin && (
          <Button onClick={runSync} disabled={running} className="gold-gradient text-primary-foreground">
            {running ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <PlayCircle className="w-4 h-4 mr-2" />}
            {running ? 'Sync läuft…' : 'Jetzt synchronisieren'}
          </Button>
        )}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {STATUS.map(s => (
          <div key={s.name} className="flex items-center justify-between rounded-xl border border-border bg-card p-4 card-glow">
            <div className="flex items-center gap-3">
              {s.tone === 'success'
                ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                : <Clock className="w-5 h-5 text-amber-500" />}
              <span className="text-foreground font-medium">{s.name}</span>
            </div>
            <span className={`inline-flex items-center gap-1 text-xs ${s.tone === 'success' ? 'text-emerald-500' : 'text-amber-500'}`}>
              {s.state}
            </span>
          </div>
        ))}
      </div>

      {last && (
        <div className="mt-6 rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-semibold mb-2">Letzter Sync</p>
          <pre className="text-xs text-muted-foreground overflow-auto">{JSON.stringify(last, null, 2)}</pre>
        </div>
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        Cron-Job: Tägliche Synchronisation um 02:30 Uhr UTC. Manuell nur durch Super Admin auslösbar.
      </p>
    </div>
  );
}

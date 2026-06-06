import { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Brain, LayoutDashboard, Building2, AlertOctagon, TrendingUp, Wrench, Users, LineChart, ListChecks, FileText, RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

const tabs = [
  { to: '/aic', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/aic/unternehmen', label: 'Unternehmen', icon: Building2 },
  { to: '/aic/forderungen', label: 'Forderungen', icon: AlertOctagon },
  { to: '/aic/vertrieb', label: 'Vertrieb', icon: TrendingUp },
  { to: '/aic/service', label: 'Service', icon: Wrench },
  { to: '/aic/mitarbeiter', label: 'Mitarbeiter', icon: Users },
  { to: '/aic/forecasts', label: 'Forecasts', icon: LineChart },
  { to: '/aic/tasks', label: 'KI-Aufgaben', icon: ListChecks },
  { to: '/aic/berichte', label: 'Berichte', icon: FileText },
];

export default function AicLayout() {
  const [running, setRunning] = useState(false);
  const qc = useQueryClient();
  const location = useLocation();

  const runAnalysis = async () => {
    setRunning(true);
    const t = toast.loading('KI-Analyse läuft … das kann 20–60 Sekunden dauern.');
    try {
      const { data, error } = await supabase.functions.invoke('aic-analyze', {
        body: { trigger: 'manual' },
      });
      if (error) throw error;
      toast.success(`Analyse abgeschlossen: ${data?.counts?.insights ?? 0} Insights, ${data?.counts?.tasks ?? 0} Tasks, ${data?.counts?.forecasts ?? 0} Forecasts`, { id: t });
      qc.invalidateQueries({ queryKey: ['aic'] });
    } catch (e: any) {
      toast.error('Analyse fehlgeschlagen: ' + (e?.message || e), { id: t });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="p-4 lg:p-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/30 to-primary/5 border border-primary/40 flex items-center justify-center">
            <Brain className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-[2px] text-primary/80">Alix Intelligence Center</div>
            <h1 className="text-2xl font-display font-bold text-foreground">Zentrale KI-Steuerung</h1>
          </div>
        </div>
        <Button onClick={runAnalysis} disabled={running} className="gap-2">
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          KI-Analyse jetzt starten
        </Button>
      </div>

      <div className="flex flex-wrap gap-1 mb-6 border-b border-border">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 px-3 py-2 text-sm border-b-2 -mb-px transition-colors',
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )
            }
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </NavLink>
        ))}
      </div>

      <Outlet key={location.pathname} />
    </div>
  );
}

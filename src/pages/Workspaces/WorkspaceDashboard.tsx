import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useTenant } from '@/contexts/TenantContext';
import { Card } from '@/components/ui/card';
import { iconFor } from '@/lib/workspace/icons';
import { Loader2 } from 'lucide-react';

type Kpi = { key: string; label: string; table: string; hint?: string; to?: string };

const KPIS: Record<string, Kpi[]> = {
  verkauf: [
    { key: 'leads', label: 'Leads', table: 'sales_leads', to: '/verkauf/anfragen' },
    { key: 'offers', label: 'Angebote', table: 'offers', to: '/verkauf/angebote' },
    { key: 'orders', label: 'Aufträge', table: 'orders', to: '/auftraege' },
    { key: 'customers', label: 'Kunden', table: 'customers', to: '/kunden' },
  ],
  buchhaltung: [
    { key: 'tx', label: 'Buchungen', table: 'finance_transactions', to: '/finance/rechnungen' },
    { key: 'orders', label: 'Aufträge', table: 'orders', to: '/auftraege' },
    { key: 'customers', label: 'Kunden', table: 'customers', to: '/kunden' },
  ],
  lager: [
    { key: 'devices', label: 'Geräte im Bestand', table: 'lager_devices', to: '/lager' },
    { key: 'orders', label: 'Aufträge', table: 'orders', to: '/auftraege' },
  ],
  fertigung: [
    { key: 'prod', label: 'Produktionsaufträge', table: 'production_orders', to: '/production' },
    { key: 'bugs', label: 'Qualitätsmeldungen', table: 'bugs', to: '/bug-capa' },
  ],
  operation: [
    { key: 'tickets', label: 'Tickets', table: 'tickets', to: '/tickets/dashboard' },
    { key: 'customers', label: 'Kunden', table: 'customers', to: '/kunden' },
    { key: 'orders', label: 'Aufträge', table: 'orders', to: '/auftraege' },
  ],
};

export default function WorkspaceDashboard() {
  const { code } = useParams<{ code: string }>();
  const { workspaces, navItems, current, setCurrent } = useWorkspace();
  const { current: tenant } = useTenant();
  const [counts, setCounts] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);

  const ws = workspaces.find(w => w.code === code) || current;

  useEffect(() => {
    if (code && ws && ws.code !== current?.code) setCurrent(ws);
  }, [code, ws?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    const kpis = KPIS[ws?.code ?? ''] || [];
    if (kpis.length === 0) { setCounts({}); setLoading(false); return; }
    setLoading(true);
    (async () => {
      const res: Record<string, number | null> = {};
      await Promise.all(kpis.map(async (k) => {
        try {
          let q: any = supabase.from(k.table as any).select('id', { count: 'exact', head: true });
          // Mandantenfilter: Tabellen mit source_system nach aktivem Mandanten einschränken
          if (sourceFilter && sourceFilter.length > 0 && TENANT_SCOPED.includes(k.table)) {
            q = q.in('source_system', sourceFilter);
          }
          const { count, error } = await q;
          res[k.key] = error ? null : (count ?? 0);
        } catch {
          res[k.key] = null;
        }
      }));
      if (!cancelled) { setCounts(res); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [ws?.code, sourceFilter?.join(',')]);


  if (!ws) {
    return <div className="p-6 text-muted-foreground">Kein Workspace verfügbar.</div>;
  }

  const kpis = KPIS[ws.code] || [];

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-fade-in">
      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Workspace{tenant ? ` · ${tenant.flag_emoji || ''} ${tenant.name}` : ' · Alix World'}
        </div>
        <h1 className="text-2xl font-display font-bold text-foreground">
          {ws.emoji} {ws.name}
        </h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.key} className="p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{k.label}</div>
            <div className="mt-2 text-3xl font-semibold">
              {loading ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                : counts[k.key] === null ? '–' : counts[k.key]?.toLocaleString('de-DE')}
            </div>
            {k.to && (
              <Link to={k.to} className="mt-3 inline-block text-xs text-primary hover:underline">
                Öffnen
              </Link>
            )}
          </Card>
        ))}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
          Schnellzugriff
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {navItems.filter(n => n.path !== `/w/${ws.code}`).map((n) => {
            const Icon = iconFor(n.icon);
            return (
              <Link
                key={n.id}
                to={n.path}
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 hover:border-primary/40 hover:bg-primary/5 transition-colors"
              >
                <Icon className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-sm truncate">{n.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

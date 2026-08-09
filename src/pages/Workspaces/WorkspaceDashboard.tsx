import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useTenant } from '@/contexts/TenantContext';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { iconFor } from '@/lib/workspace/icons';
import { Loader2 } from 'lucide-react';

const QA_SIZE_KEY = 'alix.quickaccess.size';

type KpiScope = 'source' | 'customer' | 'order' | 'tenant' | 'lead-country' | 'unscoped';
type Kpi = { key: string; label: string; table: string; scope: KpiScope; hint?: string; to?: string };

const KPIS: Record<string, Kpi[]> = {
  verkauf: [
    { key: 'leads', label: 'Leads', table: 'sales_leads', scope: 'lead-country', to: '/verkauf/anfragen' },
    { key: 'offers', label: 'Angebote', table: 'offers', scope: 'customer', to: '/verkauf/angebote' },
    { key: 'orders', label: 'Aufträge', table: 'orders', scope: 'source', to: '/auftraege' },
    { key: 'customers', label: 'Kunden', table: 'customers', scope: 'source', to: '/kunden' },
  ],
  buchhaltung: [
    { key: 'tx', label: 'Buchungen', table: 'finance_transactions', scope: 'customer', to: '/finance/rechnungen' },
    { key: 'orders', label: 'Aufträge', table: 'orders', scope: 'source', to: '/auftraege' },
    { key: 'customers', label: 'Kunden', table: 'customers', scope: 'source', to: '/kunden' },
  ],
  lager: [
    { key: 'devices', label: 'Geräte im Bestand', table: 'lager_devices', scope: 'source', to: '/lager' },
    { key: 'orders', label: 'Aufträge', table: 'orders', scope: 'source', to: '/auftraege' },
  ],
  fertigung: [
    { key: 'prod', label: 'Produktionsaufträge', table: 'production_orders', scope: 'order', to: '/production' },
    { key: 'bugs', label: 'Qualitätsmeldungen', table: 'bugs', scope: 'unscoped', to: '/bug-capa' },
  ],
  operation: [
    { key: 'tickets', label: 'Tickets', table: 'tickets', scope: 'source', to: '/tickets/dashboard' },
    { key: 'customers', label: 'Kunden', table: 'customers', scope: 'source', to: '/kunden' },
    { key: 'orders', label: 'Aufträge', table: 'orders', scope: 'source', to: '/auftraege' },
  ],
};

// Tabellen, die per Zoho-Quellsystem einem Mandanten zugeordnet sind
// Eigene Belegkreise: Mandanten ohne Zoho-Quellsystem haben eigene Tabellen
const TENANT_KPIS: Record<string, Record<string, Kpi[]>> = {
  CMR: {
    verkauf: [
      { key: 'cmr_docs', label: 'Belege', table: 'cmr_documents', scope: 'tenant', to: '/cmr/dokumente' },
      { key: 'cmr_projects', label: 'Projekte', table: 'cmr_projects', scope: 'tenant', to: '/cmr/projekte' },
      { key: 'cmr_items', label: 'Artikel', table: 'cmr_items', scope: 'tenant', to: '/cmr/artikel' },
      { key: 'customers', label: 'Kunden', table: 'customers', scope: 'source', to: '/cmr/kunden' },
    ],
    buchhaltung: [
      { key: 'cmr_docs', label: 'Belege', table: 'cmr_documents', scope: 'tenant', to: '/cmr/buchhaltung' },
      { key: 'cmr_pay', label: 'Zahlungen', table: 'cmr_payments', scope: 'tenant', to: '/cmr/buchhaltung' },
      { key: 'cmr_rec', label: 'Abos', table: 'cmr_recurring_plans', scope: 'tenant', to: '/cmr/abos' },
    ],
    lager: [
      { key: 'cmr_items', label: 'Artikel', table: 'cmr_items', scope: 'tenant', to: '/cmr/artikel' },
    ],
    fertigung: [
      { key: 'cmr_projects', label: 'Projekte', table: 'cmr_projects', scope: 'tenant', to: '/cmr/projekte' },
    ],
    operation: [
      { key: 'cmr_projects', label: 'Projekte', table: 'cmr_projects', scope: 'tenant', to: '/cmr/projekte' },
      { key: 'cmr_docs', label: 'Belege', table: 'cmr_documents', scope: 'tenant', to: '/cmr/dokumente' },
    ],
  },
  MED: {
    verkauf: [
      { key: 'med_docs', label: 'Belege', table: 'med_documents', scope: 'tenant', to: '/med/belege' },
      { key: 'med_items', label: 'Artikel', table: 'med_items', scope: 'tenant', to: '/med/artikel' },
      { key: 'customers', label: 'Kunden', table: 'customers', scope: 'source', to: '/kunden' },
    ],
    buchhaltung: [
      { key: 'med_docs', label: 'Belege', table: 'med_documents', scope: 'tenant', to: '/med/buchhaltung' },
      { key: 'med_pay', label: 'Zahlungen', table: 'med_payments', scope: 'tenant', to: '/med/buchhaltung' },
    ],
    lager: [
      { key: 'med_items', label: 'Artikel', table: 'med_items', scope: 'tenant', to: '/med/artikel' },
    ],
    fertigung: [
      { key: 'med_items', label: 'Artikel', table: 'med_items', scope: 'tenant', to: '/med/artikel' },
      { key: 'med_compliance', label: 'Compliance-Dokumente', table: 'med_compliance_docs', scope: 'tenant', to: '/med/compliance' },
    ],
    operation: [
      { key: 'med_docs', label: 'Belege', table: 'med_documents', scope: 'tenant', to: '/med/belege' },
      { key: 'med_compliance', label: 'Compliance-Dokumente', table: 'med_compliance_docs', scope: 'tenant', to: '/med/compliance' },
    ],
  },
};

export default function WorkspaceDashboard() {
  const { code } = useParams<{ code: string }>();
  const { workspaces, navItems, current, setCurrent } = useWorkspace();
  const { current: tenant, sourceFilter } = useTenant();
  const [counts, setCounts] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);
  const [qaSize, setQaSize] = useState<number>(() => {
    try { return Number(localStorage.getItem(QA_SIZE_KEY)) || 100; } catch { return 100; }
  });

  useEffect(() => {
    try { localStorage.setItem(QA_SIZE_KEY, String(qaSize)); } catch { /* ignore */ }
  }, [qaSize]);


  const ws = workspaces.find(w => w.code === code) || current;
  const tenantCode = tenant?.code ?? null;
  const kpis = (tenantCode && TENANT_KPIS[tenantCode]?.[ws?.code ?? ''])
    || KPIS[ws?.code ?? '']
    || [];

  useEffect(() => {
    if (code && ws && ws.code !== current?.code) setCurrent(ws);
  }, [code, ws?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    if (kpis.length === 0) { setCounts({}); setLoading(false); return; }
    setLoading(true);
    (async () => {
      const res: Record<string, number | null> = {};
      await Promise.all(kpis.map(async (k) => {
        try {
          const hasSelectedTenant = Boolean(tenant);
          const hasSources = Boolean(sourceFilter && sourceFilter.length > 0);

          // Legacy-Tabellen ohne belastbare Mandantenzuordnung gehören nur zur DE-Ansicht.
          if (k.scope === 'unscoped' && hasSelectedTenant && tenantCode !== 'DE') {
            res[k.key] = 0;
            return;
          }
          // Mandanten ohne Zoho-Zuordnung dürfen niemals fremde operative Daten sehen.
          if (['source', 'customer', 'order', 'lead-country'].includes(k.scope) && hasSelectedTenant && !hasSources) {
            res[k.key] = 0;
            return;
          }

          let select = 'id';
          if (k.scope === 'customer') select = 'id, customers!inner(source_system)';
          if (k.scope === 'order') select = 'id, orders!inner(source_system)';
          let q: any = supabase.from(k.table as any).select(select, { count: 'exact', head: true });

          if (k.scope === 'source' && hasSources) q = q.in('source_system', sourceFilter);
          if (k.scope === 'customer' && hasSources) q = q.in('customers.source_system', sourceFilter);
          if (k.scope === 'order' && hasSources) q = q.in('orders.source_system', sourceFilter);
          if (k.scope === 'tenant' && tenant?.id) q = q.eq('tenant_id', tenant.id);
          if (k.scope === 'lead-country' && tenantCode === 'DE') q = q.eq('country_code', '+49');
          if (k.scope === 'lead-country' && tenantCode === 'AT') q = q.eq('country_code', '+43');

          const { count, error } = await q;
          res[k.key] = error ? null : (count ?? 0);
        } catch {
          res[k.key] = null;
        }
      }));
      if (!cancelled) { setCounts(res); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [ws?.code, tenantCode, sourceFilter?.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps




  if (!ws) {
    return <div className="p-6 text-muted-foreground">Kein Workspace verfügbar.</div>;
  }

  // In allen Workspaces nur die Hauptgruppen (Sektionen) statt aller Unterpunkte anzeigen
  const visibleNav = navItems.filter(n => n.path !== `/w/${ws.code}`);
  const quickItems = (() => {
    const seen = new Set<string>();
    const out: typeof visibleNav = [];
    for (const n of visibleNav) {
      const section = (n.section || n.label).split('›').pop()!.trim();
      if (seen.has(section)) continue;
      seen.add(section);
      out.push({ ...n, label: section });
    }
    return out;
  })();

  

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
        <div className="flex items-center justify-between gap-4 mb-3 flex-wrap">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Schnellzugriff
          </h2>
          <div className="flex items-center gap-3 min-w-[200px]">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Größe</span>
            <Slider
              value={[qaSize]}
              onValueChange={(v) => setQaSize(v[0])}
              min={70}
              max={140}
              step={5}
              className="w-36"
              aria-label="Größe der Schnellzugriff-Buttons"
            />
            <span className="text-[11px] tabular-nums text-muted-foreground w-10 text-right">{qaSize}%</span>
          </div>
        </div>
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${Math.round(220 * qaSize / 100)}px, 1fr))` }}
        >
          {quickItems.map((n) => {
            const Icon = iconFor(n.icon);
            return (
              <Link
                key={n.id}
                to={n.path}
                className="flex items-center gap-3 rounded-lg border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-colors"
                style={{
                  paddingInline: `${Math.round(16 * qaSize / 100)}px`,
                  paddingBlock: `${Math.round(12 * qaSize / 100)}px`,
                  fontSize: `${Math.round(14 * qaSize / 100)}px`,
                }}
              >
                <Icon className="text-primary flex-shrink-0" style={{ width: `${Math.round(16 * qaSize / 100)}px`, height: `${Math.round(16 * qaSize / 100)}px` }} />
                <span className="truncate">{n.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

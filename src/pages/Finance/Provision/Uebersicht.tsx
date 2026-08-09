import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantFilter } from '@/hooks/useTenantFilter';
import { PageHeader } from '@/components/infinity/PageHeader';
import { KpiTile } from '@/components/infinity/KpiTile';
import { DataCard } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Coins, RefreshCw, Users, AlertTriangle, Wallet, CheckCircle2, Ban, Undo2, CalendarClock } from 'lucide-react';
import { fmtMoney, STATUS_LABELS, type CommissionStatus } from '@/lib/commission/constants';
import { CommissionList } from '@/components/commission/CommissionList';
import { useCommissionPermissions } from '@/hooks/useCommissionPermissions';

export default function ProvisionUebersicht() {
  const { tenantId } = useTenantFilter();
  const perms = useCommissionPermissions();
  const [busy, setBusy] = useState(false);
  const [kpi, setKpi] = useState({
    month: 0, year: 0, open: 0, approval: 0, scheduled: 0, paid: 0, blocked: 0, reclaims: 0,
    unassigned: 0, topEmployee: '–', nextPayout: '–',
  });
  const [byStatus, setByStatus] = useState<Record<string, number>>({});

  const load = async () => {
    let cq: any = supabase.from('commission_entries').select('*').limit(2000);
    if (tenantId) cq = cq.eq('tenant_id', tenantId);
    const { data } = await cq;
    const rows = data ?? [];
    const now = new Date();
    const sum = (f: (r: any) => boolean) => rows.filter(f).reduce((s, r) => s + Number(r.commission_amount), 0);
    const inMonth = (r: any) => r.created_at && new Date(r.created_at).getMonth() === now.getMonth() && new Date(r.created_at).getFullYear() === now.getFullYear();
    const inYear = (r: any) => r.created_at && new Date(r.created_at).getFullYear() === now.getFullYear();

    const perEmployee = new Map<string, number>();
    rows.forEach((r: any) => perEmployee.set(r.employee_id, (perEmployee.get(r.employee_id) ?? 0) + Number(r.commission_amount)));
    const top = [...perEmployee.entries()].sort((a, b) => b[1] - a[1])[0];
    let topName = '–';
    if (top) {
      const { data: p } = await supabase.from('user_profiles').select('full_name, email').eq('id', top[0]).maybeSingle();
      topName = p?.full_name || p?.email || '–';
    }
    const dues = rows.map((r: any) => r.payout_due_date).filter(Boolean).sort();
    const nextDue = dues.find((d: string) => d >= now.toISOString().slice(0, 10));

    const { count: ordersCount } = await supabase.from('orders').select('id', { count: 'exact', head: true });
    const assignedOrders = new Set(rows.map((r: any) => r.order_id).filter(Boolean));

    const statusMap: Record<string, number> = {};
    rows.forEach((r: any) => { statusMap[r.status] = (statusMap[r.status] ?? 0) + 1; });
    setByStatus(statusMap);

    setKpi({
      month: sum(inMonth),
      year: sum(inYear),
      open: sum((r) => ['preliminary', 'condition_open', 'effective', 'in_review'].includes(r.status)),
      approval: sum((r) => r.status === 'pending_approval'),
      scheduled: sum((r) => r.status === 'payout_scheduled'),
      paid: sum((r) => ['paid', 'partially_paid', 'closed'].includes(r.status)),
      blocked: sum((r) => r.status === 'blocked'),
      reclaims: sum((r) => r.status === 'reclaimed'),
      unassigned: Math.max(0, (ordersCount ?? 0) - assignedOrders.size),
      topEmployee: topName,
      nextPayout: nextDue ? new Date(nextDue).toLocaleDateString('de-DE') : '–',
    });
  };

  useEffect(() => { load(); }, []);

  const scan = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('commission-engine', { body: { action: 'scan_orders', limit: 500 } });
    setBusy(false);
    if (error || (data as any)?.error) return toast.error((data as any)?.error ?? error?.message ?? 'Berechnung fehlgeschlagen');
    toast.success(`${(data as any).created} Provisionsposten erzeugt · ${(data as any).unassigned} Aufträge ohne Zuordnung`);
    load();
  };

  return (
    <div className="p-6 lg:p-8 animate-fade-in space-y-6">
      <PageHeader
        title="Provision Mitarbeiter"
        subtitle="Berechnung, Prüfung, Freigabe und Auszahlung von Mitarbeiterprovisionen"
        icon={Coins}
        actions={perms.canManage ? (
          <Button onClick={scan} disabled={busy}>
            <RefreshCw className="h-4 w-4 mr-2" />{busy ? 'Berechne…' : 'Provisionen berechnen'}
          </Button>
        ) : undefined}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile label="Provisionen laufender Monat" value={fmtMoney(kpi.month)} icon={Coins} accent="gold" />
        <KpiTile label="Provisionen laufendes Jahr" value={fmtMoney(kpi.year)} icon={Coins} accent="gold" />
        <KpiTile label="Offene Provisionen" value={fmtMoney(kpi.open)} icon={CalendarClock} accent="sky" />
        <KpiTile label="Zur Freigabe" value={fmtMoney(kpi.approval)} icon={AlertTriangle} accent="violet" />
        <KpiTile label="Zur Auszahlung vorgemerkt" value={fmtMoney(kpi.scheduled)} icon={Wallet} accent="sky" />
        <KpiTile label="Ausgezahlt" value={fmtMoney(kpi.paid)} icon={CheckCircle2} accent="emerald" />
        <KpiTile label="Gesperrt" value={fmtMoney(kpi.blocked)} icon={Ban} accent="rose" />
        <KpiTile label="Rückforderungen" value={fmtMoney(kpi.reclaims)} icon={Undo2} accent="rose" />
        <KpiTile label="Aufträge ohne Zuordnung" value={kpi.unassigned} icon={Users} accent="violet" />
        <KpiTile label="Mitarbeiter mit höchster Provision" value={kpi.topEmployee} icon={Users} accent="gold" />
        <KpiTile label="Nächster Auszahlungstermin" value={kpi.nextPayout} icon={CalendarClock} accent="sky" />
      </div>

      <DataCard title="Verteilung nach Provisionsstatus">
        <div className="flex flex-wrap gap-2 text-xs">
          {Object.entries(byStatus).length === 0 && <span className="text-muted-foreground">Noch keine Provisionsposten berechnet.</span>}
          {Object.entries(byStatus).map(([k, v]) => (
            <span key={k} className="rounded-full border border-border bg-muted/40 px-3 py-1">
              {STATUS_LABELS[k as CommissionStatus] ?? k}: <strong>{v}</strong>
            </span>
          ))}
        </div>
      </DataCard>

      <DataCard title="Alle Provisionsposten" className="p-0">
        <div className="p-5"><CommissionList bucket="all" /></div>
      </DataCard>
    </div>
  );
}

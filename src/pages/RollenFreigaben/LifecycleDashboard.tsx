import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, GaugeCircle, AlertTriangle, ClipboardCheck, Clock, Flame, GitFork, ShieldCheck, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function LifecycleDashboard() {
  const [loading, setLoading] = useState(true);
  const [kpi, setKpi] = useState<any>({});

  const load = async () => {
    setLoading(true);
    const [users, roles, tempActive, tempExpiring, recertActive, recertOverdue, requestsOpen, breakGlass, sodConflicts, scheduled] = await Promise.all([
      (supabase as any).from('user_profiles').select('id', { count: 'exact', head: true }),
      (supabase as any).from('roles').select('id', { count: 'exact', head: true }),
      (supabase as any).from('role_temporary_grants').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      (supabase as any).from('role_temporary_grants').select('id', { count: 'exact', head: true }).eq('status', 'active').lte('valid_until', new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()),
      (supabase as any).from('role_recert_campaigns').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      (supabase as any).from('role_recert_campaigns').select('id', { count: 'exact', head: true }).eq('status', 'active').lte('period_end', new Date().toISOString().split('T')[0]),
      (supabase as any).from('role_change_requests').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      (supabase as any).from('role_break_glass_sessions').select('id', { count: 'exact', head: true }).is('revoked_at', null).gt('expires_at', new Date().toISOString()),
      (supabase as any).rpc('sod_conflict_report').then((r: any) => ({ count: (r.data ?? []).length })),
      (supabase as any).from('role_temporary_grants').select('id', { count: 'exact', head: true }).eq('status', 'scheduled'),
    ]);
    setKpi({
      users: users.count ?? 0,
      roles: roles.count ?? 0,
      tempActive: tempActive.count ?? 0,
      tempExpiring: tempExpiring.count ?? 0,
      recertActive: recertActive.count ?? 0,
      recertOverdue: recertOverdue.count ?? 0,
      requestsOpen: requestsOpen.count ?? 0,
      breakGlass: breakGlass.count ?? 0,
      sodConflicts: sodConflicts.count ?? 0,
      scheduled: scheduled.count ?? 0,
    });
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  if (loading) return <div className="flex items-center gap-2 text-muted-foreground p-8"><Loader2 className="w-4 h-4 animate-spin" /> Lade…</div>;

  const cards = [
    { label: 'Benutzer', value: kpi.users, icon: ShieldCheck, cls: '', to: '/admin/rollen-freigaben/mitarbeiter' },
    { label: 'Rollen', value: kpi.roles, icon: ShieldCheck, cls: '', to: '/admin/rollen-freigaben/rollen' },
    { label: 'Offene Freigabeanträge', value: kpi.requestsOpen, icon: ClipboardCheck, cls: kpi.requestsOpen > 0 ? 'border-amber-500/40 bg-amber-500/5' : '', to: '/admin/rollen-freigaben/antraege' },
    { label: 'SoD-Konflikte', value: kpi.sodConflicts, icon: GitFork, cls: kpi.sodConflicts > 0 ? 'border-red-500/40 bg-red-500/5' : '', to: '/admin/rollen-freigaben/sod' },
    { label: 'Aktive befristete Rechte', value: kpi.tempActive, icon: Clock, cls: '', to: '/admin/rollen-freigaben/befristet' },
    { label: 'Läuft in ≤ 7 Tagen ab', value: kpi.tempExpiring, icon: AlertTriangle, cls: kpi.tempExpiring > 0 ? 'border-amber-500/40 bg-amber-500/5' : '', to: '/admin/rollen-freigaben/befristet' },
    { label: 'Geplante Zuweisungen', value: kpi.scheduled, icon: TrendingUp, cls: '', to: '/admin/rollen-freigaben/geplant' },
    { label: 'Aktive Recert-Kampagnen', value: kpi.recertActive, icon: ClipboardCheck, cls: '', to: '/admin/rollen-freigaben/rezertifizierung' },
    { label: 'Überfällige Recert', value: kpi.recertOverdue, icon: AlertTriangle, cls: kpi.recertOverdue > 0 ? 'border-red-500/40 bg-red-500/5' : '', to: '/admin/rollen-freigaben/rezertifizierung' },
    { label: 'Aktive Break-Glass', value: kpi.breakGlass, icon: Flame, cls: kpi.breakGlass > 0 ? 'border-red-500/40 bg-red-500/5' : '', to: '/admin/rollen-freigaben/break-glass' },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2"><GaugeCircle className="w-5 h-5" /> Lifecycle-Dashboard</h2>
        <p className="text-xs text-muted-foreground">Compliance-Cockpit: Alle offenen Aufgaben und Risiken der Rollen- und Rechteverwaltung.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {cards.map(c => {
          const Icon = c.icon;
          return (
            <Link key={c.label} to={c.to}>
              <Card className={`p-4 hover:border-primary/40 transition-colors cursor-pointer ${c.cls}`}>
                <div className="flex items-center justify-between">
                  <Icon className="w-5 h-5 text-primary/80" />
                  <Badge variant="outline" className="text-xs">{c.value}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-2">{c.label}</div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

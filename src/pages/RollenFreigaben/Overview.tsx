import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Users, Shield, AlertTriangle, Clock, FileWarning, UserX,
  UserCheck, KeyRound, Building2, Timer, Loader2,
} from 'lucide-react';
import { fetchOverviewData, CRITICAL_ROLE_NAMES, levelClasses } from './lib';

type Kpi = { label: string; value: number | string; icon: any; tone?: 'default' | 'warn' | 'critical' | 'good' };

export default function Overview() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchOverviewData>> | null>(null);

  useEffect(() => {
    fetchOverviewData().then(d => { setData(d); setLoading(false); });
  }, []);

  if (loading || !data) {
    return <div className="flex items-center gap-2 text-muted-foreground p-8"><Loader2 className="w-4 h-4 animate-spin" /> Lade Bestandsaufnahme…</div>;
  }

  const activeUsers = data.users.filter(u => u.is_active).length;
  const usersWithoutRole = data.users.filter(u => !data.userRoles.some(r => r.user_id === u.id)).length;
  const usersWithMultipleRoles = data.users.filter(u => data.userRoles.filter(r => r.user_id === u.id).length > 1).length;
  const criticalRoleIds = new Set(data.roles.filter(r => CRITICAL_ROLE_NAMES.has(r.name)).map(r => r.id));
  const usersWithCritical = new Set(data.userRoles.filter(r => criticalRoleIds.has(r.role_id)).map(r => r.user_id)).size;
  const superAdmins = new Set(
    data.userRoles.filter(r => data.roles.find(x => x.id === r.role_id)?.name === 'Super Admin').map(r => r.user_id)
  ).size;
  const inactiveWithRoles = data.users.filter(u => !u.is_active && data.userRoles.some(r => r.user_id === u.id)).length;
  const usersWithoutTenant = data.users.filter(u => !data.userTenants.some(t => t.user_id === u.id)).length;
  const rolesWithoutDescription = data.roles.filter(r => !r.description).length;
  const rolesUnused = data.roles.filter(r => !data.userRoles.some(x => x.role_id === r.id)).length;

  const kpis: Kpi[] = [
    { label: 'Aktive Rollen', value: data.roles.length, icon: Shield, tone: 'good' },
    { label: 'Aktive Benutzer', value: activeUsers, icon: UserCheck, tone: 'good' },
    { label: 'Super Administratoren', value: superAdmins, icon: KeyRound, tone: 'critical' },
    { label: 'Benutzer mit kritischer Rolle', value: usersWithCritical, icon: AlertTriangle, tone: 'warn' },
    { label: 'Benutzer mit mehreren Rollen', value: usersWithMultipleRoles, icon: Users, tone: 'warn' },
    { label: 'Offene Freigabeanträge', value: data.openRequests.length, icon: FileWarning, tone: data.openRequests.length ? 'warn' : 'default' },
    { label: 'Aktive befristete Rechte', value: data.activeTempGrants.length, icon: Timer, tone: data.activeTempGrants.length ? 'warn' : 'default' },
    { label: 'Niederlassungen', value: data.tenants.length, icon: Building2, tone: 'default' },
  ];

  const warnings = [
    { label: 'Benutzer ohne Rolle', value: usersWithoutRole, icon: UserX, level: usersWithoutRole > 0 ? 'critical' : 'safe' as const },
    { label: 'Benutzer ohne Niederlassung', value: usersWithoutTenant, icon: Building2, level: usersWithoutTenant > 0 ? 'review' : 'safe' as const },
    { label: 'Inaktive mit aktiven Rechten', value: inactiveWithRoles, icon: AlertTriangle, level: inactiveWithRoles > 0 ? 'critical' : 'safe' as const },
    { label: 'Rollen ohne Beschreibung', value: rolesWithoutDescription, icon: FileWarning, level: rolesWithoutDescription > 0 ? 'review' : 'safe' as const },
    { label: 'Nicht genutzte Rollen', value: rolesUnused, icon: Shield, level: rolesUnused > 0 ? 'review' : 'safe' as const },
    { label: 'Letzte Rollenänderung', value: data.lastAudit?.created_at ? new Date(data.lastAudit.created_at).toLocaleString('de-DE') : '—', icon: Clock, level: 'safe' as const },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map(k => (
          <Card key={k.label} className="p-4 bg-card/60 backdrop-blur border-border/60 hover:border-primary/40 transition-colors">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-2xl font-bold tabular-nums">{k.value}</div>
                <div className="text-xs text-muted-foreground mt-1 truncate">{k.label}</div>
              </div>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                k.tone === 'critical' ? 'bg-red-500/10 text-red-500'
                : k.tone === 'warn' ? 'bg-amber-500/10 text-amber-500'
                : k.tone === 'good' ? 'bg-emerald-500/10 text-emerald-500'
                : 'bg-primary/10 text-primary'
              }`}>
                <k.icon className="w-4 h-4" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Warnkarten */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Sicherheits-Warnhinweise</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {warnings.map(w => (
            <Card key={w.label} className={`p-4 border ${levelClasses(w.level as any)}`}>
              <div className="flex items-center gap-3">
                <w.icon className="w-5 h-5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{w.label}</div>
                  <div className="text-xl font-bold tabular-nums mt-0.5">{w.value}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <Card className="p-4 bg-muted/30 border-dashed">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p className="text-foreground font-medium mb-1">Bestandsaufnahme abgeschlossen</p>
            Dieses Modul <b>ändert keine bestehenden Rollen oder Zuweisungen</b>. Es visualisiert die aktuelle RBAC
            (<code>public.user_roles</code>, <code>public.roles</code>, <code>tenants</code>) und ergänzt Freigabeanträge, Audit-Log
            und befristete Rechte in neuen additiven Tabellen. Kritische Änderungen benötigen Vier-Augen-Freigabe.
          </div>
        </div>
      </Card>
    </div>
  );
}

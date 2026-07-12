import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, ClipboardCheck, AlertTriangle, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { CRITICAL_ROLE_NAMES } from './lib';

type Check = {
  id: string;
  label: string;
  severity: 'critical' | 'warn' | 'info';
  count: number;
  detail: string;
  items?: string[];
};

export default function SecurityAudit() {
  const [loading, setLoading] = useState(true);
  const [checks, setChecks] = useState<Check[]>([]);
  const [score, setScore] = useState(0);

  const run = async () => {
    setLoading(true);
    const [users, roles, userRoles, uta, temp] = await Promise.all([
      supabase.from('user_profiles').select('id, full_name, email, is_active, account_status'),
      supabase.from('roles').select('id, name, description'),
      supabase.from('user_roles').select('user_id, role_id'),
      supabase.from('user_tenant_access').select('user_id'),
      (supabase as any).from('role_temporary_grants').select('id, valid_until, status').eq('status', 'active'),
    ]);
    const U = users.data ?? []; const R = roles.data ?? []; const UR = userRoles.data ?? [];
    const UT = uta.data ?? []; const T = temp.data ?? [];

    const criticalRoleIds = new Set(R.filter(r => CRITICAL_ROLE_NAMES.has(r.name)).map(r => r.id));
    const superAdmins = UR.filter(x => R.find(r => r.id === x.role_id)?.name === 'Super Admin');
    const usersWithoutRole = U.filter(u => !UR.some(r => r.user_id === u.id));
    const usersMulti = U.filter(u => UR.filter(r => r.user_id === u.id).length >= 3);
    const inactiveWithRoles = U.filter(u => !u.is_active && UR.some(r => r.user_id === u.id));
    const noTenant = U.filter(u => u.is_active && !UT.some(t => t.user_id === u.id));
    const rolesNoDesc = R.filter(r => !r.description);
    const rolesUnused = R.filter(r => !UR.some(x => x.role_id === r.id));
    const tempExpiringSoon = T.filter((t: any) => new Date(t.valid_until).getTime() < Date.now() + 7 * 24 * 3600 * 1000);
    const criticalWithoutTenant = U.filter(u => u.is_active && UR.some(r => r.user_id === u.id && criticalRoleIds.has(r.role_id)) && !UT.some(t => t.user_id === u.id));

    const list: Check[] = [
      { id: 'super', label: 'Super Administratoren', severity: 'critical', count: new Set(superAdmins.map(s => s.user_id)).size,
        detail: 'Anzahl aktiver Super-Admin-Zuweisungen — sollte minimal gehalten werden (Empfehlung ≤ 2).',
        items: superAdmins.map(s => U.find(u => u.id === s.user_id)?.full_name ?? s.user_id).filter(Boolean) as string[] },
      { id: 'noRole', label: 'Benutzer ohne Rolle', severity: 'critical', count: usersWithoutRole.length,
        detail: 'Aktive Benutzer ohne Rollenzuweisung sollten deaktiviert oder mit einer Rolle versehen werden.',
        items: usersWithoutRole.map(u => u.full_name ?? u.email ?? u.id).filter(Boolean) as string[] },
      { id: 'inactiveRoles', label: 'Inaktive Benutzer mit aktiven Rechten', severity: 'critical', count: inactiveWithRoles.length,
        detail: 'Rechte müssen bei Deaktivierung sofort entzogen werden (Offboarding).',
        items: inactiveWithRoles.map(u => u.full_name ?? u.email ?? u.id).filter(Boolean) as string[] },
      { id: 'critNoTenant', label: 'Kritische Rolle ohne Niederlassung', severity: 'critical', count: criticalWithoutTenant.length,
        detail: 'Benutzer mit kritischen Rollen sollten explizit einer Niederlassung zugeordnet sein.' },
      { id: 'multi', label: 'Benutzer mit ≥ 3 Rollen', severity: 'warn', count: usersMulti.length,
        detail: 'Viele Rollen erhöhen die Angriffsfläche. Prüfen auf widersprüchliche Rechte.',
        items: usersMulti.map(u => u.full_name ?? u.email ?? u.id).filter(Boolean) as string[] },
      { id: 'noTenant', label: 'Aktive Benutzer ohne Niederlassung', severity: 'warn', count: noTenant.length,
        detail: 'Ohne Tenant-Zuordnung greifen keine Niederlassungs-/Länderfilter.' },
      { id: 'noDesc', label: 'Rollen ohne Beschreibung', severity: 'warn', count: rolesNoDesc.length,
        detail: 'Beschreibungen sind wichtig für Audits und Governance.',
        items: rolesNoDesc.map(r => r.name) },
      { id: 'unused', label: 'Nicht genutzte Rollen', severity: 'info', count: rolesUnused.length,
        detail: 'Rollen ohne Zuweisung können archiviert werden.',
        items: rolesUnused.map(r => r.name) },
      { id: 'tempSoon', label: 'Befristete Rechte laufen bald ab (7 Tage)', severity: 'info', count: tempExpiringSoon.length,
        detail: 'Verlängerung oder Auslauf rechtzeitig planen.' },
    ];

    setChecks(list);
    const critFails = list.filter(c => c.severity === 'critical' && c.count > 0).length;
    const warnFails = list.filter(c => c.severity === 'warn' && c.count > 0).length;
    const s = Math.max(0, 100 - critFails * 20 - warnFails * 5);
    setScore(s);
    setLoading(false);
  };

  useEffect(() => { run(); }, []);

  const overall = score >= 90 ? 'safe' : score >= 70 ? 'review' : score >= 40 ? 'risk' : 'critical';
  const overallLabel = { safe: 'Sicher', review: 'Prüfung empfohlen', risk: 'Erhöhtes Risiko', critical: 'Kritisch' }[overall];
  const overallColor = { safe: 'text-emerald-500 border-emerald-500/40 bg-emerald-500/10', review: 'text-amber-500 border-amber-500/40 bg-amber-500/10', risk: 'text-orange-500 border-orange-500/40 bg-orange-500/10', critical: 'text-red-500 border-red-500/40 bg-red-500/10' }[overall];

  if (loading) return <div className="flex items-center gap-2 text-muted-foreground p-8"><Loader2 className="w-4 h-4 animate-spin" /> Prüfe…</div>;

  return (
    <div className="space-y-4">
      <Card className={`p-6 border-2 ${overallColor}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ClipboardCheck className="w-8 h-8" />
            <div>
              <div className="text-xs uppercase opacity-70">Gesamtbewertung</div>
              <div className="text-3xl font-bold">{overallLabel}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-5xl font-bold tabular-nums">{score}</div>
            <div className="text-xs opacity-70">von 100</div>
          </div>
        </div>
        <div className="mt-4">
          <Button size="sm" variant="outline" onClick={run}><RefreshCw className="w-3 h-3 mr-1" /> Erneut prüfen</Button>
        </div>
      </Card>

      <div className="space-y-2">
        {checks.map(c => {
          const failed = c.count > 0 && c.id !== 'super'; // Super ist Info, aber angezeigt
          const passing = c.count === 0;
          const Icon = passing ? CheckCircle2 : c.severity === 'critical' ? XCircle : AlertTriangle;
          const tone = passing ? 'text-emerald-500 border-emerald-500/30 bg-emerald-500/5'
            : c.severity === 'critical' ? 'text-red-500 border-red-500/30 bg-red-500/5'
            : c.severity === 'warn' ? 'text-amber-500 border-amber-500/30 bg-amber-500/5'
            : 'text-primary border-primary/30 bg-primary/5';
          return (
            <Card key={c.id} className={`p-4 border ${tone}`}>
              <div className="flex items-start gap-3">
                <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground">{c.label}</span>
                    <Badge variant="outline" className="tabular-nums">{c.count}</Badge>
                    <Badge variant="outline" className="text-[10px] uppercase">{c.severity}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{c.detail}</div>
                  {c.items && c.items.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {c.items.slice(0, 8).map((it, i) => <Badge key={i} variant="outline" className="text-[10px]">{it}</Badge>)}
                      {c.items.length > 8 && <Badge variant="outline" className="text-[10px]">+{c.items.length - 8} weitere</Badge>}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="p-4 bg-muted/30 border-dashed text-xs text-muted-foreground">
        Diese Prüfung ist ein <b>Frühwarnsystem</b>. Server-seitige Sicherheit wird zusätzlich durch RLS-Policies auf allen Tabellen erzwungen — Details im <a href="/security-center" className="text-primary underline">Security Center</a>.
      </Card>
    </div>
  );
}

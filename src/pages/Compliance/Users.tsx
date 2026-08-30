import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { COMPLIANCE_ROLES, useComplianceProfile } from '@/hooks/useComplianceProfile';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Row {
  id: string; full_name: string | null; email: string | null;
  compliance_access: boolean; compliance_role: string | null;
  compliance_only_user: boolean; compliance_default_project_id: string | null;
}
interface Project { id: string; code: string; name: string }

export default function ComplianceUsers() {
  const c = useComplianceProfile();
  const [rows, setRows] = useState<Row[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: u }, { data: p }] = await Promise.all([
      (supabase as any)
        .from('user_profiles')
        .select('id, full_name, email, compliance_access, compliance_role, compliance_only_user, compliance_default_project_id')
        .order('full_name'),
      (supabase as any).from('compliance_projects').select('id, code, name').order('code'),
    ]);
    setRows((u as Row[]) || []);
    setProjects((p as Project[]) || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const patch = async (id: string, values: Partial<Row>) => {
    const { error } = await (supabase as any).from('user_profiles').update(values).eq('id', id);
    if (error) { toast.error(error.message); return; }
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...values } as Row : r)));
    toast.success('Gespeichert');
  };

  const assignProject = async (userId: string, projectId: string, role: string) => {
    const { error } = await (supabase as any).from('compliance_project_members').upsert(
      { project_id: projectId, user_id: userId, role, active: true },
      { onConflict: 'project_id,user_id' },
    );
    if (error) toast.error(error.message);
    else toast.success('Projekt zugewiesen');
  };

  if (!c.isComplianceAdmin) return <div className="text-sm text-muted-foreground">Kein Zugriff auf die Benutzerverwaltung.</div>;

  const filtered = rows.filter((r) => !q || `${r.full_name ?? ''} ${r.email ?? ''}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4 max-w-5xl">
      <h1 className="text-xl font-semibold">Benutzer · Software &amp; Compliance</h1>
      <Card><CardContent className="pt-6"><Input className="max-w-sm" placeholder="Suchen…" value={q} onChange={(e) => setQ(e.target.value)} /></CardContent></Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Benutzer ({filtered.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {loading && <div className="py-6 text-center text-sm text-muted-foreground">Lädt…</div>}
          {filtered.map((r) => (
            <div key={r.id} className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-[13px] font-medium">{r.full_name || '—'}</div>
                  <div className="text-[11px] text-muted-foreground">{r.email}</div>
                </div>
                {r.compliance_access ? <Badge variant="outline" className="bg-emerald-500/15 text-emerald-500">Zugang aktiv</Badge>
                  : <Badge variant="outline">kein Zugang</Badge>}
              </div>
              <div className="grid gap-3 md:grid-cols-4 items-center">
                <label className="flex items-center gap-2 text-[12px]">
                  <Switch checked={r.compliance_access} onCheckedChange={(v) => patch(r.id, { compliance_access: v })} />
                  Compliance-Zugang
                </label>
                <label className="flex items-center gap-2 text-[12px]">
                  <Switch checked={r.compliance_only_user} onCheckedChange={(v) => patch(r.id, { compliance_only_user: v })} />
                  Nur Compliance
                </label>
                <Select value={r.compliance_role || ''} onValueChange={(v) => patch(r.id, { compliance_role: v })}>
                  <SelectTrigger><SelectValue placeholder="Compliance-Rolle" /></SelectTrigger>
                  <SelectContent>{COMPLIANCE_ROLES.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                </Select>
                <Select
                  value={r.compliance_default_project_id || ''}
                  onValueChange={(v) => { patch(r.id, { compliance_default_project_id: v }); assignProject(r.id, v, r.compliance_role || 'COMPLIANCE_USER'); }}
                >
                  <SelectTrigger><SelectValue placeholder="Projekt zuweisen" /></SelectTrigger>
                  <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.code}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {r.compliance_access && (
                <Button size="sm" variant="outline" onClick={() => patch(r.id, { compliance_access: false, compliance_only_user: false })}>
                  Access deaktivieren
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

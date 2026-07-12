import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Upload, Download, Users, ShieldPlus, ShieldMinus, FileText } from 'lucide-react';
import { toast } from 'sonner';

type User = { id: string; full_name: string | null; email: string | null; is_active: boolean };
type Role = { id: string; name: string };

const csvEscape = (v: any) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const downloadCsv = (name: string, rows: string[][]) => {
  const csv = rows.map(r => r.map(csvEscape).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name; a.click(); URL.revokeObjectURL(a.href);
};

export default function BulkImportExport() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [userRoles, setUserRoles] = useState<{ user_id: string; role_id: string }[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [roleId, setRoleId] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const [u, r, ur] = await Promise.all([
      supabase.from('user_profiles').select('id, full_name, email, is_active').order('full_name'),
      supabase.from('roles').select('id, name').order('name'),
      supabase.from('user_roles').select('user_id, role_id'),
    ]);
    setUsers(u.data ?? []); setRoles(r.data ?? []); setUserRoles(ur.data ?? []); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter(u => (u.full_name ?? '').toLowerCase().includes(s) || (u.email ?? '').toLowerCase().includes(s));
  }, [users, q]);

  const toggle = (id: string) => {
    const n = new Set(selected);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelected(n);
  };
  const toggleAll = () => {
    setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map(u => u.id)));
  };

  const bulkGrant = async () => {
    if (!roleId || selected.size === 0) { toast.error('Rolle und Benutzer wählen'); return; }
    setBusy(true);
    const rows = Array.from(selected).map(user_id => ({ user_id, role_id: roleId }));
    const { error } = await supabase.from('user_roles').upsert(rows, { onConflict: 'user_id,role_id', ignoreDuplicates: true });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Rolle vergeben an ${selected.size} Benutzer`);
    setSelected(new Set()); load();
  };

  const bulkRevoke = async () => {
    if (!roleId || selected.size === 0) { toast.error('Rolle und Benutzer wählen'); return; }
    if (!confirm(`Rolle wirklich von ${selected.size} Benutzern entziehen?`)) return;
    setBusy(true);
    const { error } = await supabase.from('user_roles').delete()
      .eq('role_id', roleId).in('user_id', Array.from(selected));
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Rolle entzogen von ${selected.size} Benutzern`);
    setSelected(new Set()); load();
  };

  const exportMatrix = () => {
    const header = ['user_id', 'name', 'email', ...roles.map(r => r.name)];
    const roleMap = new Set(userRoles.map(ur => `${ur.user_id}|${ur.role_id}`));
    const rows = users.map(u => [
      u.id, u.full_name ?? '', u.email ?? '',
      ...roles.map(r => roleMap.has(`${u.id}|${r.id}`) ? '1' : '0'),
    ]);
    downloadCsv(`rollenmatrix_${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows]);
  };

  const exportAudit = async () => {
    const { data, error } = await (supabase as any).from('role_audit_log')
      .select('created_at, actor_user_id, target_user_id, role_name, change_type, reason')
      .order('created_at', { ascending: false }).limit(5000);
    if (error) { toast.error(error.message); return; }
    const rows = [
      ['zeit', 'actor', 'ziel', 'rolle', 'aktion', 'grund'],
      ...(data ?? []).map((r: any) => [r.created_at, r.actor_user_id, r.target_user_id, r.role_name, r.change_type, r.reason]),
    ];
    downloadCsv(`audit_log_${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  const importCsv = async (file: File) => {
    setBusy(true);
    try {
      const text = await file.text();
      const lines = text.replace(/^\ufeff/, '').split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) throw new Error('Datei zu klein');
      const header = lines[0].split(',').map(s => s.trim());
      const emailIdx = header.findIndex(h => h.toLowerCase() === 'email');
      if (emailIdx < 0) throw new Error('Spalte "email" fehlt');
      const roleCols = header.slice(3);
      const changes: { user_id: string; role_id: string; op: 'add' | 'del' }[] = [];
      const roleMap = new Set(userRoles.map(ur => `${ur.user_id}|${ur.role_id}`));
      const roleByName = new Map(roles.map(r => [r.name, r.id]));
      const userByEmail = new Map(users.map(u => [(u.email ?? '').toLowerCase(), u.id]));

      for (let i = 1; i < lines.length; i++) {
        const cells = lines[i].split(',');
        const uid = userByEmail.get((cells[emailIdx] ?? '').toLowerCase().trim());
        if (!uid) continue;
        roleCols.forEach((name, k) => {
          const rid = roleByName.get(name.trim());
          if (!rid) return;
          const has = roleMap.has(`${uid}|${rid}`);
          const want = (cells[3 + k] ?? '').trim() === '1';
          if (want && !has) changes.push({ user_id: uid, role_id: rid, op: 'add' });
          if (!want && has) changes.push({ user_id: uid, role_id: rid, op: 'del' });
        });
      }

      if (changes.length === 0) { toast.info('Keine Änderungen erkannt'); return; }
      if (!confirm(`${changes.length} Änderungen anwenden?`)) return;

      const adds = changes.filter(c => c.op === 'add').map(({ user_id, role_id }) => ({ user_id, role_id }));
      const dels = changes.filter(c => c.op === 'del');
      if (adds.length) {
        const { error } = await supabase.from('user_roles').upsert(adds, { onConflict: 'user_id,role_id', ignoreDuplicates: true });
        if (error) throw error;
      }
      for (const d of dels) {
        await supabase.from('user_roles').delete().eq('user_id', d.user_id).eq('role_id', d.role_id);
      }
      toast.success(`Import: ${adds.length} vergeben, ${dels.length} entzogen`);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  if (loading) return <div className="flex items-center gap-2 text-muted-foreground p-8"><Loader2 className="w-4 h-4 animate-spin" /> Lade…</div>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2"><Users className="w-5 h-5" /> Bulk-Aktionen & Import/Export</h2>
        <p className="text-xs text-muted-foreground">Rollen für mehrere Benutzer gleichzeitig vergeben/entziehen, Matrix und Audit-Log exportieren, CSV-Import mit Vorschau.</p>
      </div>

      <Card className="p-4 space-y-3">
        <h3 className="text-sm font-semibold">Export / Import</h3>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={exportMatrix}>
            <Download className="w-3 h-3 mr-1" /> Matrix als CSV
          </Button>
          <Button size="sm" variant="outline" onClick={exportAudit}>
            <FileText className="w-3 h-3 mr-1" /> Audit-Log als CSV
          </Button>
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
            <Upload className="w-3 h-3 mr-1" /> Matrix importieren…
          </Button>
          <input ref={fileRef} type="file" accept=".csv" className="hidden"
            onChange={e => e.target.files?.[0] && importCsv(e.target.files[0])} />
        </div>
        <div className="text-[10px] text-muted-foreground">
          Import-Format: Erste 3 Spalten <code>user_id, name, email</code>, danach je Rolle eine Spalte mit <code>0</code>/<code>1</code>.
          Erkannt wird über <b>email</b>. Delegationsschutz (Super Admin/Admin/Finance/FACTORY INVOICE) bleibt aktiv.
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <h3 className="text-sm font-semibold">Bulk-Rollenvergabe</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Rolle</label>
            <Select value={roleId} onValueChange={setRoleId}>
              <SelectTrigger><SelectValue placeholder="Rolle wählen…" /></SelectTrigger>
              <SelectContent>
                {roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 flex items-end gap-2">
            <Button onClick={bulkGrant} disabled={busy || !roleId || selected.size === 0}>
              <ShieldPlus className="w-3 h-3 mr-1" /> Vergeben ({selected.size})
            </Button>
            <Button variant="outline" onClick={bulkRevoke} disabled={busy || !roleId || selected.size === 0}>
              <ShieldMinus className="w-3 h-3 mr-1" /> Entziehen ({selected.size})
            </Button>
          </div>
        </div>

        <Input placeholder="Suche Name / E-Mail…" value={q} onChange={e => setQ(e.target.value)} />

        <div className="border rounded-md max-h-[420px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background border-b">
              <tr>
                <th className="p-2 w-8"><Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} /></th>
                <th className="p-2 text-left">Name</th>
                <th className="p-2 text-left">E-Mail</th>
                <th className="p-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} className="border-b hover:bg-muted/30">
                  <td className="p-2"><Checkbox checked={selected.has(u.id)} onCheckedChange={() => toggle(u.id)} /></td>
                  <td className="p-2">{u.full_name ?? '—'}</td>
                  <td className="p-2 text-xs text-muted-foreground">{u.email}</td>
                  <td className="p-2"><Badge variant={u.is_active ? 'outline' : 'destructive'} className="text-[10px]">{u.is_active ? 'aktiv' : 'inaktiv'}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

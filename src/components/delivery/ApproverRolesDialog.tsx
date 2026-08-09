import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

const APPROVER_ROLES = [
  { role: 'Freigeber Bereitstellung', title: 'Bereitstellung' },
  { role: 'Freigeber Buchhaltung', title: 'Buchhaltung' },
  { role: 'Freigeber Tourenplanung', title: 'Tourenplanung' },
];

interface UserRow { id: string; full_name: string | null; email: string | null; roles: string[] }

export default function ApproverRolesDialog({
  open, onOpenChange,
}: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('delivery-approval-roles', { body: { action: 'list' } });
    if (error) { toast.error('Laden fehlgeschlagen'); setLoading(false); return; }
    setUsers(((data as any)?.users ?? []) as UserRow[]);
    setLoading(false);
  };

  useEffect(() => { if (open) void load(); }, [open]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = s
      ? users.filter((u) => `${u.full_name ?? ''} ${u.email ?? ''}`.toLowerCase().includes(s))
      : users;
    return [...list].sort((a, b) => Number(b.roles.length > 0) - Number(a.roles.length > 0)
      || (a.full_name ?? '').localeCompare(b.full_name ?? ''));
  }, [users, q]);

  const toggle = async (u: UserRow, role: string, enabled: boolean) => {
    setBusy(`${u.id}:${role}`);
    const { error } = await supabase.functions.invoke('delivery-approval-roles', {
      body: { action: 'set', user_id: u.id, role_name: role, enabled },
    });
    setBusy(null);
    if (error) { toast.error('Änderung fehlgeschlagen'); return; }
    setUsers((prev) => prev.map((x) => x.id === u.id
      ? { ...x, roles: enabled ? [...new Set([...x.roles, role])] : x.roles.filter((r) => r !== role) }
      : x));
    toast.success(enabled ? `${role} zugewiesen` : `${role} entfernt`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Freigeber zuweisen</DialogTitle></DialogHeader>

        <Input placeholder="Mitarbeiter suchen…" value={q} onChange={(e) => setQ(e.target.value)} />

        {loading ? (
          <div className="space-y-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th className="text-left p-2">Mitarbeiter</th>
                  {APPROVER_ROLES.map((r) => <th key={r.role} className="p-2">{r.title}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="border-t border-border/50">
                    <td className="p-2">
                      <div className="font-medium">{u.full_name ?? '—'}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </td>
                    {APPROVER_ROLES.map((r) => (
                      <td key={r.role} className="p-2 text-center">
                        <Checkbox
                          checked={u.roles.includes(r.role)}
                          disabled={busy === `${u.id}:${r.role}`}
                          onCheckedChange={(v) => void toggle(u, r.role, !!v)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">Keine Treffer.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Schließen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

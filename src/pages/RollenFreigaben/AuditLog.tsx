import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, FileClock, Plus, Minus } from 'lucide-react';

type Log = {
  id: string;
  actor_user_id: string | null;
  target_user_id: string | null;
  role_name: string | null;
  change_type: string;
  old_value: any;
  new_value: any;
  reason: string | null;
  created_at: string;
};

export default function AuditLog() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    (async () => {
      const [l, u] = await Promise.all([
        (supabase as any).from('role_audit_log').select('*').order('created_at', { ascending: false }).limit(500),
        supabase.from('user_profiles').select('id, full_name, email'),
      ]);
      setLogs(l.data ?? []); setUsers(u.data ?? []);
      setLoading(false);
    })();
  }, []);

  const name = (id: string | null) => id ? (users.find(u => u.id === id)?.full_name ?? users.find(u => u.id === id)?.email ?? id.slice(0, 8)) : '—';

  const filtered = q
    ? logs.filter(l =>
        (l.role_name ?? '').toLowerCase().includes(q.toLowerCase()) ||
        name(l.actor_user_id).toLowerCase().includes(q.toLowerCase()) ||
        name(l.target_user_id).toLowerCase().includes(q.toLowerCase()) ||
        l.change_type.toLowerCase().includes(q.toLowerCase())
      )
    : logs;

  if (loading) return <div className="flex items-center gap-2 text-muted-foreground p-8"><Loader2 className="w-4 h-4 animate-spin" /> Lade Protokoll…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <FileClock className="w-5 h-5 text-primary" />
        <h2 className="font-semibold">Änderungsprotokoll</h2>
        <Badge variant="outline" className="ml-auto">{logs.length} Einträge</Badge>
      </div>
      <Input placeholder="Filtern nach Rolle, Benutzer, Aktion…" value={q} onChange={e => setQ(e.target.value)} className="max-w-md" />

      {filtered.length === 0 && (
        <Card className="p-8 text-center text-muted-foreground">
          Noch keine Änderungen protokolliert. Zukünftige Rollen-Änderungen werden hier automatisch dokumentiert.
        </Card>
      )}

      <div className="space-y-2">
        {filtered.map(l => {
          const isGrant = l.change_type === 'role_granted';
          return (
            <Card key={l.id} className="p-3">
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isGrant ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                  {isGrant ? <Plus className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap text-sm">
                    <Badge variant="outline" className="text-[10px]">{l.change_type}</Badge>
                    <span className="font-medium">{l.role_name ?? '—'}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-medium">{name(l.target_user_id)}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    durch {name(l.actor_user_id)} · {new Date(l.created_at).toLocaleString('de-DE')}
                    {l.reason && <> · „{l.reason}"</>}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="p-3 bg-muted/30 border-dashed text-xs text-muted-foreground">
        Protokoll ist <b>append-only</b> — auch Super Admins können Einträge nicht ändern oder löschen (RLS erzwingt dies).
      </Card>
    </div>
  );
}

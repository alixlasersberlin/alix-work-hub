import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Users, X, Eye, UserCog, Shield, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

type Role = 'collaborator' | 'observer' | 'department_lead' | 'escalation';
interface Participant {
  id: string;
  ticket_id: string;
  user_id: string;
  role: Role;
  added_by: string | null;
  added_at: string;
  note: string | null;
}
interface UserOpt { id: string; label: string }

const ROLE_META: Record<Role, { label: string; icon: any; color: string }> = {
  collaborator: { label: 'Mitbearbeiter', icon: UserCog, color: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
  observer: { label: 'Beobachter', icon: Eye, color: 'bg-gray-500/10 text-gray-600 border-gray-500/30' },
  department_lead: { label: 'Abteilungsleiter', icon: Shield, color: 'bg-purple-500/10 text-purple-600 border-purple-500/30' },
  escalation: { label: 'Eskalation', icon: AlertTriangle, color: 'bg-red-500/10 text-red-600 border-red-500/30' },
};

export function TicketParticipants({ ticketId, users, canEdit }: { ticketId: string; users: UserOpt[]; canEdit: boolean }) {
  const { user } = useAuth();
  const [items, setItems] = useState<Participant[]>([]);
  const [addUser, setAddUser] = useState<string>('');
  const [addRole, setAddRole] = useState<Role>('collaborator');

  async function load() {
    const { data } = await supabase
      .from('ticket_participants')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('added_at', { ascending: true });
    setItems((data as any) || []);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [ticketId]);

  async function add() {
    if (!addUser) return toast.error('Bitte Mitarbeiter wählen');
    const { error } = await supabase.from('ticket_participants').insert({
      ticket_id: ticketId,
      user_id: addUser,
      role: addRole,
      added_by: user?.id || null,
    });
    if (error) return toast.error(error.message);
    // Notification an hinzugefügten User
    await supabase.from('ticket_notifications').insert({
      user_id: addUser,
      ticket_id: ticketId,
      kind: 'participant_added',
      title: 'Sie wurden einem Ticket hinzugefügt',
      message: `Rolle: ${ROLE_META[addRole].label}`,
      actor_id: user?.id || null,
      actor_name: user?.email || null,
    });
    setAddUser('');
    setAddRole('collaborator');
    toast.success('Beteiligter hinzugefügt');
    load();
  }

  async function remove(id: string) {
    const { error } = await supabase.from('ticket_participants').delete().eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Entfernt');
    load();
  }

  return (
    <div className="rounded-lg border border-border bg-background p-3 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Users className="w-4 h-4" /> Beteiligte ({items.length})
      </div>
      {items.length === 0 && (
        <p className="text-xs text-muted-foreground">Noch keine weiteren Beteiligten. Der Hauptverantwortliche ist der zugewiesene Mitarbeiter oben.</p>
      )}
      <div className="space-y-1.5">
        {items.map(p => {
          const meta = ROLE_META[p.role];
          const label = users.find(u => u.id === p.user_id)?.label || p.user_id.slice(0, 8);
          const Icon = meta.icon;
          return (
            <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={meta.color}>
                  <Icon className="w-3 h-3 mr-1" /> {meta.label}
                </Badge>
                <span>{label}</span>
              </div>
              {canEdit && (
                <Button variant="ghost" size="sm" onClick={() => remove(p.id)} className="h-7 w-7 p-0">
                  <X className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          );
        })}
      </div>
      {canEdit && (
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border">
          <Select value={addUser} onValueChange={setAddUser}>
            <SelectTrigger className="h-8 flex-1 min-w-[160px] text-xs"><SelectValue placeholder="Mitarbeiter wählen" /></SelectTrigger>
            <SelectContent>
              {users.map(u => <SelectItem key={u.id} value={u.id}>{u.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={addRole} onValueChange={v => setAddRole(v as Role)}>
            <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(ROLE_META) as Role[]).map(r => (
                <SelectItem key={r} value={r}>{ROLE_META[r].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="h-8" onClick={add}>Hinzufügen</Button>
        </div>
      )}
    </div>
  );
}

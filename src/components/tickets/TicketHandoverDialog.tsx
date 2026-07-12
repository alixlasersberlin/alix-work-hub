import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ArrowRightLeft, Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ticketId: string;
  currentDepartment: string;
  currentAssignee: string | null;
  users: { id: string; label: string }[];
  departments: string[];
  onDone: () => void;
}

export function TicketHandoverDialog({ open, onOpenChange, ticketId, currentDepartment, currentAssignee, users, departments, onDone }: Props) {
  const { user } = useAuth();
  const [newDept, setNewDept] = useState('');
  const [newAssignee, setNewAssignee] = useState<string>('none');
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [deadline, setDeadline] = useState('');
  const [customerInformed, setCustomerInformed] = useState<'yes' | 'no'>('no');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!newDept || newDept === currentDepartment) return toast.error('Bitte eine andere Zielabteilung wählen');
    if (!reason.trim()) return toast.error('Grund der Übergabe ist Pflicht');
    if (!nextAction.trim()) return toast.error('Nächster Schritt ist Pflicht');

    setSaving(true);
    try {
      const assignedTo = newAssignee === 'none' ? null : newAssignee;
      const { error } = await supabase
        .from('tickets')
        .update({
          department: newDept,
          assigned_to: assignedTo,
          customer_visible_status: `An ${newDept} übergeben`,
        })
        .eq('id', ticketId);
      if (error) throw error;

      // Interne Notiz mit Übergabe-Details
      const noteBody =
        `📤 Ticket übergeben\n` +
        `Von: ${currentDepartment} → An: ${newDept}\n` +
        `Grund: ${reason}\n` +
        `Sachstand: ${status || '—'}\n` +
        `Nächster Schritt: ${nextAction}\n` +
        `Frist: ${deadline || '—'}\n` +
        `Kunde bereits informiert: ${customerInformed === 'yes' ? 'Ja' : 'Nein'}`;
      await supabase.from('ticket_messages').insert({
        ticket_id: ticketId,
        sender_type: 'agent',
        sender_name: user?.email || 'Mitarbeiter',
        sender_email: user?.email || null,
        message: noteBody,
        is_internal: true,
        source_system: 'alixwork',
      });

      // History-Eintrag
      await supabase.from('ticket_history').insert({
        ticket_id: ticketId,
        action: 'handover',
        old_value: currentDepartment,
        new_value: newDept,
        actor_id: user?.id || null,
        actor_label: user?.email || null,
        meta: { reason, status, next_action: nextAction, deadline: deadline || null, customer_informed: customerInformed === 'yes' },
      } as any);

      // Benachrichtigung an neuen Verantwortlichen
      if (assignedTo && assignedTo !== currentAssignee) {
        await supabase.from('ticket_notifications').insert({
          user_id: assignedTo,
          ticket_id: ticketId,
          kind: 'handover',
          title: 'Ticket an Sie übergeben',
          message: `Grund: ${reason} · Nächster Schritt: ${nextAction}`,
          actor_id: user?.id || null,
          actor_name: user?.email || null,
        });
      }

      toast.success('Ticket übergeben');
      onOpenChange(false);
      onDone();
    } catch (e: any) {
      toast.error(e?.message || 'Übergabe fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4" /> Ticket übergeben
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Ziel-Abteilung *</Label>
              <Select value={newDept} onValueChange={setNewDept}>
                <SelectTrigger><SelectValue placeholder="Abteilung wählen" /></SelectTrigger>
                <SelectContent>
                  {departments.filter(d => d !== currentDepartment).map(d => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Neuer Verantwortlicher</Label>
              <Select value={newAssignee} onValueChange={setNewAssignee}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— später zuweisen —</SelectItem>
                  {users.map(u => <SelectItem key={u.id} value={u.id}>{u.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Grund der Übergabe *</Label>
            <Textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder="z. B. Zuständigkeit liegt bei Technik" />
          </div>
          <div>
            <Label>Bisheriger Sachstand</Label>
            <Textarea value={status} onChange={e => setStatus(e.target.value)} rows={2} placeholder="Was wurde bisher getan/geklärt?" />
          </div>
          <div>
            <Label>Nächster Schritt *</Label>
            <Textarea value={nextAction} onChange={e => setNextAction(e.target.value)} rows={2} placeholder="Was muss die neue Abteilung als nächstes tun?" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Frist</Label>
              <Input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} />
            </div>
            <div>
              <Label>Kunde bereits informiert?</Label>
              <Select value={customerInformed} onValueChange={v => setCustomerInformed(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="no">Nein</SelectItem>
                  <SelectItem value="yes">Ja</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Abbrechen</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <ArrowRightLeft className="w-4 h-4 mr-1" />}
            Übergeben
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

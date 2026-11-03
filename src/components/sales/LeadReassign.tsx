import { useEffect, useState } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { loadWhatsAppAssignees, type LeadAssignee } from '@/lib/sales/whatsapp-inbox';
import { canReassignLeads, reassignLead } from '@/lib/sales/lead-admin';
import type { MyLead } from '@/lib/sales/my-leads';

export default function LeadReassign({ lead, onAssigned }: { lead: MyLead; onAssigned: () => void | Promise<void> }) {
  const { roles } = useAuth();
  const allowed = canReassignLeads(roles);
  const [people, setPeople] = useState<LeadAssignee[]>([]);
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    setTarget(''); setPeople([]); setError('');
    let active = true;
    if (allowed && lead.tenant_id) void loadWhatsAppAssignees(lead.tenant_id).then(rows => { if (active) setPeople(rows); }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'Mitarbeiter konnten nicht geladen werden.'); });
    return () => { active = false; };
  }, [allowed, lead.id, lead.tenant_id]);
  if (!allowed) return null;
  return <section className="border-t border-border py-4 space-y-3">
    <h2 className="font-semibold">Mitarbeiterzuweisung</h2>
    <p className="text-sm text-muted-foreground">{people.find(p => p.id === lead.assigned_user)?.name || (lead.assigned_user ? 'Bereits zugewiesen' : 'Nicht zugewiesen')}</p>
    {!lead.tenant_id ? <p className="text-sm text-destructive">Zuerst Mandant zuordnen.</p> : <>
      <Select value={target} onValueChange={setTarget} disabled={busy}><SelectTrigger aria-label="Lead an Mitarbeiter verschieben"><SelectValue placeholder="Mitarbeiter auswählen" /></SelectTrigger><SelectContent>{people.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
      <Button variant="outline" disabled={busy || !target || target === lead.assigned_user} onClick={async () => {
        if (!confirm(`Lead mit allen verknüpften Angeboten und offenen Wiedervorlagen an ${people.find(p => p.id === target)?.name || 'diesen Mitarbeiter'} verschieben?`)) return;
        setBusy(true);
        try { await reassignLead(lead.id, target); toast.success('Lead und verknüpfte Angebote neu zugewiesen'); await onAssigned(); setTarget(''); }
        catch (e) { toast.error(e instanceof Error ? e.message : 'Neuzuweisung fehlgeschlagen'); }
        finally { setBusy(false); }
      }}><ArrowRightLeft className="h-4 w-4 mr-2" />{busy ? 'Wird verschoben …' : 'Verschieben'}</Button>
    </>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}
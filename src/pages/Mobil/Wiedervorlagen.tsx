/**
 * FOLLOW-UP REMINDER (Prompt 6) – rein interne, persönliche Wiedervorlagen.
 * Es wird niemals automatisch eine WhatsApp-Nachricht an Kunden versendet.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlarmClock, Check, X, Loader2, Plus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  fetchMyReminders, createReminder, setReminderStatus, logMobileAudit, type FollowUpReminder,
} from '@/lib/mobil/command';

const PRESETS: { label: string; minutes: number }[] = [
  { label: 'in 30 Min.', minutes: 30 },
  { label: 'in 1 Std.', minutes: 60 },
  { label: 'heute Nachmittag', minutes: -1 },
  { label: 'morgen früh', minutes: -2 },
];

function presetDate(minutes: number): Date {
  const d = new Date();
  if (minutes === -1) { d.setHours(15, 0, 0, 0); if (d < new Date()) d.setDate(d.getDate() + 1); return d; }
  if (minutes === -2) { d.setDate(d.getDate() + 1); d.setHours(8, 30, 0, 0); return d; }
  return new Date(Date.now() + minutes * 60000);
}

export default function MobilWiedervorlagen() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const conversationId = params.get('conversation');
  const ticketId = params.get('ticket');
  const [rows, setRows] = useState<FollowUpReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');
  const [custom, setCustom] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await fetchMyReminders()); }
    catch { toast.error('Wiedervorlagen konnten nicht geladen werden.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = async (when: Date) => {
    if (Number.isNaN(when.getTime())) { toast.error('Ungültiger Zeitpunkt.'); return; }
    setSaving(true);
    try {
      const id = await createReminder({ remindAt: when, note: note || undefined, conversationId, ticketId });
      await logMobileAudit('FOLLOWUP_CREATED', { reminder_id: id, remind_at: when.toISOString() });
      setNote(''); setCustom('');
      toast.success('Wiedervorlage gesetzt.');
      load();
    } catch (e: any) { toast.error(e?.message ?? 'Speichern fehlgeschlagen.'); }
    finally { setSaving(false); }
  };

  const finish = async (r: FollowUpReminder, status: 'COMPLETED' | 'CANCELLED') => {
    try {
      await setReminderStatus(r.id, status);
      if (status === 'COMPLETED') await logMobileAudit('FOLLOWUP_COMPLETED', { reminder_id: r.id });
      load();
    } catch { toast.error('Aktion fehlgeschlagen.'); }
  };

  return (
    <div className="p-4 space-y-3">
      <h1 className="text-xl font-bold flex items-center gap-2"><AlarmClock className="w-5 h-5" /> Wiedervorlagen</h1>

      <Card className="p-4 space-y-3">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Neue Erinnerung</div>
        {(conversationId || ticketId) && (
          <div className="text-xs text-muted-foreground">
            Verknüpft mit {conversationId ? 'Chat' : 'Ticket'} · wird nur intern erinnert.
          </div>
        )}
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Notiz (optional)" className="h-11" />
        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map((p) => (
            <Button key={p.label} variant="outline" className="h-11" disabled={saving} onClick={() => add(presetDate(p.minutes))}>
              {p.label}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input type="datetime-local" value={custom} onChange={(e) => setCustom(e.target.value)} className="h-11 flex-1" />
          <Button className="h-11" disabled={!custom || saving} onClick={() => add(new Date(custom))}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
      </Card>

      {loading && <div className="py-6 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>}
      {!loading && rows.length === 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground">Keine offenen Wiedervorlagen.</Card>
      )}

      {rows.map((r) => {
        const due = new Date(r.remind_at) <= new Date();
        return (
          <Card key={r.id} className={`p-3 space-y-2 ${due ? 'border-primary/50' : ''}`}>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{new Date(r.remind_at).toLocaleString('de-DE')}</span>
              {due && <Badge className="text-[10px]">fällig</Badge>}
              {r.status === 'TRIGGERED' && <Badge variant="secondary" className="text-[10px]">gemeldet</Badge>}
            </div>
            {r.note && <div className="text-sm text-muted-foreground">{r.note}</div>}
            <div className="flex gap-2">
              {r.conversation_id && (
                <Button size="sm" variant="outline" className="h-9 flex-1" onClick={() => nav(`/mobil/inbox/${r.conversation_id}`)}>Chat</Button>
              )}
              {r.ticket_id && (
                <Button size="sm" variant="outline" className="h-9 flex-1" onClick={() => nav(`/tickets?ticket=${r.ticket_id}`)}>Ticket</Button>
              )}
              <Button size="sm" className="h-9 flex-1" onClick={() => finish(r, 'COMPLETED')}>
                <Check className="h-4 w-4 mr-1" /> Erledigt
              </Button>
              <Button size="sm" variant="ghost" className="h-9" onClick={() => finish(r, 'CANCELLED')} aria-label="Abbrechen">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

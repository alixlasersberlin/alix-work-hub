/**
 * SCHICHTÜBERGABE (Prompt 6) – sammelt die offenen Vorgänge des Mitarbeiters
 * aus bestehenden Daten. Die Übergabe ändert die Vorgänge selbst nicht.
 */
import { useCallback, useEffect, useState } from 'react';
import { ArrowRightLeft, Loader2, Sparkles, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  collectHandoverCandidates, createHandover, fetchHandovers, fetchHandoverItems,
  acceptHandover, cancelHandover, type Handover, type HandoverItem,
} from '@/lib/mobil/command';
import { runAnalysis } from '@/lib/inbox/ai';

export default function MobilUebergabe() {
  const { user } = useAuth();
  const [cand, setCand] = useState<{ conversations: any[]; tickets: any[] }>({ conversations: [], tickets: [] });
  const [staff, setStaff] = useState<{ id: string; full_name: string | null }[]>([]);
  const [toUser, setToUser] = useState<string>('');
  const [department, setDepartment] = useState<string>('');
  const [summary, setSummary] = useState('');
  const [list, setList] = useState<Handover[]>([]);
  const [items, setItems] = useState<Record<string, HandoverItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [ai, setAi] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [c, s, h] = await Promise.all([
        collectHandoverCandidates(user.id),
        (supabase as any).from('user_profiles').select('id, full_name').eq('is_active', true).order('full_name').limit(200),
        fetchHandovers(),
      ]);
      setCand(c);
      setStaff((s.data || []) as any[]);
      setList(h);
      setSummary(buildSummary(c));
    } catch (e: any) { toast.error(e?.message ?? 'Laden fehlgeschlagen.'); }
    finally { setLoading(false); }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const toggleItems = async (h: Handover) => {
    if (items[h.id]) { const cp = { ...items }; delete cp[h.id]; setItems(cp); return; }
    setItems({ ...items, [h.id]: await fetchHandoverItems(h.id) });
  };

  const aiSummary = async () => {
    const ids = cand.conversations.slice(0, 3).map((c) => c.id);
    if (!ids.length) { toast.info('Keine offenen Chats für eine KI-Zusammenfassung.'); return; }
    setAi(true);
    const parts: string[] = [];
    for (const id of ids) {
      const r = await runAnalysis<{ summary?: string }>({ conversationId: id, type: 'SUMMARY' });
      if (r.ok && r.data?.summary) parts.push(`• ${r.data.summary}`);
      else if (!r.ok) { toast.error(r.error || 'ALIX AI nicht verfügbar.'); break; }
    }
    setAi(false);
    if (parts.length) setSummary(`${buildSummary(cand)}\n\nALIX AI Zusammenfassung:\n${parts.join('\n')}`);
  };

  const create = async () => {
    if (!summary.trim()) { toast.error('Bitte eine Zusammenfassung erfassen.'); return; }
    setBusy(true);
    try {
      await createHandover({
        toUserId: toUser || null,
        department: department || null,
        summary,
        items: [
          ...cand.conversations.map((c) => ({ item_type: 'CONVERSATION', conversation_id: c.id, priority: c.priority ?? null, note: c.last_message_preview ?? null })),
          ...cand.tickets.map((t) => ({ item_type: 'TICKET', ticket_id: t.id, priority: t.priority ?? null, note: t.subject || t.title || null })),
        ],
      });
      toast.success('Übergabe erstellt.');
      setToUser(''); setDepartment('');
      load();
    } catch (e: any) { toast.error(e?.message ?? 'Übergabe fehlgeschlagen.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold flex items-center gap-2"><ArrowRightLeft className="w-5 h-5" /> Schichtübergabe</h1>

      <Card className="p-4 space-y-3">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Übergabe erstellen</div>
        {loading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : (
          <>
            <div className="text-sm">
              {cand.conversations.length} offene Chats · {cand.tickets.length} offene Tickets
            </div>
            <Select value={toUser} onValueChange={setToUser}>
              <SelectTrigger className="h-11"><SelectValue placeholder="An Mitarbeiter (optional)" /></SelectTrigger>
              <SelectContent>
                {staff.filter((s) => s.id !== user?.id).map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.full_name || s.id.slice(0, 8)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger className="h-11"><SelectValue placeholder="Oder an Abteilung" /></SelectTrigger>
              <SelectContent>
                {['Technik', 'Service', 'Sales', 'Buchhaltung'].map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={7} className="text-sm" />
            <div className="flex gap-2">
              <Button variant="outline" className="h-11 flex-1" onClick={aiSummary} disabled={ai}>
                {ai ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />} ALIX AI
              </Button>
              <Button className="h-11 flex-1" onClick={create} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Übergabe erstellen'}
              </Button>
            </div>
          </>
        )}
      </Card>

      <div className="space-y-2">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Übergaben</div>
        {list.length === 0 && <Card className="p-5 text-center text-sm text-muted-foreground">Noch keine Übergaben.</Card>}
        {list.map((h) => (
          <Card key={h.id} className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant={h.status === 'OPEN' ? 'default' : h.status === 'ACCEPTED' ? 'secondary' : 'outline'} className="text-[10px]">
                {h.status === 'OPEN' ? 'Offen' : h.status === 'ACCEPTED' ? 'Angenommen' : 'Storniert'}
              </Badge>
              <span className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString('de-DE')}</span>
              {h.department && <span className="text-xs text-muted-foreground">· {h.department}</span>}
            </div>
            <div className="text-sm whitespace-pre-wrap line-clamp-6">{h.summary}</div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" className="h-9" onClick={() => toggleItems(h)}>
                {items[h.id] ? 'Positionen ausblenden' : 'Positionen'}
              </Button>
              {h.status === 'OPEN' && h.from_user_id !== user?.id && (
                <Button size="sm" className="h-9" onClick={async () => { await acceptHandover(h.id); toast.success('Übernommen.'); load(); }}>
                  <Check className="h-4 w-4 mr-1" /> Annehmen
                </Button>
              )}
              {h.status === 'OPEN' && h.from_user_id === user?.id && (
                <Button size="sm" variant="ghost" className="h-9" onClick={async () => { await cancelHandover(h.id); load(); }}>
                  <X className="h-4 w-4 mr-1" /> Stornieren
                </Button>
              )}
            </div>
            {items[h.id] && (
              <ul className="text-xs text-muted-foreground space-y-1 pt-1">
                {items[h.id].map((i) => (
                  <li key={i.id}>• {i.item_type === 'TICKET' ? 'Ticket' : 'Chat'}{i.priority ? ` (${i.priority})` : ''}: {i.note || '—'}</li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

function buildSummary(c: { conversations: any[]; tickets: any[] }): string {
  const lines: string[] = [];
  lines.push(`Offene Chats: ${c.conversations.length}`);
  for (const x of c.conversations.slice(0, 10)) {
    lines.push(`• ${x.priority || 'P3'} – ${(x.last_message_preview || 'ohne Vorschau').slice(0, 90)}`);
  }
  lines.push(`Offene Tickets: ${c.tickets.length}`);
  for (const t of c.tickets.slice(0, 10)) {
    lines.push(`• ${t.ticket_number || ''} ${t.priority || ''} – ${(t.subject || t.title || '').slice(0, 90)}`.trim());
  }
  return lines.join('\n');
}

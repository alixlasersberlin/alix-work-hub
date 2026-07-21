import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Bot, PlayCircle } from 'lucide-react';
import { toast } from 'sonner';

const ACTIONS = [
  { key: 'create_ticket', label: 'Ticket erstellen', schema: '{ "subject": "...", "description": "...", "priority": "normal", "customer_id": null }' },
  { key: 'enroll_journey', label: 'Journey starten (Admin)', schema: '{ "journey_id": "...", "contact_id": "..." }' },
  { key: 'notify_admin', label: 'Benachrichtigung senden', schema: '{ "title": "...", "message": "...", "target_user_id": null }' },
  { key: 'update_contact', label: 'Kontakt aktualisieren (Admin)', schema: '{ "contact_id": "...", "fields": { "tags": ["vip"] } }' },
];

export default function AlixConnectCopilotActions() {
  const [action, setAction] = useState('create_ticket');
  const [paramsJson, setParamsJson] = useState('{\n  "subject": "Test von Copilot",\n  "description": "Automatisch erstellt",\n  "priority": "normal"\n}');
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<any[]>([]);
  const cur = ACTIONS.find((a) => a.key === action)!;

  const load = async () => {
    const { data } = await supabase.from('ac_copilot_actions').select('*').order('created_at', { ascending: false }).limit(50);
    setLog(data ?? []);
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { setParamsJson(cur.schema); }, [action]);

  const run = async () => {
    let parsed: any;
    try { parsed = JSON.parse(paramsJson); } catch (e: any) { return toast.error('Ungültiges JSON: ' + e.message); }
    setBusy(true);
    const t = toast.loading('Aktion läuft…');
    const { data, error } = await supabase.functions.invoke('ac-copilot-act', { body: { action, params: parsed } });
    toast.dismiss(t); setBusy(false);
    if (error) return toast.error(error.message);
    const res = data as any;
    if (res?.status === 'success') toast.success('Erfolg: ' + JSON.stringify(res.result));
    else toast.error(res?.error ?? 'Fehler');
    load();
  };

  return (
    <div className="h-full overflow-auto p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" /> Copilot Agent Actions
          <Badge variant="outline">Phase 30</Badge>
        </h2>
        <p className="text-sm text-muted-foreground">Tool-Use für Copilot: Tickets, Journeys, Updates · alle Aktionen werden auditiert</p>
      </div>

      <Card className="p-4 space-y-3">
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Aktion</label>
            <select className="w-full border rounded px-2 py-1.5 text-sm bg-background" value={action} onChange={(e) => setAction(e.target.value)}>
              {ACTIONS.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
            </select>
          </div>
          <div className="flex items-end"><Button onClick={run} disabled={busy}><PlayCircle className="h-4 w-4 mr-1" />Ausführen</Button></div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Parameter (JSON)</label>
          <Textarea rows={8} value={paramsJson} onChange={(e) => setParamsJson(e.target.value)} className="font-mono text-xs" />
        </div>
      </Card>

      <Card className="p-4">
        <div className="text-sm font-semibold mb-3">Audit-Log ({log.length})</div>
        {log.length === 0 ? <div className="text-xs text-muted-foreground">Noch keine Aktionen.</div> : (
          <table className="text-xs w-full">
            <thead><tr className="text-muted-foreground"><th className="text-left py-1">Zeit</th><th className="text-left py-1">Aktion</th><th className="text-left py-1">Status</th><th className="text-left py-1">Ergebnis / Fehler</th></tr></thead>
            <tbody>
              {log.map((r) => (
                <tr key={r.id} className="border-t align-top">
                  <td className="py-1 whitespace-nowrap">{new Date(r.created_at).toLocaleString('de-DE')}</td>
                  <td className="py-1"><Badge variant="outline">{r.action_type}</Badge></td>
                  <td className="py-1">{r.status === 'success' ? <span className="text-green-500">✓ ok</span> : <span className="text-destructive">✗ fail</span>}</td>
                  <td className="py-1 font-mono text-[10px] max-w-md truncate">{r.error || JSON.stringify(r.result)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

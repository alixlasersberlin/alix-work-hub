import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Rocket, Plus, Play, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/infinity/PageHeader';
import { KpiTile } from '@/components/infinity/KpiTile';

const EVENTS = [
  { v: 'maintenance_due', l: 'Wartung fällig' },
  { v: 'contract_expiring', l: 'Vertrag läuft aus' },
  { v: 'warranty_ending', l: 'Garantie endet' },
  { v: 'churn_risk', l: 'Churn-Risiko hoch' },
  { v: 'no_contact_days', l: 'Kein Kontakt seit N Tagen' },
];

export default function ProactiveOutreach() {
  const [triggers, setTriggers] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [form, setForm] = useState<any>({ name: '', event_type: 'maintenance_due', channel: 'email', conditions: '{"days_before":30}', message_template: '', throttle_per_customer_days: 30, enabled: true });

  const load = async () => {
    const [{ data: t }, { data: r }] = await Promise.all([
      supabase.from('ac_outreach_triggers' as any).select('*').order('created_at', { ascending: false }),
      supabase.from('ac_outreach_runs' as any).select('*').order('created_at', { ascending: false }).limit(200),
    ]);
    setTriggers((t as any) ?? []);
    setRuns((r as any) ?? []);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      const cond = form.conditions ? JSON.parse(form.conditions) : {};
      const { error } = await supabase.from('ac_outreach_triggers' as any).insert({
        name: form.name, event_type: form.event_type, channel: form.channel,
        conditions: cond, message_template: form.message_template,
        throttle_per_customer_days: Number(form.throttle_per_customer_days || 30),
        enabled: form.enabled,
      });
      if (error) throw error;
      toast.success('Trigger angelegt.'); setOpen(false); await load();
    } catch (e: any) { toast.error(e.message); }
  };

  const toggle = async (id: string, enabled: boolean) => {
    await supabase.from('ac_outreach_triggers' as any).update({ enabled }).eq('id', id);
    load();
  };

  const runEngine = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('ac-outreach-engine', { body: {} });
      if (error) throw error;
      toast.success(`Engine ausgeführt · ${(data as any)?.queued ?? 0} neue Runs`);
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setRunning(false); }
  };

  const kpi = {
    triggers: triggers.filter(t => t.enabled).length,
    queued: runs.filter(r => r.status === 'queued').length,
    sent: runs.filter(r => r.status === 'sent').length,
    failed: runs.filter(r => r.status === 'failed').length,
  };

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      <PageHeader
        title="Proactive Outreach"
        subtitle="Trigger-basierte Kampagnen (Wartung, Vertrag, Churn …)"
        icon={Rocket}
        noBreadcrumbs
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={runEngine} disabled={running}>
              <Play className={`h-4 w-4 mr-2 ${running ? 'animate-spin' : ''}`} /> Engine ausführen
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-2" />Neuer Trigger</Button></DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Neuer Outreach-Trigger</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                  <div>
                    <Label>Event</Label>
                    <Select value={form.event_type} onValueChange={v => setForm({ ...form, event_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{EVENTS.map(e => <SelectItem key={e.v} value={e.v}>{e.l}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Kanal</Label>
                    <Select value={form.channel} onValueChange={v => setForm({ ...form, channel: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Bedingungen (JSON)</Label><Input value={form.conditions} onChange={e => setForm({ ...form, conditions: e.target.value })} /></div>
                  <div><Label>Nachrichten-Template</Label><Textarea rows={3} value={form.message_template} onChange={e => setForm({ ...form, message_template: e.target.value })} placeholder="Hallo {{name}}, …" /></div>
                  <div><Label>Throttle (Tage)</Label><Input type="number" value={form.throttle_per_customer_days} onChange={e => setForm({ ...form, throttle_per_customer_days: e.target.value })} /></div>
                  <Button onClick={save} className="w-full">Anlegen</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile label="Aktive Trigger" value={kpi.triggers} icon={Rocket} accent="gold" />
        <KpiTile label="Queued" value={kpi.queued} icon={RefreshCw} accent="sky" />
        <KpiTile label="Sent" value={kpi.sent} icon={Play} accent="emerald" />
        <KpiTile label="Failed" value={kpi.failed} icon={RefreshCw} accent="violet" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Trigger</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Aktiv</TableHead><TableHead>Name</TableHead><TableHead>Event</TableHead><TableHead>Kanal</TableHead><TableHead>Throttle</TableHead></TableRow></TableHeader>
            <TableBody>
              {triggers.map(t => (
                <TableRow key={t.id}>
                  <TableCell><Switch checked={t.enabled} onCheckedChange={v => toggle(t.id, v)} /></TableCell>
                  <TableCell>{t.name}</TableCell>
                  <TableCell><Badge variant="outline">{t.event_type}</Badge></TableCell>
                  <TableCell>{t.channel}</TableCell>
                  <TableCell>{t.throttle_per_customer_days}d</TableCell>
                </TableRow>
              ))}
              {triggers.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground">Noch keine Trigger.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Letzte Runs</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-auto max-h-[50vh]">
            <Table>
              <TableHeader><TableRow><TableHead>Zeit</TableHead><TableHead>Status</TableHead><TableHead>Kanal</TableHead><TableHead>Kunde</TableHead><TableHead>Geplant</TableHead></TableRow></TableHeader>
              <TableBody>
                {runs.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{new Date(r.created_at).toLocaleString('de-DE')}</TableCell>
                    <TableCell><Badge variant={r.status === 'sent' ? 'default' : r.status === 'failed' ? 'destructive' : 'secondary'}>{r.status}</Badge></TableCell>
                    <TableCell>{r.channel}</TableCell>
                    <TableCell className="font-mono text-xs">{(r.customer_id ?? '').slice(0, 8)}…</TableCell>
                    <TableCell className="text-xs">{r.scheduled_for ? new Date(r.scheduled_for).toLocaleString('de-DE') : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

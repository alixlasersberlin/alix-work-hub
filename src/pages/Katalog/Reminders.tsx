import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Bell, Play, Plus, Trash2 } from 'lucide-react';

const KINDS = [
  { v: 'missing_translation', l: 'Fehlende Übersetzung' },
  { v: 'stale_price', l: 'Veralteter Preis' },
  { v: 'missing_image', l: 'Fehlendes Bild' },
  { v: 'stale_bundle', l: 'Veraltetes Bundle' },
];

export default function KatalogReminders() {
  const c = supabase as any;
  const { toast } = useToast();
  const [rules, setRules] = useState<any[]>([]);
  const [log, setLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [form, setForm] = useState({ name: '', kind: 'stale_price', threshold_days: 90, notify_emails: '' });

  const load = async () => {
    setLoading(true);
    const [{ data: r }, { data: l }] = await Promise.all([
      c.from('catalog_reminder_rules').select('*').order('created_at', { ascending: false }),
      c.from('catalog_reminder_log_v2').select('*').order('created_at', { ascending: false }).limit(200),
    ]);
    setRules(r ?? []); setLog(l ?? []); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.name) return;
    const { error } = await c.from('catalog_reminder_rules').insert({
      name: form.name, kind: form.kind, threshold_days: form.threshold_days,
      notify_emails: form.notify_emails.split(',').map(s => s.trim()).filter(Boolean),
    });
    if (error) toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    else { setForm({ name: '', kind: 'stale_price', threshold_days: 90, notify_emails: '' }); load(); }
  };
  const toggle = async (id: string, enabled: boolean) => {
    await c.from('catalog_reminder_rules').update({ enabled }).eq('id', id); load();
  };
  const remove = async (id: string) => {
    await c.from('catalog_reminder_rules').delete().eq('id', id); load();
  };
  const runNow = async () => {
    setRunning(true);
    const { data, error } = await supabase.functions.invoke('catalog-reminders-run');
    setRunning(false);
    if (error) toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Geprüft', description: `${(data as any)?.total ?? 0} Einträge` }); load(); }
  };
  const resolve = async (id: string) => {
    await c.from('catalog_reminder_log_v2').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', id); load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><Bell className="h-5 w-5 text-primary" /><h2 className="text-xl font-semibold">Erinnerungen & Reminders</h2></div>
        <Button onClick={runNow} disabled={running}><Play className="h-4 w-4 mr-2" />{running ? 'Prüfe…' : 'Jetzt prüfen'}</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Neue Regel</CardTitle></CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-5 gap-3 items-end">
            <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Typ</Label>
              <Select value={form.kind} onValueChange={v => setForm({ ...form, kind: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{KINDS.map(k => <SelectItem key={k.v} value={k.v}>{k.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Schwelle (Tage)</Label><Input type="number" value={form.threshold_days} onChange={e => setForm({ ...form, threshold_days: parseInt(e.target.value) || 0 })} /></div>
            <div className="md:col-span-1"><Label>E-Mails (Komma)</Label><Input value={form.notify_emails} onChange={e => setForm({ ...form, notify_emails: e.target.value })} placeholder="a@x.de,b@x.de" /></div>
            <Button onClick={create}><Plus className="h-4 w-4 mr-2" />Anlegen</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Regeln</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Typ</TableHead><TableHead>Tage</TableHead><TableHead>Letzter Lauf</TableHead><TableHead>Aktiv</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {rules.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Keine Regeln</TableCell></TableRow>}
              {rules.map(r => (
                <TableRow key={r.id}>
                  <TableCell>{r.name}</TableCell>
                  <TableCell><Badge variant="outline">{KINDS.find(k => k.v === r.kind)?.l ?? r.kind}</Badge></TableCell>
                  <TableCell>{r.threshold_days}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.last_run_at ? new Date(r.last_run_at).toLocaleString('de-DE') : '—'}</TableCell>
                  <TableCell><Switch checked={r.enabled} onCheckedChange={v => toggle(r.id, v)} /></TableCell>
                  <TableCell><Button variant="ghost" size="sm" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Offene Reminders ({log.filter(l => l.status === 'open').length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Zeit</TableHead><TableHead>Typ</TableHead><TableHead>Ziel</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {log.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Keine Einträge</TableCell></TableRow>}
              {log.map(e => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString('de-DE')}</TableCell>
                  <TableCell><Badge variant="outline">{e.target_type}</Badge></TableCell>
                  <TableCell className="text-sm">{e.target_label}</TableCell>
                  <TableCell>{e.status === 'open' ? <Badge className="bg-amber-500">offen</Badge> : <Badge variant="secondary">erledigt</Badge>}</TableCell>
                  <TableCell>{e.status === 'open' && <Button variant="ghost" size="sm" onClick={() => resolve(e.id)}>Erledigt</Button>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

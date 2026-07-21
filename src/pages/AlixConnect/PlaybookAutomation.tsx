import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Rocket, PlayCircle, Plus, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/infinity/PageHeader';
import { KpiTile } from '@/components/infinity/KpiTile';

const STAGES = ['onboarding', 'adopt', 'expand', 'renew', 'risk', 'churned'];
const ACTION_KINDS = ['send_email', 'send_sms', 'send_whatsapp', 'create_ticket', 'notify_admin'];

type Playbook = {
  id: string; name: string; description: string | null; stage: string;
  enabled: boolean; throttle_days: number; min_score: number | null; max_score: number | null;
  actions: any[];
};
type Run = {
  id: string; playbook_id: string; customer_id: string; stage: string; status: string;
  result: any; created_at: string;
};

const empty: Partial<Playbook> = {
  name: '', description: '', stage: 'risk', enabled: true, throttle_days: 14,
  min_score: null, max_score: null,
  actions: [{ kind: 'send_email', config: { subject: '', body: '' } }],
};

export default function PlaybookAutomation() {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [editing, setEditing] = useState<Partial<Playbook> | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: pb }, { data: rn }] = await Promise.all([
      supabase.from('ac_lifecycle_playbooks' as any).select('*').order('stage'),
      supabase.from('ac_lifecycle_runs' as any).select('*').order('created_at', { ascending: false }).limit(100),
    ]);
    setPlaybooks((pb as any) ?? []);
    setRuns((rn as any) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const runEngine = async (dryRun = false) => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('ac-playbook-run', { body: { dry_run: dryRun } });
      if (error) throw error;
      toast.success(`${dryRun ? 'Dry-Run' : 'Ausgeführt'}: ${data.executed} ausgeführt, ${data.throttled} throttled, ${data.failed} fehlgeschlagen`);
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setRunning(false); }
  };

  const save = async () => {
    if (!editing?.name || !editing?.stage) { toast.error('Name und Stage erforderlich'); return; }
    const payload = {
      name: editing.name, description: editing.description ?? null, stage: editing.stage,
      enabled: editing.enabled ?? true, throttle_days: editing.throttle_days ?? 14,
      min_score: editing.min_score, max_score: editing.max_score,
      actions: editing.actions ?? [],
    };
    const { error } = editing.id
      ? await supabase.from('ac_lifecycle_playbooks' as any).update(payload).eq('id', editing.id)
      : await supabase.from('ac_lifecycle_playbooks' as any).insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success('Playbook gespeichert');
    setDialogOpen(false); setEditing(null); load();
  };

  const del = async (id: string) => {
    if (!confirm('Playbook löschen?')) return;
    const { error } = await supabase.from('ac_lifecycle_playbooks' as any).delete().eq('id', id);
    if (error) toast.error(error.message); else { toast.success('Gelöscht'); load(); }
  };

  const kpi = {
    total: playbooks.length,
    active: playbooks.filter(p => p.enabled).length,
    runs24h: runs.filter(r => Date.now() - new Date(r.created_at).getTime() < 86400000).length,
    failed: runs.filter(r => r.status === 'failed').length,
  };

  const updateAction = (idx: number, patch: any) => {
    const acts = [...(editing?.actions ?? [])];
    acts[idx] = { ...acts[idx], ...patch, config: { ...(acts[idx]?.config ?? {}), ...(patch.config ?? {}) } };
    setEditing({ ...editing!, actions: acts });
  };
  const addAction = () => setEditing({ ...editing!, actions: [...(editing?.actions ?? []), { kind: 'send_email', config: {} }] });
  const removeAction = (idx: number) => setEditing({ ...editing!, actions: (editing?.actions ?? []).filter((_, i) => i !== idx) });

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      <PageHeader
        title="Playbook Automation"
        subtitle="Lifecycle-Playbooks automatisch ausführen (Phase 28)"
        icon={Rocket}
        noBreadcrumbs
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => runEngine(true)} disabled={running}>Dry-Run</Button>
            <Button size="sm" onClick={() => runEngine(false)} disabled={running}>
              <PlayCircle className={`h-4 w-4 mr-2 ${running ? 'animate-pulse' : ''}`} />Engine ausführen
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="secondary" onClick={() => { setEditing({ ...empty }); }}>
                  <Plus className="h-4 w-4 mr-2" />Neu
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-auto">
                <DialogHeader><DialogTitle>{editing?.id ? 'Playbook bearbeiten' : 'Neues Playbook'}</DialogTitle></DialogHeader>
                {editing && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Name</Label><Input value={editing.name ?? ''} onChange={e => setEditing({ ...editing, name: e.target.value })} /></div>
                      <div>
                        <Label>Lifecycle-Stage</Label>
                        <Select value={editing.stage} onValueChange={v => setEditing({ ...editing, stage: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div><Label>Beschreibung</Label><Textarea value={editing.description ?? ''} onChange={e => setEditing({ ...editing, description: e.target.value })} rows={2} /></div>
                    <div className="grid grid-cols-3 gap-3">
                      <div><Label>Throttle (Tage)</Label><Input type="number" value={editing.throttle_days ?? 14} onChange={e => setEditing({ ...editing, throttle_days: Number(e.target.value) })} /></div>
                      <div><Label>Min Score</Label><Input type="number" value={editing.min_score ?? ''} onChange={e => setEditing({ ...editing, min_score: e.target.value === '' ? null : Number(e.target.value) })} /></div>
                      <div><Label>Max Score</Label><Input type="number" value={editing.max_score ?? ''} onChange={e => setEditing({ ...editing, max_score: e.target.value === '' ? null : Number(e.target.value) })} /></div>
                    </div>
                    <div className="flex items-center gap-2"><Switch checked={editing.enabled ?? true} onCheckedChange={v => setEditing({ ...editing, enabled: v })} /><Label>Aktiv</Label></div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between"><Label>Aktionen</Label>
                        <Button size="sm" variant="outline" onClick={addAction}><Plus className="h-3 w-3 mr-1" />Aktion</Button>
                      </div>
                      {(editing.actions ?? []).map((a: any, i: number) => (
                        <div key={i} className="border rounded p-3 space-y-2">
                          <div className="flex gap-2 items-center">
                            <Select value={a.kind} onValueChange={v => updateAction(i, { kind: v })}>
                              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                              <SelectContent>{ACTION_KINDS.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
                            </Select>
                            <Button size="icon" variant="ghost" onClick={() => removeAction(i)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                          {(a.kind === 'send_email' || a.kind === 'create_ticket' || a.kind === 'notify_admin') && (
                            <Input placeholder="Betreff / Titel" value={a.config?.subject ?? a.config?.title ?? ''}
                              onChange={e => updateAction(i, { config: a.kind === 'notify_admin' ? { title: e.target.value } : { subject: e.target.value } })} />
                          )}
                          <Textarea placeholder="Nachricht (Variablen: {{name}}, {{score}}, {{stage}}, {{email}})"
                            value={a.config?.body ?? ''} onChange={e => updateAction(i, { config: { body: e.target.value } })} rows={3} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <DialogFooter><Button onClick={save}>Speichern</Button></DialogFooter>
              </DialogContent>
            </Dialog>
            <Button size="sm" variant="ghost" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile label="Playbooks" value={kpi.total} icon={Rocket} accent="sky" />
        <KpiTile label="Aktiv" value={kpi.active} icon={PlayCircle} accent="emerald" />
        <KpiTile label="Runs (24h)" value={kpi.runs24h} icon={PlayCircle} accent="gold" />
        <KpiTile label="Fehler" value={kpi.failed} icon={PlayCircle} accent="violet" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Playbooks</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="text-sm text-muted-foreground">Lädt…</div> : playbooks.length === 0 ? (
            <div className="text-sm text-muted-foreground">Noch keine Playbooks. „Neu" klicken.</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Name</TableHead><TableHead>Stage</TableHead><TableHead>Aktiv</TableHead>
                <TableHead>Throttle</TableHead><TableHead>Score</TableHead><TableHead>Aktionen</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {playbooks.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell><Badge variant="secondary">{p.stage}</Badge></TableCell>
                    <TableCell>{p.enabled ? <Badge>an</Badge> : <Badge variant="outline">aus</Badge>}</TableCell>
                    <TableCell>{p.throttle_days}d</TableCell>
                    <TableCell className="text-xs">{p.min_score ?? '–'} … {p.max_score ?? '–'}</TableCell>
                    <TableCell className="text-xs">{(p.actions ?? []).map((a: any) => a.kind).join(', ')}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => { setEditing(p as any); setDialogOpen(true); }}>Bearbeiten</Button>
                      <Button size="sm" variant="ghost" onClick={() => del(p.id)}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Letzte Runs</CardTitle></CardHeader>
        <CardContent>
          {runs.length === 0 ? <div className="text-sm text-muted-foreground">Noch keine Runs.</div> : (
            <div className="max-h-[50vh] overflow-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Zeit</TableHead><TableHead>Playbook</TableHead><TableHead>Kunde</TableHead>
                  <TableHead>Stage</TableHead><TableHead>Status</TableHead><TableHead>Ergebnis</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {runs.map(r => {
                    const pb = playbooks.find(p => p.id === r.playbook_id);
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs">{new Date(r.created_at).toLocaleString('de-DE')}</TableCell>
                        <TableCell className="text-xs">{pb?.name ?? r.playbook_id.slice(0, 8)}</TableCell>
                        <TableCell className="font-mono text-xs">{r.customer_id.slice(0, 8)}…</TableCell>
                        <TableCell><Badge variant="secondary">{r.stage}</Badge></TableCell>
                        <TableCell><Badge variant={r.status === 'failed' ? 'destructive' : 'default'}>{r.status}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-md truncate">{JSON.stringify(r.result?.actions ?? r.result)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

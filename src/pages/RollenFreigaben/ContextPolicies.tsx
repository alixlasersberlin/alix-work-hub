import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Clock, CalendarDays, Globe, Timer, Loader2, Plus, Trash2, Play, CheckCircle2, XCircle,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Policy = {
  id: string;
  role_id: string;
  policy_type: 'time_window' | 'weekday' | 'ip_allowlist' | 'session_limit';
  config: any;
  description: string | null;
  is_active: boolean;
};
type Role = { id: string; name: string };

const TYPES = [
  { key: 'time_window', label: 'Zeitfenster', icon: Clock, help: 'Nur zwischen Uhrzeiten aktiv' },
  { key: 'weekday', label: 'Wochentage', icon: CalendarDays, help: 'Nur an bestimmten Wochentagen' },
  { key: 'ip_allowlist', label: 'IP-Whitelist', icon: Globe, help: 'Nur aus definierten IP-Bereichen (CIDR)' },
  { key: 'session_limit', label: 'Session-Limit', icon: Timer, help: 'Maximale Sitzungsdauer (informativ)' },
] as const;

const DOW = [
  { v: 1, l: 'Mo' }, { v: 2, l: 'Di' }, { v: 3, l: 'Mi' }, { v: 4, l: 'Do' },
  { v: 5, l: 'Fr' }, { v: 6, l: 'Sa' }, { v: 7, l: 'So' },
];

function describe(p: Policy) {
  if (p.policy_type === 'time_window') return `${p.config?.start ?? '08:00'}–${p.config?.end ?? '18:00'} (Europe/Berlin)`;
  if (p.policy_type === 'weekday') return (p.config?.days ?? []).map((d: number) => DOW.find(x => x.v === d)?.l).join(', ') || '—';
  if (p.policy_type === 'ip_allowlist') return (p.config?.cidrs ?? []).join(', ') || '—';
  if (p.policy_type === 'session_limit') return `max. ${p.config?.minutes ?? 60} Min.`;
  return '—';
}

export default function ContextPolicies() {
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<Role[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ type: Policy['policy_type']; config: any; description: string }>({
    type: 'time_window', config: { start: '08:00', end: '18:00' }, description: '',
  });
  const [testResult, setTestResult] = useState<any[] | null>(null);
  const [testIp, setTestIp] = useState('');

  async function load() {
    setLoading(true);
    const [r, p] = await Promise.all([
      supabase.from('roles').select('id, name').order('name'),
      (supabase as any).from('role_context_policies').select('*').order('created_at', { ascending: false }),
    ]);
    setRoles(r.data ?? []);
    setPolicies((p.data ?? []) as Policy[]);
    if (!selectedRoleId && r.data?.length) setSelectedRoleId(r.data[0].id);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function addPolicy() {
    if (!selectedRoleId) return;
    let cfg = form.config;
    if (form.type === 'ip_allowlist' && typeof cfg?.cidrs === 'string') {
      cfg = { cidrs: cfg.cidrs.split(',').map((s: string) => s.trim()).filter(Boolean) };
    }
    if (form.type === 'weekday' && !Array.isArray(cfg?.days)) cfg = { days: [1, 2, 3, 4, 5] };
    if (form.type === 'session_limit' && !cfg?.minutes) cfg = { minutes: 60 };
    const { error } = await (supabase as any).from('role_context_policies').insert({
      role_id: selectedRoleId, policy_type: form.type, config: cfg, description: form.description || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Regel angelegt');
    setOpen(false);
    setForm({ type: 'time_window', config: { start: '08:00', end: '18:00' }, description: '' });
    load();
  }

  async function togglePolicy(p: Policy) {
    const { error } = await (supabase as any).from('role_context_policies')
      .update({ is_active: !p.is_active }).eq('id', p.id);
    if (error) { toast.error(error.message); return; }
    load();
  }
  async function delPolicy(p: Policy) {
    if (!confirm('Regel löschen?')) return;
    const { error } = await (supabase as any).from('role_context_policies').delete().eq('id', p.id);
    if (error) { toast.error(error.message); return; }
    load();
  }

  async function runTest() {
    if (!selectedRoleId) return;
    const { data, error } = await (supabase as any).rpc('evaluate_role_context', {
      _role_id: selectedRoleId,
      _ip: testIp.trim() || null,
    });
    if (error) { toast.error(error.message); return; }
    setTestResult(data ?? []);
  }

  if (loading) {
    return <div className="flex items-center gap-2 text-muted-foreground p-8"><Loader2 className="w-4 h-4 animate-spin" /> Lade Kontextregeln…</div>;
  }

  const rolePolicies = policies.filter(p => p.role_id === selectedRoleId);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Clock className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold">Kontextuelle Zugriffsregeln</h2>
          <p className="text-xs text-muted-foreground">
            Regeln pro Rolle: Zeitfenster, Wochentage, IP-Whitelist, Session-Limits. Auswertung über <code>evaluate_role_context</code>. Rein additiv — bestehende RBAC bleibt unverändert.
          </p>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px]">
            <Label className="text-xs">Rolle</Label>
            <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={!selectedRoleId}><Plus className="w-4 h-4 mr-1" /> Regel hinzufügen</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Kontextregel anlegen</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {TYPES.map(t => (
                    <button key={t.key} type="button"
                      onClick={() => setForm(f => ({
                        ...f, type: t.key as any,
                        config: t.key === 'time_window' ? { start: '08:00', end: '18:00' }
                          : t.key === 'weekday' ? { days: [1, 2, 3, 4, 5] }
                          : t.key === 'ip_allowlist' ? { cidrs: '' }
                          : { minutes: 60 },
                      }))}
                      className={`text-left p-3 rounded-md border transition-colors ${
                        form.type === t.key ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'
                      }`}
                    >
                      <div className="flex items-center gap-2 text-sm font-medium"><t.icon className="w-4 h-4" /> {t.label}</div>
                      <div className="text-xs text-muted-foreground mt-1">{t.help}</div>
                    </button>
                  ))}
                </div>

                {form.type === 'time_window' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label>Von</Label><Input type="time" value={form.config.start} onChange={e => setForm(f => ({ ...f, config: { ...f.config, start: e.target.value } }))} /></div>
                    <div><Label>Bis</Label><Input type="time" value={form.config.end} onChange={e => setForm(f => ({ ...f, config: { ...f.config, end: e.target.value } }))} /></div>
                  </div>
                )}
                {form.type === 'weekday' && (
                  <div>
                    <Label>Erlaubte Tage</Label>
                    <div className="flex gap-1 mt-1">
                      {DOW.map(d => {
                        const active = form.config.days?.includes(d.v);
                        return (
                          <button key={d.v} type="button"
                            onClick={() => setForm(f => {
                              const days = new Set<number>(f.config.days ?? []);
                              days.has(d.v) ? days.delete(d.v) : days.add(d.v);
                              return { ...f, config: { days: Array.from(days).sort() } };
                            })}
                            className={`w-10 h-9 rounded text-sm font-medium border transition-colors ${
                              active ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted/40'
                            }`}>{d.l}</button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {form.type === 'ip_allowlist' && (
                  <div>
                    <Label>CIDR-Bereiche (kommagetrennt)</Label>
                    <Input value={form.config.cidrs ?? ''} placeholder="10.0.0.0/8, 192.168.1.0/24, 203.0.113.42/32"
                      onChange={e => setForm(f => ({ ...f, config: { cidrs: e.target.value } }))} />
                  </div>
                )}
                {form.type === 'session_limit' && (
                  <div>
                    <Label>Maximale Session-Dauer (Minuten)</Label>
                    <Input type="number" min={5} max={1440} value={form.config.minutes ?? 60}
                      onChange={e => setForm(f => ({ ...f, config: { minutes: Number(e.target.value) } }))} />
                  </div>
                )}

                <div>
                  <Label>Beschreibung (optional)</Label>
                  <Textarea rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
                <Button onClick={addPolicy}>Regel speichern</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="mt-4 space-y-2">
          {rolePolicies.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Keine Kontextregeln für diese Rolle.</div>
          ) : rolePolicies.map(p => {
            const t = TYPES.find(x => x.key === p.policy_type)!;
            return (
              <div key={p.id} className={`p-3 rounded-md border flex items-center gap-3 ${
                p.is_active ? 'border-border' : 'border-border/50 opacity-60'
              }`}>
                <t.icon className="w-4 h-4 text-primary" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{t.label}</div>
                  <div className="text-xs text-muted-foreground truncate">{describe(p)}{p.description ? ` · ${p.description}` : ''}</div>
                </div>
                <Switch checked={p.is_active} onCheckedChange={() => togglePolicy(p)} />
                <Button size="sm" variant="ghost" onClick={() => delPolicy(p)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <Play className="w-4 h-4 text-primary" />
          <div className="text-sm font-semibold">Regelauswertung testen</div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[240px]">
            <Label className="text-xs">Test-IP (optional)</Label>
            <Input value={testIp} onChange={e => setTestIp(e.target.value)} placeholder="z. B. 192.168.1.42" />
          </div>
          <Button onClick={runTest} disabled={!selectedRoleId}>Jetzt auswerten</Button>
        </div>
        {testResult && (
          <div className="mt-4 space-y-2">
            {testResult.length === 0 && <div className="text-sm text-muted-foreground">Keine aktiven Regeln für diese Rolle.</div>}
            {testResult.map((r, i) => (
              <div key={i} className={`p-3 rounded-md border flex items-center gap-3 ${
                r.passed ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'
              }`}>
                {r.passed ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                <div className="flex-1">
                  <div className="text-sm font-medium">{TYPES.find(t => t.key === r.policy_type)?.label ?? r.policy_type}</div>
                  <div className="text-xs text-muted-foreground">{r.reason}</div>
                </div>
                <Badge variant="outline" className={r.passed ? 'border-emerald-500/40 text-emerald-500' : 'border-red-500/40 text-red-500'}>
                  {r.passed ? 'Erfüllt' : 'Verletzt'}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

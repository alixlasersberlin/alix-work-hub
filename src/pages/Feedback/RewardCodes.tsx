import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { FeedbackHeader, Kpi } from './_shared';
import { Ticket, Plus, Upload, Download, Trash2, Search, CheckCircle2, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { useCanDelete } from '@/hooks/useCanDelete';

const STATUS_LABEL: Record<string, string> = {
  frei: 'Frei', zugewiesen: 'Zugewiesen', eingeloest: 'Eingelöst', abgelaufen: 'Abgelaufen', gesperrt: 'Gesperrt',
};
const STATUS_CLS: Record<string, string> = {
  frei: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  zugewiesen: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  eingeloest: 'bg-primary/15 text-primary border-primary/30',
  abgelaufen: 'bg-muted text-muted-foreground',
  gesperrt: 'bg-destructive/15 text-destructive border-destructive/30',
};

function randomCode(prefix: string, len: number) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) s += chars[arr[i] % chars.length];
  return `${prefix ? prefix.toUpperCase() + '-' : ''}${s}`;
}

export default function FeedbackRewardCodes() {
  const sb = supabase as any;
  const canDelete = useCanDelete();
  const [rewards, setRewards] = useState<any[]>([]);
  const [rewardId, setRewardId] = useState<string>('');
  const [codes, setCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('alle');

  const [genOpen, setGenOpen] = useState(false);
  const [genCount, setGenCount] = useState('25');
  const [genPrefix, setGenPrefix] = useState('');
  const [genLen, setGenLen] = useState('8');
  const [genExpires, setGenExpires] = useState('');

  const [impOpen, setImpOpen] = useState(false);
  const [impText, setImpText] = useState('');

  useEffect(() => {
    sb.from('survey_rewards').select('id,name,reward_type,status').is('deleted_at', null).order('name')
      .then(({ data }: any) => {
        setRewards(data ?? []);
        if (data?.length) setRewardId((prev: string) => prev || data[0].id);
        else setLoading(false);
      });
  }, []);

  async function load() {
    if (!rewardId) return;
    setLoading(true);
    const { data } = await sb.from('survey_reward_codes').select('*').eq('reward_id', rewardId).order('created_at', { ascending: false }).limit(2000);
    setCodes(data ?? []); setLoading(false);
  }
  useEffect(() => { load(); }, [rewardId]);

  const filtered = useMemo(() => codes.filter(c =>
    (status === 'alle' || c.status === status) &&
    (!q || c.code.toLowerCase().includes(q.toLowerCase()))
  ), [codes, q, status]);

  const stats = useMemo(() => ({
    total: codes.length,
    frei: codes.filter(c => c.status === 'frei').length,
    zugewiesen: codes.filter(c => c.status === 'zugewiesen').length,
    eingeloest: codes.filter(c => c.status === 'eingeloest').length,
  }), [codes]);

  async function generate() {
    const n = Math.min(Math.max(parseInt(genCount || '0', 10) || 0, 1), 1000);
    const len = Math.min(Math.max(parseInt(genLen || '8', 10) || 8, 4), 16);
    const set = new Set<string>();
    while (set.size < n) set.add(randomCode(genPrefix.trim(), len));
    const rows = [...set].map(code => ({
      reward_id: rewardId, code, status: 'frei',
      expires_at: genExpires ? new Date(genExpires).toISOString() : null,
    }));
    const { error } = await sb.from('survey_reward_codes').insert(rows);
    if (error) { toast.error(error.message); return; }
    toast.success(`${n} Codes erzeugt`);
    setGenOpen(false); load();
  }

  async function importCodes() {
    const list = [...new Set(impText.split(/[\n,;\s]+/).map(s => s.trim()).filter(Boolean))];
    if (!list.length) { toast.error('Keine Codes erkannt'); return; }
    const { error } = await sb.from('survey_reward_codes').insert(list.map(code => ({ reward_id: rewardId, code, status: 'frei' })));
    if (error) { toast.error(error.message); return; }
    toast.success(`${list.length} Codes importiert`);
    setImpOpen(false); setImpText(''); load();
  }

  async function setCodeStatus(id: string, next: string) {
    const patch: any = { status: next };
    if (next === 'eingeloest') patch.redeemed_at = new Date().toISOString();
    const { error } = await sb.from('survey_reward_codes').update(patch).eq('id', id);
    if (error) toast.error(error.message); else load();
  }

  async function remove(id: string) {
    if (!confirm('Code wirklich löschen?')) return;
    const { error } = await sb.from('survey_reward_codes').delete().eq('id', id);
    if (error) toast.error(error.message); else { toast.success('Gelöscht'); load(); }
  }

  function exportCsv() {
    const head = ['Code', 'Status', 'Gültig bis', 'Zugewiesen am', 'Eingelöst am', 'Erstellt am'];
    const rows = filtered.map(c => [
      c.code, STATUS_LABEL[c.status] ?? c.status,
      c.expires_at ? new Date(c.expires_at).toLocaleDateString('de-DE') : '',
      c.assigned_at ? new Date(c.assigned_at).toLocaleString('de-DE') : '',
      c.redeemed_at ? new Date(c.redeemed_at).toLocaleString('de-DE') : '',
      new Date(c.created_at).toLocaleString('de-DE'),
    ]);
    const csv = [head, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `gutscheincodes-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  function copyFree() {
    const free = filtered.filter(c => c.status === 'frei').map(c => c.code).join('\n');
    if (!free) { toast.error('Keine freien Codes'); return; }
    navigator.clipboard.writeText(free);
    toast.success('Freie Codes kopiert');
  }

  return (
    <div className="space-y-5">
      <FeedbackHeader
        title="Gutscheincodes"
        subtitle="Codes je Belohnung erzeugen, importieren und verwalten"
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={copyFree}><Copy className="h-4 w-4 mr-2" />Freie kopieren</Button>
            <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-2" />CSV</Button>
            <Button variant="outline" onClick={() => setImpOpen(true)} disabled={!rewardId}><Upload className="h-4 w-4 mr-2" />Import</Button>
            <Button onClick={() => setGenOpen(true)} disabled={!rewardId}><Plus className="h-4 w-4 mr-2" />Codes erzeugen</Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Codes gesamt" value={stats.total} icon={Ticket} />
        <Kpi label="Frei" value={stats.frei} icon={Ticket} tone="green" />
        <Kpi label="Zugewiesen" value={stats.zugewiesen} icon={Ticket} tone="amber" />
        <Kpi label="Eingelöst" value={stats.eingeloest} icon={CheckCircle2} />
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Filter</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div>
            <Label className="text-xs">Belohnung</Label>
            <Select value={rewardId} onValueChange={setRewardId}>
              <SelectTrigger><SelectValue placeholder="Belohnung wählen" /></SelectTrigger>
              <SelectContent>
                {rewards.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle</SelectItem>
                {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Suche</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Code …" value={q} onChange={e => setQ(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="p-3">Code</th><th className="p-3">Status</th><th className="p-3">Gültig bis</th>
                <th className="p-3">Zugewiesen</th><th className="p-3">Eingelöst</th><th className="p-3 text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-t border-border hover:bg-muted/20">
                  <td className="p-3 font-mono">{c.code}</td>
                  <td className="p-3"><Badge variant="outline" className={STATUS_CLS[c.status] ?? ''}>{STATUS_LABEL[c.status] ?? c.status}</Badge></td>
                  <td className="p-3 text-muted-foreground text-xs">{c.expires_at ? new Date(c.expires_at).toLocaleDateString('de-DE') : '–'}</td>
                  <td className="p-3 text-muted-foreground text-xs">{c.assigned_at ? new Date(c.assigned_at).toLocaleString('de-DE') : '–'}</td>
                  <td className="p-3 text-muted-foreground text-xs">{c.redeemed_at ? new Date(c.redeemed_at).toLocaleString('de-DE') : '–'}</td>
                  <td className="p-3 text-right whitespace-nowrap">
                    {c.status !== 'eingeloest' && (
                      <Button size="sm" variant="ghost" onClick={() => setCodeStatus(c.id, 'eingeloest')}>
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                    )}
                    {c.status !== 'gesperrt' ? (
                      <Button size="sm" variant="ghost" onClick={() => setCodeStatus(c.id, 'gesperrt')}>Sperren</Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setCodeStatus(c.id, 'frei')}>Freigeben</Button>
                    )}
                    {canDelete && <Button size="sm" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td className="p-4 text-muted-foreground" colSpan={6}>
                  {loading ? 'Lade …' : rewards.length === 0 ? 'Zuerst eine Belohnung unter „Geschenke“ anlegen.' : 'Keine Codes gefunden.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Codes erzeugen</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label className="text-xs">Anzahl (max. 1000)</Label><Input value={genCount} onChange={e => setGenCount(e.target.value)} /></div>
            <div><Label className="text-xs">Präfix (optional)</Label><Input placeholder="z. B. ALIX" value={genPrefix} onChange={e => setGenPrefix(e.target.value)} /></div>
            <div><Label className="text-xs">Codelänge</Label><Input value={genLen} onChange={e => setGenLen(e.target.value)} /></div>
            <div><Label className="text-xs">Gültig bis (optional)</Label><Input type="date" value={genExpires} onChange={e => setGenExpires(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenOpen(false)}>Abbrechen</Button>
            <Button onClick={generate}>Erzeugen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={impOpen} onOpenChange={setImpOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Codes importieren</DialogTitle></DialogHeader>
          <Textarea rows={10} placeholder="Ein Code pro Zeile …" value={impText} onChange={e => setImpText(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setImpOpen(false)}>Abbrechen</Button>
            <Button onClick={importCodes}>Importieren</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

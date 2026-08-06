import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { GitPullRequest, Loader2, Search, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { plmLabel, statusTone, CHANGE_STATUS } from '@/lib/plm/config';

interface Row { id: string; [k: string]: any }

const toneClass: Record<string, string> = {
  ok: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  warn: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  bad: 'bg-destructive/15 text-destructive border-destructive/30',
  muted: 'bg-muted text-muted-foreground border-border',
};

export default function PlmAenderungsfreigabe() {
  const [loading, setLoading] = useState(true);
  const [changes, setChanges] = useState<Row[]>([]);
  const [devices, setDevices] = useState<Row[]>([]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'offen' | 'alle'>('offen');
  const [active, setActive] = useState<Row | null>(null);
  const [risk, setRisk] = useState('');
  const [status, setStatus] = useState('genehmigt');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [c, d] = await Promise.all([
      supabase.from('plm_changes' as any).select('*').order('created_at', { ascending: false }).limit(1000),
      supabase.from('plm_devices' as any).select('id,name,article_number').limit(500),
    ]);
    if (c.error || d.error) toast.error((c.error || d.error)!.message);
    setChanges((c.data as any[]) || []);
    setDevices((d.data as any[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const devMap = useMemo(() => Object.fromEntries(devices.map(d => [d.id, d])), [devices]);

  const filtered = changes.filter(c => {
    if (tab === 'offen' && ['umgesetzt', 'geschlossen', 'abgelehnt'].includes(c.status)) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return `${c.change_number || ''} ${c.title || ''} ${c.reason || ''}`.toLowerCase().includes(s);
  });

  const open = (c: Row) => { setActive(c); setRisk(c.risk_assessment || ''); setStatus(c.status === 'beantragt' ? 'bewertet' : 'genehmigt'); };

  const save = async (qm: boolean) => {
    if (!active) return;
    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id ?? null;
    const patch: Record<string, any> = { status, risk_assessment: risk || null };
    if (status === 'genehmigt') {
      patch.approved_by = uid;
      patch.approved_at = new Date().toISOString();
      if (qm) { patch.qm_approved_by = uid; patch.qm_approved_at = new Date().toISOString(); }
    }
    const { error } = await supabase.from('plm_changes' as any).update(patch as any).eq('id', active.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    await supabase.from('plm_audit_log' as any).insert({
      entity_type: 'change', entity_id: active.id, action: qm ? 'qm_approval' : 'approval',
      changes: patch, user_id: uid,
    } as any);
    toast.success('Änderung aktualisiert');
    setActive(null);
    load();
  };

  const kpis = [
    { label: 'Beantragt', value: changes.filter(c => c.status === 'beantragt').length },
    { label: 'In Bewertung', value: changes.filter(c => c.status === 'bewertet').length },
    { label: 'Genehmigt (offen)', value: changes.filter(c => c.status === 'genehmigt').length },
    { label: 'Ohne QM-Freigabe', value: changes.filter(c => c.status === 'genehmigt' && !c.qm_approved_at).length },
  ];

  return (
    <div className="container max-w-7xl py-6 space-y-6">
      <PageHeader
        icon={GitPullRequest}
        title="Änderungsfreigabe (ECR/ECO)"
        subtitle="Bewertung, Genehmigung und QM-Freigabe von Änderungsanträgen mit Audit-Trail."
        noBreadcrumbs
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(k => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{k.label}</div>
              <div className="mt-1 text-2xl font-semibold">{k.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <div className="flex gap-1">
            {(['offen', 'alle'] as const).map(t => (
              <Button key={t} size="sm" variant={tab === t ? 'default' : 'outline'} onClick={() => setTab(t)}>
                {t === 'offen' ? 'Offene' : 'Alle'}
              </Button>
            ))}
          </div>
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Nummer, Titel, Grund …" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nr.</TableHead><TableHead>Art</TableHead><TableHead>Titel</TableHead>
                <TableHead>Gerät</TableHead><TableHead>Risiko</TableHead><TableHead>Status</TableHead>
                <TableHead>QM</TableHead><TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-muted-foreground">Keine Änderungen.</TableCell></TableRow>}
              {filtered.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.change_number || '—'}</TableCell>
                  <TableCell>{c.change_kind || '—'}</TableCell>
                  <TableCell>{c.title}</TableCell>
                  <TableCell>{devMap[c.device_id]?.name || '—'}</TableCell>
                  <TableCell>{plmLabel(c.risk_level)}</TableCell>
                  <TableCell><Badge variant="outline" className={toneClass[statusTone(c.status)]}>{plmLabel(c.status)}</Badge></TableCell>
                  <TableCell>{c.qm_approved_at ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}</TableCell>
                  <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => open(c)}>Bearbeiten</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!active} onOpenChange={o => !o && setActive(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{active?.change_kind} {active?.change_number} — {active?.title}</DialogTitle></DialogHeader>
          <div className="space-y-4 text-sm">
            <div><span className="text-muted-foreground">Grund: </span>{active?.reason || '—'}</div>
            <div><span className="text-muted-foreground">Beschreibung: </span>{active?.description || '—'}</div>
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-muted-foreground">Alte Revision: </span>{active?.old_revision || '—'}</div>
              <div><span className="text-muted-foreground">Neue Revision: </span>{active?.new_revision || '—'}</div>
            </div>
            <div className="space-y-2">
              <label className="text-muted-foreground">Risikobewertung</label>
              <Textarea rows={3} value={risk} onChange={e => setRisk(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-muted-foreground">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                {CHANGE_STATUS.map(s => <option key={s} value={s}>{plmLabel(s)}</option>)}
              </select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setActive(null)}>Abbrechen</Button>
            <Button variant="outline" onClick={() => save(false)} disabled={saving}>Speichern</Button>
            <Button onClick={() => save(true)} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Mit QM-Freigabe
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

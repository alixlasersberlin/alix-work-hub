import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FeedbackHeader, Kpi } from './_shared';
import { Gift, CheckCircle2, Clock, XCircle, Search, RefreshCw, History } from 'lucide-react';
import { toast } from 'sonner';

type Row = any;

const STATUS_LABELS: Record<string, string> = {
  ausstehend: 'Ausstehend',
  zugesagt: 'Zugesagt',
  versendet: 'Versendet',
  eingeloest: 'Eingelöst',
  abgelaufen: 'Abgelaufen',
  fehlgeschlagen: 'Fehlgeschlagen',
  storniert: 'Storniert',
};

function normStatus(a: Row): string {
  if (a.status && STATUS_LABELS[a.status]) return a.status;
  if (a.redeemed_at) return 'eingeloest';
  if (a.expires_at && new Date(a.expires_at) < new Date()) return 'abgelaufen';
  if (a.emailed_at || a.shipped_at) return 'versendet';
  if (a.issued_at) return 'zugesagt';
  return 'ausstehend';
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'eingeloest' ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
    : status === 'fehlgeschlagen' || status === 'storniert' ? 'bg-destructive/15 text-destructive border-destructive/30'
    : status === 'abgelaufen' ? 'bg-muted text-muted-foreground border-border'
    : status === 'versendet' ? 'bg-primary/15 text-primary border-primary/30'
    : 'bg-amber-500/15 text-amber-500 border-amber-500/30';
  return <Badge variant="outline" className={cls}>{STATUS_LABELS[status] ?? status}</Badge>;
}

const fmt = (v?: string | null) => (v ? new Date(v).toLocaleString('de-DE') : null);

function timeline(a: Row) {
  const items: { label: string; at: string | null }[] = [
    { label: 'Erstellt', at: fmt(a.created_at) },
    { label: 'Zugesagt / ausgestellt', at: fmt(a.issued_at) },
    { label: 'Per E-Mail versendet', at: fmt(a.emailed_at) },
    { label: 'Heruntergeladen', at: fmt(a.downloaded_at) },
    { label: 'Versendet (Postweg)', at: fmt(a.shipped_at) },
    { label: 'Eingelöst', at: fmt(a.redeemed_at) },
    { label: 'Gültig bis', at: fmt(a.expires_at) },
    { label: 'Zuletzt aktualisiert', at: fmt(a.updated_at) },
  ];
  return items;
}

export default function FeedbackRewardAssignments() {
  const sb = supabase as any;
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('alle');
  const [detail, setDetail] = useState<Row | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await sb
      .from('survey_reward_assignments')
      .select('*, reward:survey_rewards(name,reward_type,value_amount,currency), recipient:survey_recipients(company_name,first_name,last_name,email,customer_number)')
      .order('created_at', { ascending: false })
      .limit(1000);
    if (error) toast.error(error.message);
    setRows(data ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const enriched = useMemo(() => rows.map(r => ({ ...r, _status: normStatus(r) })), [rows]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return enriched.filter(r => {
      if (status !== 'alle' && r._status !== status) return false;
      if (!s) return true;
      const hay = [
        r.reward?.name, r.code_text, r.recipient?.company_name, r.recipient?.email,
        r.recipient?.first_name, r.recipient?.last_name, r.recipient?.customer_number,
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(s);
    });
  }, [enriched, q, status]);

  const count = (s: string) => enriched.filter(r => r._status === s).length;

  async function setAssignmentStatus(id: string, next: string) {
    const patch: any = { status: next };
    if (next === 'eingeloest') patch.redeemed_at = new Date().toISOString();
    const { error } = await sb.from('survey_reward_assignments').update(patch).eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Status aktualisiert');
    setDetail(null);
    load();
  }

  return (
    <div className="space-y-5">
      <FeedbackHeader
        title="Belohnungszusagen"
        subtitle="Status und Verlauf jeder vergebenen Prämie"
        action={<Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4 mr-2" />Aktualisieren</Button>}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Gesamt" value={enriched.length} icon={Gift} />
        <Kpi label="Eingelöst" value={count('eingeloest')} icon={CheckCircle2} tone="green" />
        <Kpi label="Ausstehend" value={count('ausstehend') + count('zugesagt') + count('versendet')} icon={Clock} tone="amber" />
        <Kpi label="Fehlgeschlagen / Abgelaufen" value={count('fehlgeschlagen') + count('storniert') + count('abgelaufen')} icon={XCircle} tone="red" />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Suche nach Kunde, E-Mail, Code oder Belohnung…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle Status</SelectItem>
            {Object.entries(STATUS_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left"><tr>
              <th className="p-3">Empfänger</th><th className="p-3">Belohnung</th><th className="p-3">Code</th>
              <th className="p-3">Status</th><th className="p-3">Zugesagt</th><th className="p-3">Eingelöst</th><th className="p-3" />
            </tr></thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="border-t border-border hover:bg-muted/20 cursor-pointer" onClick={() => setDetail(r)}>
                  <td className="p-3">
                    <div className="font-medium">{r.recipient?.company_name || [r.recipient?.first_name, r.recipient?.last_name].filter(Boolean).join(' ') || '–'}</div>
                    <div className="text-xs text-muted-foreground">{r.recipient?.email ?? ''}</div>
                  </td>
                  <td className="p-3">
                    {r.reward?.name ?? '–'}
                    {r.reward?.value_amount ? <div className="text-xs text-muted-foreground">{r.reward.value_amount} {r.reward.currency ?? ''}</div> : null}
                  </td>
                  <td className="p-3 font-mono text-xs">{r.code_text ?? '–'}</td>
                  <td className="p-3"><StatusBadge status={r._status} /></td>
                  <td className="p-3 text-muted-foreground">{fmt(r.issued_at) ?? '–'}</td>
                  <td className="p-3 text-muted-foreground">{fmt(r.redeemed_at) ?? '–'}</td>
                  <td className="p-3 text-right"><Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); setDetail(r); }}><History className="h-4 w-4 mr-1" />Verlauf</Button></td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && <tr><td className="p-4 text-muted-foreground" colSpan={7}>Keine Belohnungszusagen gefunden.</td></tr>}
              {loading && <tr><td className="p-4 text-muted-foreground" colSpan={7}>Lade…</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={!!detail} onOpenChange={o => !o && setDetail(null)}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-auto">
          <DialogHeader><DialogTitle>Belohnungszusage · Verlauf</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2 text-sm">
                <div><div className="text-muted-foreground text-xs">Empfänger</div>{detail.recipient?.company_name || [detail.recipient?.first_name, detail.recipient?.last_name].filter(Boolean).join(' ') || '–'}</div>
                <div><div className="text-muted-foreground text-xs">E-Mail</div>{detail.recipient?.email ?? '–'}</div>
                <div><div className="text-muted-foreground text-xs">Belohnung</div>{detail.reward?.name ?? '–'}</div>
                <div><div className="text-muted-foreground text-xs">Code</div><span className="font-mono">{detail.code_text ?? '–'}</span></div>
                <div><div className="text-muted-foreground text-xs">Status</div><StatusBadge status={normStatus(detail)} /></div>
              </div>

              <div className="border-t border-border pt-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Verlauf</div>
                <ol className="space-y-2">
                  {timeline(detail).map((t, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${t.at ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                      <span className={t.at ? '' : 'text-muted-foreground'}>{t.label}</span>
                      <span className="ml-auto text-muted-foreground text-xs">{t.at ?? '–'}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="border-t border-border pt-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Status ändern</div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(STATUS_LABELS).map(([v, l]) => (
                    <Button key={v} size="sm" variant={normStatus(detail) === v ? 'default' : 'outline'} onClick={() => setAssignmentStatus(detail.id, v)}>{l}</Button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

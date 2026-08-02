import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FeedbackHeader, Kpi } from './_shared';
import { Mail, MailCheck, MailX, RefreshCw, Download, Eye, MousePointerClick } from 'lucide-react';

const KIND_LABEL: Record<string, string> = {
  einladung: 'Einladung', erinnerung: 'Erinnerung', danke: 'Dankeschön',
  belohnung: 'Belohnung', alarm: 'Alarm', test: 'Test',
};

function fmt(d?: string | null) {
  return d ? new Date(d).toLocaleString('de-DE') : '–';
}

export default function FeedbackMailLog() {
  const sb = supabase as any;
  const [surveys, setSurveys] = useState<any[]>([]);
  const [surveyId, setSurveyId] = useState('all');
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [logs, setLogs] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    sb.from('surveys').select('id,name').is('deleted_at', null).order('name').then((r: any) => setSurveys(r.data ?? []));
    /* eslint-disable-next-line */
  }, []);

  async function load() {
    setLoading(true);
    let lq = sb.from('survey_email_logs').select('*').order('created_at', { ascending: false }).limit(1000);
    let iq = sb.from('survey_invitations').select('*').order('created_at', { ascending: false }).limit(1000);
    if (surveyId !== 'all') { lq = lq.eq('survey_id', surveyId); iq = iq.eq('survey_id', surveyId); }
    const [l, i] = await Promise.all([lq, iq]);
    const list = l.data ?? [];
    const inv = i.data ?? [];
    const rids = Array.from(new Set([...list, ...inv].map((r: any) => r.recipient_id).filter(Boolean)));
    const recMap: Record<string, any> = {};
    if (rids.length) {
      const { data: recs } = await sb.from('survey_recipients')
        .select('id,company_name,first_name,last_name,email').in('id', rids);
      (recs ?? []).forEach((x: any) => { recMap[x.id] = x; });
    }
    const invByRec: Record<string, any> = {};
    inv.forEach((x: any) => { if (x.recipient_id && !invByRec[x.recipient_id]) invByRec[x.recipient_id] = x; });
    setInvites(inv);
    setLogs(list.map((r: any) => ({ ...r, recipient: recMap[r.recipient_id], invite: invByRec[r.recipient_id] })));
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [surveyId]);

  const filtered = useMemo(() => logs.filter(r => {
    if (status !== 'all' && (r.status ?? '') !== status) return false;
    if (!q) return true;
    const hay = `${r.to_email ?? ''} ${r.subject ?? ''} ${r.recipient?.company_name ?? ''} ${r.recipient?.first_name ?? ''} ${r.recipient?.last_name ?? ''}`;
    return hay.toLowerCase().includes(q.toLowerCase());
  }), [logs, status, q]);

  const stats = useMemo(() => ({
    total: logs.length,
    sent: logs.filter(r => r.status === 'gesendet' || r.sent_at).length,
    failed: logs.filter(r => r.status === 'fehler' || r.error_text).length,
    opened: invites.filter(i => i.opened_at).length,
    clicked: invites.filter(i => i.clicked_at).length,
  }), [logs, invites]);

  function exportCsv() {
    const head = ['Datum', 'Art', 'Empfänger', 'E-Mail', 'Betreff', 'Status', 'Versuch', 'Gesendet', 'Geöffnet', 'Geklickt', 'Fehler'];
    const lines = filtered.map(r => [
      fmt(r.created_at), KIND_LABEL[r.kind] ?? r.kind ?? '',
      r.recipient?.company_name || `${r.recipient?.first_name ?? ''} ${r.recipient?.last_name ?? ''}`.trim(),
      r.to_email ?? '', r.subject ?? '', r.status ?? '', r.attempt ?? '',
      fmt(r.sent_at), fmt(r.invite?.opened_at), fmt(r.invite?.clicked_at), r.error_text ?? '',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'));
    const blob = new Blob(['\uFEFF' + [head.join(';'), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'versand-protokoll.csv';
    a.click();
  }

  const statuses = Array.from(new Set(logs.map(r => r.status).filter(Boolean)));

  return (
    <div className="space-y-5">
      <FeedbackHeader
        title="Versand-Protokoll"
        subtitle="Alle versendeten Einladungen, Erinnerungen und Benachrichtigungen"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4 mr-2" />Aktualisieren</Button>
            <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-2" />CSV Export</Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="E-Mails gesamt" value={stats.total} icon={Mail} />
        <Kpi label="Erfolgreich" value={stats.sent} icon={MailCheck} tone="green" />
        <Kpi label="Fehlgeschlagen" value={stats.failed} icon={MailX} tone="red" />
        <Kpi label="Geöffnet" value={stats.opened} icon={Eye} />
        <Kpi label="Link geklickt" value={stats.clicked} icon={MousePointerClick} tone="amber" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={surveyId} onValueChange={setSurveyId}>
          <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Umfragen</SelectItem>
            {surveys.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            {statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input className="max-w-xs" placeholder="E-Mail, Betreff oder Kunde …" value={q} onChange={e => setQ(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left"><tr>
              <th className="p-3">Datum</th><th className="p-3">Art</th><th className="p-3">Empfänger</th>
              <th className="p-3">Betreff</th><th className="p-3">Status</th>
              <th className="p-3">Geöffnet</th><th className="p-3">Geklickt</th>
            </tr></thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="border-t border-border hover:bg-muted/20 align-top">
                  <td className="p-3 text-muted-foreground whitespace-nowrap">{fmt(r.created_at)}</td>
                  <td className="p-3"><Badge variant="outline">{KIND_LABEL[r.kind] ?? r.kind ?? '–'}</Badge></td>
                  <td className="p-3">
                    {r.recipient?.company_name || `${r.recipient?.first_name ?? ''} ${r.recipient?.last_name ?? ''}`.trim() || '–'}
                    <div className="text-xs text-muted-foreground">{r.to_email}</div>
                  </td>
                  <td className="p-3 max-w-[24rem]">
                    <div className="truncate">{r.subject ?? '–'}</div>
                    {r.error_text && <div className="text-xs text-destructive mt-1">{r.error_text}</div>}
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <Badge variant="outline" className={
                      r.status === 'fehler' || r.error_text ? 'border-destructive/40 text-destructive'
                        : r.sent_at ? 'border-emerald-500/30 text-emerald-400' : ''
                    }>{r.status ?? (r.sent_at ? 'gesendet' : 'offen')}</Badge>
                    {(r.attempt ?? 0) > 1 && <span className="ml-1 text-xs text-muted-foreground">#{r.attempt}</span>}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{fmt(r.invite?.opened_at)}</td>
                  <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{fmt(r.invite?.clicked_at)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td className="p-4 text-muted-foreground" colSpan={7}>{loading ? 'Lade …' : 'Keine Versand-Einträge vorhanden.'}</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

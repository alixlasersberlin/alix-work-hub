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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Megaphone, Plus, Send, Trophy, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/infinity/PageHeader';

type Campaign = {
  id: string; name: string; channel_type: string; subject: string | null;
  body: string | null; status: string; is_ab_test: boolean; ab_variants: any;
  winner_metric: string | null; total_count: number; sent_count: number;
  failed_count: number; scheduled_at: string | null; created_at: string;
};

const CHANNELS = ['email', 'sms', 'whatsapp', 'voice'];
const METRICS = ['open_rate', 'click_rate', 'reply_rate', 'conversion'];

export default function OmnichannelCampaigns() {
  const [rows, setRows] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: '', channel_type: 'email', subject: '', body: '',
    is_ab_test: false, variant_b_subject: '', variant_b_body: '',
    winner_metric: 'open_rate', scheduled_at: '',
  });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('ac_campaigns' as any)
      .select('*').order('created_at', { ascending: false }).limit(200);
    if (error) toast.error(error.message);
    setRows((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.name.trim()) return toast.error('Name erforderlich');
    setCreating(true);
    const ab_variants = form.is_ab_test ? [
      { key: 'A', subject: form.subject, body: form.body, weight: 50 },
      { key: 'B', subject: form.variant_b_subject || form.subject, body: form.variant_b_body || form.body, weight: 50 },
    ] : null;
    const { error } = await supabase.from('ac_campaigns' as any).insert({
      name: form.name, channel_type: form.channel_type, subject: form.subject || null,
      body: form.body || null, status: 'draft', is_ab_test: form.is_ab_test,
      ab_variants, winner_metric: form.is_ab_test ? form.winner_metric : null,
      scheduled_at: form.scheduled_at || null,
    });
    if (error) toast.error(error.message);
    else { toast.success('Kampagne erstellt'); setForm({ ...form, name: '', subject: '', body: '', variant_b_subject: '', variant_b_body: '' }); load(); }
    setCreating(false);
  };

  const runCampaign = async (id: string) => {
    const { error } = await supabase.functions.invoke('ac-campaign-run', { body: { campaign_id: id } });
    if (error) toast.error(error.message);
    else { toast.success('Kampagne gestartet'); load(); }
  };

  const decideWinner = async (id: string) => {
    const { data, error } = await supabase.functions.invoke('ac-campaign-ab-decide', { body: { campaign_id: id } });
    if (error) toast.error(error.message);
    else toast.success(`Winner: Variante ${data?.winner ?? '—'}`);
    load();
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Omnichannel Campaigns"
        subtitle="Email · SMS · WhatsApp · Voice · A/B-Testing · Attribution"
        icon={<Megaphone className="h-5 w-5" />}
      />

      <Card>
        <CardHeader><CardTitle className="text-sm">Neue Kampagne</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1"><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1">
              <Label>Kanal</Label>
              <Select value={form.channel_type} onValueChange={v => setForm({ ...form, channel_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CHANNELS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Geplant für</Label><Input type="datetime-local" value={form.scheduled_at} onChange={e => setForm({ ...form, scheduled_at: e.target.value })} /></div>
          </div>
          <div className="space-y-1"><Label>Betreff / Titel</Label><Input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} /></div>
          <div className="space-y-1"><Label>Inhalt</Label><Textarea rows={4} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} /></div>
          <div className="flex items-center gap-3 pt-2">
            <Switch checked={form.is_ab_test} onCheckedChange={v => setForm({ ...form, is_ab_test: v })} />
            <Label>A/B-Test aktivieren</Label>
            {form.is_ab_test && (
              <Select value={form.winner_metric} onValueChange={v => setForm({ ...form, winner_metric: v })}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>{METRICS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </div>
          {form.is_ab_test && (
            <div className="grid gap-3 md:grid-cols-2 rounded-md border border-border/60 bg-muted/20 p-3">
              <div className="space-y-1"><Label>Variante B · Betreff</Label><Input value={form.variant_b_subject} onChange={e => setForm({ ...form, variant_b_subject: e.target.value })} /></div>
              <div className="space-y-1 md:col-span-2"><Label>Variante B · Inhalt</Label><Textarea rows={3} value={form.variant_b_body} onChange={e => setForm({ ...form, variant_b_body: e.target.value })} /></div>
            </div>
          )}
          <Button onClick={create} disabled={creating}><Plus className="mr-2 h-4 w-4" />Kampagne anlegen</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Kampagnen</CardTitle>
          <Button size="sm" variant="outline" onClick={load}><RefreshCw className="mr-1 h-3 w-3" />Aktualisieren</Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Name</TableHead><TableHead>Kanal</TableHead><TableHead>Status</TableHead>
              <TableHead>A/B</TableHead><TableHead>Sent / Total</TableHead>
              <TableHead>Erstellt</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{r.name}</TableCell>
                  <TableCell><Badge variant="outline">{r.channel_type}</Badge></TableCell>
                  <TableCell><Badge>{r.status}</Badge></TableCell>
                  <TableCell>{r.is_ab_test ? <Badge variant="secondary">{r.winner_metric ?? 'A/B'}</Badge> : '—'}</TableCell>
                  <TableCell className="text-xs tabular-nums">{r.sent_count ?? 0} / {r.total_count ?? 0}</TableCell>
                  <TableCell className="text-xs">{new Date(r.created_at).toLocaleString('de-DE')}</TableCell>
                  <TableCell className="flex gap-1">
                    {r.status === 'draft' && <Button size="sm" variant="outline" onClick={() => runCampaign(r.id)}><Send className="mr-1 h-3 w-3" />Start</Button>}
                    {r.is_ab_test && r.status !== 'draft' && <Button size="sm" variant="outline" onClick={() => decideWinner(r.id)}><Trophy className="mr-1 h-3 w-3" />Winner</Button>}
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-xs text-muted-foreground">Keine Kampagnen</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Save, Send, CheckCircle2, XCircle, Calendar as CalIcon, Sparkles, ImagePlus, Loader2 } from 'lucide-react';

const PLATFORMS = ['facebook','instagram','tiktok','linkedin','youtube','x','pinterest'];

export default function SocialBeitragEditor() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const isNew = !id || id === 'neu';

  const [clients, setClients] = useState<Array<{ id: string; company_name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [form, setForm] = useState<any>({
    client_id: '', platform: 'instagram', title: '', body: '',
    hashtags: [], scheduled_at: '', status: 'draft', media_ids: [] as string[],
  });
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiBusy, setAiBusy] = useState<null | 'caption' | 'image'>(null);
  const [aiPreviews, setAiPreviews] = useState<string[]>([]);

  async function aiCaption() {
    if (!aiPrompt.trim()) return toast.error('Bitte Idee/Prompt eingeben');
    if (!form.client_id) return toast.error('Bitte Kunde wählen');
    setAiBusy('caption');
    const { data, error } = await supabase.functions.invoke('social-ai-generate', {
      body: { action: 'caption', client_id: form.client_id, platform: form.platform, prompt: aiPrompt },
    });
    setAiBusy(null);
    if (error || (data as any)?.error) return toast.error(error?.message ?? (data as any)?.error);
    setForm((f: any) => ({
      ...f,
      title: (data as any).title || f.title,
      body: (data as any).caption || f.body,
      hashtags: Array.isArray((data as any).hashtags) && (data as any).hashtags.length ? (data as any).hashtags : f.hashtags,
    }));
    toast.success('Text generiert');
  }

  async function aiImage() {
    if (!aiPrompt.trim()) return toast.error('Bitte Bild-Prompt eingeben');
    if (!form.client_id) return toast.error('Bitte Kunde wählen');
    setAiBusy('image');
    const { data, error } = await supabase.functions.invoke('social-ai-generate', {
      body: { action: 'image', client_id: form.client_id, prompt: aiPrompt },
    });
    setAiBusy(null);
    if (error || (data as any)?.error) return toast.error(error?.message ?? (data as any)?.error);
    const d = data as any;
    setAiPreviews(p => [d.signed_url, ...p].filter(Boolean));
    setForm((f: any) => ({ ...f, media_ids: [...(f.media_ids ?? []), d.asset_id] }));
    toast.success('Bild generiert und angehängt');
  }

  useEffect(() => {
    supabase.from('social_clients').select('id,company_name').is('deleted_at', null).order('company_name').then(({ data }) => setClients(data ?? []));
  }, []);

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    (async () => {
      const [{ data: post }, { data: appr }] = await Promise.all([
        supabase.from('social_posts').select('*').eq('id', id!).maybeSingle(),
        supabase.from('social_approvals').select('*').eq('post_id', id!).order('created_at', { ascending: false }),
      ]);
      if (post) setForm({
        ...post,
        hashtags: post.hashtags ?? [],
        scheduled_at: post.scheduled_at ? new Date(post.scheduled_at).toISOString().slice(0, 16) : '',
      });
      setApprovals(appr ?? []);
      setLoading(false);
    })();
  }, [id, isNew]);

  async function save(nextStatus?: string) {
    if (!form.client_id) return toast.error('Bitte Kunde wählen');
    setSaving(true);
    const payload: any = {
      client_id: form.client_id,
      platform: form.platform,
      title: form.title || null,
      body: form.body || null,
      hashtags: typeof form.hashtags === 'string' ? form.hashtags.split(/[\s,]+/).filter(Boolean) : form.hashtags,
      scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
      status: nextStatus ?? form.status,
      media_ids: form.media_ids ?? [],
    };
    const q = isNew
      ? supabase.from('social_posts').insert(payload).select('id').single()
      : supabase.from('social_posts').update(payload).eq('id', id!).select('id').single();
    const { data, error } = await q;
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(isNew ? 'Beitrag angelegt' : 'Gespeichert');
    if (isNew && data?.id) nav(`/social/beitrag/${data.id}`);
    else if (nextStatus) setForm({ ...form, status: nextStatus });
  }

  async function requestApproval() {
    if (isNew) { toast.error('Erst speichern'); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('social_approvals').insert({
      post_id: id!, requested_by: user.id, decision: 'pending', version: form.version ?? 1,
    });
    if (error) return toast.error(error.message);
    await save('pending_approval');
    const { data: appr } = await supabase.from('social_approvals').select('*').eq('post_id', id!).order('created_at', { ascending: false });
    setApprovals(appr ?? []);
    toast.success('Zur Freigabe gesendet');
  }

  if (loading) return <div className="p-6 text-muted-foreground">Lade…</div>;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{isNew ? 'Neuer Beitrag' : 'Beitrag bearbeiten'}</h1>
          {!isNew && <Badge variant="outline" className="mt-2">{form.status}</Badge>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => save()} disabled={saving}><Save className="mr-2 h-4 w-4" />Speichern</Button>
          {!isNew && form.status === 'draft' && <Button onClick={requestApproval}><Send className="mr-2 h-4 w-4" />Freigabe anfordern</Button>}
        </div>
      </div>

      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />KI-Assistent</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label>Idee / Prompt</Label>
          <Textarea rows={2} value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
            placeholder="z.B. Neues Produkt X, Fokus auf Premium-Qualität, Ton locker" />
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={aiCaption} disabled={aiBusy !== null}>
              {aiBusy === 'caption' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Text + Hashtags generieren
            </Button>
            <Button type="button" variant="outline" onClick={aiImage} disabled={aiBusy !== null}>
              {aiBusy === 'image' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
              Bild generieren & anhängen
            </Button>
          </div>
          {aiPreviews.length > 0 && (
            <div className="grid grid-cols-3 gap-2 pt-2">
              {aiPreviews.map((u, i) => (
                <img key={i} src={u} className="rounded-lg border border-border/50 aspect-square object-cover" alt="AI-generiert" />
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">Nutzt Marken-Kontext aus dem Marketing-Fragebogen.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Inhalt</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Kunde *</Label>
              <Select value={form.client_id} onValueChange={v => setForm({ ...form, client_id: v })}>
                <SelectTrigger><SelectValue placeholder="wählen…" /></SelectTrigger>
                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Plattform</Label>
              <Select value={form.platform} onValueChange={v => setForm({ ...form, platform: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PLATFORMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Titel</Label>
            <Input value={form.title ?? ''} onChange={e => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <Label>Text / Caption</Label>
            <Textarea rows={8} value={form.body ?? ''} onChange={e => setForm({ ...form, body: e.target.value })} />
            <div className="text-xs text-muted-foreground mt-1">{(form.body ?? '').length} Zeichen</div>
          </div>
          <div>
            <Label>Hashtags (Leerzeichen- oder Komma-getrennt)</Label>
            <Input
              value={Array.isArray(form.hashtags) ? form.hashtags.join(' ') : form.hashtags}
              onChange={e => setForm({ ...form, hashtags: e.target.value })}
              placeholder="#alix #premium"
            />
          </div>
          <div>
            <Label className="flex items-center gap-2"><CalIcon className="h-4 w-4" />Geplant für</Label>
            <Input type="datetime-local" value={form.scheduled_at ?? ''} onChange={e => setForm({ ...form, scheduled_at: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      {!isNew && approvals.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Freigabe-Verlauf</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {approvals.map(a => (
              <div key={a.id} className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                <div>
                  <div className="text-sm flex items-center gap-2">
                    {a.decision === 'approved' && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                    {a.decision === 'rejected' && <XCircle className="h-4 w-4 text-red-500" />}
                    <span className="font-medium capitalize">{a.decision}</span>
                    <span className="text-muted-foreground">v{a.version}</span>
                  </div>
                  {a.comment && <div className="text-xs text-muted-foreground mt-1">{a.comment}</div>}
                </div>
                <div className="text-xs text-muted-foreground">{new Date(a.decided_at ?? a.created_at).toLocaleString('de-DE')}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

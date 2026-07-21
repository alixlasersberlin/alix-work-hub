import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Video, Plus, Loader2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

type Meeting = {
  id: string; title: string; description: string | null; starts_at: string;
  status: string; room_code: string; host_user_id: string; ai_summary: string | null;
};

export default function Meetings() {
  const [rows, setRows] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [starts, setStarts] = useState(new Date(Date.now() + 15*60_000).toISOString().slice(0,16));
  const [saving, setSaving] = useState(false);
  const nav = useNavigate();

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from('ac_meetings').select('*').order('starts_at', { ascending: false }).limit(50);
    if (error) toast.error(error.message);
    setRows((data ?? []) as Meeting[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!title.trim()) { toast.error('Titel fehlt'); return; }
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { toast.error('Nicht eingeloggt'); setSaving(false); return; }
    const { data, error } = await supabase.from('ac_meetings').insert({
      title, description: desc || null, starts_at: new Date(starts).toISOString(),
      host_user_id: u.user.id, status: 'scheduled',
    }).select().single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    await supabase.from('ac_meeting_participants').insert({ meeting_id: (data as any).id, user_id: u.user.id, role: 'host', display_name: u.user.email });
    setOpen(false); setTitle(''); setDesc('');
    toast.success('Meeting angelegt');
    nav(`/connect/meetings/${(data as any).room_code}`);
  }

  return (
    <div className="p-6 space-y-4 h-full overflow-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><Video className="w-5 h-5 text-primary" /> Meetings</h2>
          <p className="text-xs text-muted-foreground">Video-Meetings mit WebRTC, Transkript & AI-Notes.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1.5" />Neues Meeting</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Neues Meeting</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Titel" value={title} onChange={(e) => setTitle(e.target.value)} />
              <Textarea placeholder="Beschreibung (optional)" value={desc} onChange={(e) => setDesc(e.target.value)} />
              <Input type="datetime-local" value={starts} onChange={(e) => setStarts(e.target.value)} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
              <Button onClick={create} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Anlegen & Starten'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin w-6 h-6 text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Noch keine Meetings.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {rows.map((m) => (
            <Card key={m.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-sm">{m.title}</CardTitle>
                    <p className="text-[11px] text-muted-foreground">{new Date(m.starts_at).toLocaleString('de-DE')} · Raum-Code <code className="font-mono">{m.room_code}</code></p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{m.status}</Badge>
                    <Link to={`/connect/meetings/${m.room_code}`}><Button size="sm" variant="secondary"><ExternalLink className="w-3.5 h-3.5 mr-1" />Öffnen</Button></Link>
                  </div>
                </div>
              </CardHeader>
              {(m.description || m.ai_summary) && (
                <CardContent className="text-sm space-y-2">
                  {m.description && <p className="text-muted-foreground">{m.description}</p>}
                  {m.ai_summary && (<div><p className="text-[11px] uppercase text-muted-foreground mb-0.5">AI-Zusammenfassung</p><p>{m.ai_summary}</p></div>)}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

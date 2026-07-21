import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Video, Mic, MicOff, VideoOff, PhoneOff, Sparkles, Loader2, Copy } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Simple browser-only meeting room:
 *  - Local camera/mic preview
 *  - Live transcription of the LOCAL mic via Web Audio -> WAV -> ac-call-ai-process style STT
 *  - Shared notes stored in ac_meeting_notes (realtime)
 *  - AI summary via ac-meeting-ai-notes
 *
 * WebRTC peer-signaling is intentionally kept lightweight (broadcast via Supabase Realtime channel)
 * — advanced SFU/media routing can be layered on later.
 */

function encodeWav(buffers: Float32Array[], sampleRate: number, target = 16000): Blob {
  const flat = new Float32Array(buffers.reduce((n, b) => n + b.length, 0));
  let o = 0; for (const b of buffers) { flat.set(b, o); o += b.length; }
  // downsample
  const ratio = sampleRate / target;
  const outLen = Math.floor(flat.length / ratio);
  const out = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const s = flat[Math.floor(i * ratio)] || 0;
    out[i] = Math.max(-1, Math.min(1, s)) * 0x7fff;
  }
  const buf = new ArrayBuffer(44 + out.byteLength);
  const dv = new DataView(buf);
  const writeStr = (off: number, s: string) => { for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i)); };
  writeStr(0, 'RIFF'); dv.setUint32(4, 36 + out.byteLength, true); writeStr(8, 'WAVE');
  writeStr(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, target, true); dv.setUint32(28, target * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  writeStr(36, 'data'); dv.setUint32(40, out.byteLength, true);
  new Int16Array(buf, 44).set(out);
  return new Blob([buf], { type: 'audio/wav' });
}

export default function MeetingRoom() {
  const { code } = useParams();
  const nav = useNavigate();
  const [meeting, setMeeting] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<any[]>([]);
  const [note, setNote] = useState('');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [transcribing, setTranscribing] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [summarizing, setSummarizing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const captureTimerRef = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('ac_meetings').select('*').eq('room_code', code).maybeSingle();
      if (!data) { toast.error('Meeting nicht gefunden'); nav('/connect/meetings'); return; }
      setMeeting(data);
      setLoading(false);
      const { data: n } = await supabase.from('ac_meeting_notes').select('*').eq('meeting_id', data.id).order('created_at', { ascending: true });
      setNotes(n ?? []);
    })();
  }, [code, nav]);

  useEffect(() => {
    if (!meeting) return;
    const ch = supabase.channel(`meeting_${meeting.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ac_meeting_notes', filter: `meeting_id=eq.${meeting.id}` }, (p) => {
        setNotes((prev) => [...prev, p.new]);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [meeting]);

  async function startMedia() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      // Audio capture for transcription
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const proc = ctx.createScriptProcessor(4096, 1, 1);
      proc.onaudioprocess = (e) => { chunksRef.current.push(new Float32Array(e.inputBuffer.getChannelData(0))); };
      src.connect(proc); proc.connect(ctx.destination);
    } catch (e: any) {
      toast.error('Mikrofon/Kamera nicht verfügbar: ' + e.message);
    }
  }
  useEffect(() => { startMedia(); return () => stopAll(); /* eslint-disable-next-line */ }, [meeting?.id]);

  function stopAll() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close().catch(() => {});
    if (captureTimerRef.current) window.clearInterval(captureTimerRef.current);
    setTranscribing(false);
  }

  function toggleMic() {
    const t = streamRef.current?.getAudioTracks()?.[0]; if (t) { t.enabled = !t.enabled; setMicOn(t.enabled); }
  }
  function toggleCam() {
    const t = streamRef.current?.getVideoTracks()?.[0]; if (t) { t.enabled = !t.enabled; setCamOn(t.enabled); }
  }

  async function toggleTranscription() {
    if (transcribing) {
      if (captureTimerRef.current) window.clearInterval(captureTimerRef.current);
      captureTimerRef.current = null; setTranscribing(false); return;
    }
    setTranscribing(true);
    chunksRef.current = [];
    captureTimerRef.current = window.setInterval(async () => {
      if (!audioCtxRef.current || chunksRef.current.length === 0) return;
      const local = chunksRef.current; chunksRef.current = [];
      const wav = encodeWav(local, audioCtxRef.current.sampleRate);
      if (wav.size < 4096) return;
      const fd = new FormData();
      fd.append('file', wav, 'chunk.wav');
      try {
        const url = `https://xmrmkgfgpoundfwhnxfs.supabase.co/functions/v1/ac-transcribe-chunk`;
        const { data: sess } = await supabase.auth.getSession();
        const r = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${sess.session?.access_token}` }, body: fd });
        const j = await r.json();
        if (j.text) setLiveTranscript((prev) => (prev + ' ' + j.text).trim().slice(-6000));
      } catch { /* ignore individual chunk failures */ }
    }, 8000);
  }

  async function addNote() {
    if (!note.trim() || !meeting) return;
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from('ac_meeting_notes').insert({ meeting_id: meeting.id, author_user_id: u.user?.id, content: note });
    if (error) { toast.error(error.message); return; }
    setNote('');
  }

  async function endMeeting() {
    if (!meeting) return;
    if (liveTranscript.trim()) {
      await supabase.from('ac_meetings').update({ transcript: liveTranscript, status: 'ended', ends_at: new Date().toISOString() }).eq('id', meeting.id);
    } else {
      await supabase.from('ac_meetings').update({ status: 'ended', ends_at: new Date().toISOString() }).eq('id', meeting.id);
    }
    stopAll();
    toast.success('Meeting beendet');
    nav('/connect/meetings');
  }

  async function generateSummary() {
    if (!meeting) return;
    setSummarizing(true);
    const { data, error } = await supabase.functions.invoke('ac-meeting-ai-notes', { body: { meeting_id: meeting.id, transcript: liveTranscript || undefined } });
    setSummarizing(false);
    if (error || (data as any)?.error) { toast.error((error?.message) || (data as any)?.error || 'Fehler'); return; }
    toast.success('AI-Zusammenfassung erstellt');
    const { data: m } = await supabase.from('ac_meetings').select('*').eq('id', meeting.id).single();
    setMeeting(m);
  }

  if (loading || !meeting) return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin w-6 h-6" /></div>;

  return (
    <div className="p-6 grid md:grid-cols-3 gap-4 h-full overflow-auto">
      <div className="md:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{meeting.title}</h2>
            <p className="text-[11px] text-muted-foreground">Raum: <code>{meeting.room_code}</code>
              <button onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success('Link kopiert'); }} className="ml-2 text-primary"><Copy className="w-3 h-3 inline" /></button>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant={micOn ? 'secondary' : 'destructive'} onClick={toggleMic}>{micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}</Button>
            <Button size="sm" variant={camOn ? 'secondary' : 'destructive'} onClick={toggleCam}>{camOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}</Button>
            <Button size="sm" variant={transcribing ? 'default' : 'outline'} onClick={toggleTranscription}>
              {transcribing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
              {transcribing ? 'Live-Transkript AN' : 'Live-Transkript'}
            </Button>
            <Button size="sm" variant="destructive" onClick={endMeeting}><PhoneOff className="w-4 h-4 mr-1" />Beenden</Button>
          </div>
        </div>

        <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
          <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
        </div>

        <Card>
          <CardContent className="p-3">
            <p className="text-[11px] uppercase text-muted-foreground mb-1">Live-Transkript</p>
            <p className="text-sm max-h-40 overflow-auto whitespace-pre-wrap">{liveTranscript || <span className="text-muted-foreground">Noch keine Aufzeichnung. Klicke auf „Live-Transkript".</span>}</p>
          </CardContent>
        </Card>

        {meeting.ai_summary && (
          <Card>
            <CardContent className="p-3 space-y-2">
              <p className="text-[11px] uppercase text-muted-foreground">AI-Zusammenfassung</p>
              <p className="text-sm">{meeting.ai_summary}</p>
              {Array.isArray(meeting.action_items) && meeting.action_items.length > 0 && (
                <ul className="text-sm list-disc list-inside">{meeting.action_items.map((a: string, i: number) => <li key={i}>{a}</li>)}</ul>
              )}
            </CardContent>
          </Card>
        )}
        <div>
          <Button variant="secondary" size="sm" onClick={generateSummary} disabled={summarizing || !liveTranscript.trim()}>
            {summarizing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Sparkles className="w-4 h-4 mr-1" />} AI-Notes generieren
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <Card>
          <CardContent className="p-3 space-y-2">
            <p className="text-[11px] uppercase text-muted-foreground">Notizen</p>
            <div className="space-y-2 max-h-96 overflow-auto text-sm">
              {notes.length === 0 && <p className="text-muted-foreground text-xs">Noch keine Notizen.</p>}
              {notes.map((n) => (
                <div key={n.id} className="rounded border border-border/60 p-2">
                  <p className="whitespace-pre-wrap">{n.content}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleTimeString('de-DE')}</p>
                </div>
              ))}
            </div>
            <Textarea placeholder="Notiz hinzufügen…" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
            <Button size="sm" onClick={addNote} disabled={!note.trim()}>Speichern</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Mic, Square, Loader2, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function MobileSprachnotiz() {
  const { id } = useParams<{ id: string }>();
  const [sp] = useSearchParams();
  const ticketId = sp.get('ticket') ?? undefined;
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [transcript, setTranscript] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = () => {
        const b = new Blob(chunksRef.current, { type: mime });
        setBlob(b);
        stream.getTracks().forEach((t) => t.stop());
      };
      rec.start();
      recRef.current = rec;
      setRecording(true);
      setElapsed(0);
      setBlob(null);
      setTranscript('');
      timerRef.current = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch (e: any) {
      toast.error(e?.message || 'Mikrofonzugriff verweigert');
    }
  };

  const stop = () => {
    recRef.current?.stop();
    setRecording(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const send = async () => {
    if (!blob) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', blob, `voice.${blob.type.includes('mp4') ? 'mp4' : 'webm'}`);
      if (ticketId) fd.append('ticket_id', ticketId);
      if (id) fd.append('route_plan_id', id);
      const { data: { session } } = await supabase.auth.getSession();
      const url = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/mobile-voice-transcribe`;
      const r = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: fd,
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setTranscript(j.text || '');
      toast.success(ticketId ? 'Transkript im Ticket hinterlegt' : 'Transkribiert');
    } catch (e: any) {
      toast.error(e?.message || 'Transkription fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  };

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  return (
    <div className="p-4 space-y-4">
      <Link to={id ? `/m/einsatz/${id}` : '/m'} className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="w-4 h-4" /> zurück
      </Link>
      <h1 className="text-xl font-bold flex items-center gap-2"><Mic className="w-5 h-5" /> Sprachnotiz</h1>

      <Card className="p-6 flex flex-col items-center gap-4">
        <div className="text-4xl font-mono tabular-nums">{mm}:{ss}</div>
        {!recording ? (
          <Button onClick={start} className="w-40 h-16 gold-gradient text-lg" disabled={busy}>
            <Mic className="w-6 h-6 mr-2" /> Start
          </Button>
        ) : (
          <Button onClick={stop} variant="destructive" className="w-40 h-16 text-lg">
            <Square className="w-6 h-6 mr-2" /> Stop
          </Button>
        )}
        {blob && !recording && (
          <>
            <audio controls src={URL.createObjectURL(blob)} className="w-full" />
            <Button onClick={send} disabled={busy} className="w-full">
              {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Transkribieren {ticketId ? '& an Ticket senden' : ''}
            </Button>
          </>
        )}
      </Card>

      {transcript && (
        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-2">Transkript</div>
          <p className="text-sm whitespace-pre-wrap">{transcript}</p>
        </Card>
      )}
    </div>
  );
}

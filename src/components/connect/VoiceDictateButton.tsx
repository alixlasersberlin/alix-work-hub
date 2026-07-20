import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Diktier-Button für ALIX CONNECT: nimmt Sprache über das Mikro auf,
 * schickt sie an die Edge Function `mobile-voice-transcribe`
 * (Lovable AI Gateway STT) und übergibt das Transkript per onTranscript.
 */
export function VoiceDictateButton({
  onTranscript,
  disabled,
  className,
}: {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "recording" | "processing">("idle");
  const [seconds, setSeconds] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => stopTimer(), []);

  function startTimer() {
    stopTimer();
    setSeconds(0);
    timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
  }
  function stopTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  async function start() {
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      toast.error("Aufnahme in diesem Browser nicht unterstützt");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        if (blob.size < 1500) { setState("idle"); toast.error("Aufnahme zu kurz"); return; }
        setState("processing");
        try {
          const fd = new FormData();
          fd.append("file", blob, "voice.webm");
          const { data: sess } = await supabase.auth.getSession();
          const token = sess.session?.access_token;
          const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mobile-voice-transcribe`;
          const res = await fetch(url, {
            method: "POST",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: fd,
          });
          const j = await res.json().catch(() => ({}));
          if (!res.ok) {
            if (res.status === 402) toast.error("KI-Guthaben erschöpft");
            else if (res.status === 429) toast.error("Zu viele Anfragen, kurz warten");
            else toast.error(j?.error || `Transkription fehlgeschlagen (${res.status})`);
          } else if (j?.text) {
            onTranscript(String(j.text).trim());
            toast.success("Transkribiert");
          } else {
            toast.error("Leere Transkription");
          }
        } finally {
          setState("idle");
        }
      };
      recRef.current = rec;
      rec.start();
      setState("recording");
      startTimer();
    } catch (e: any) {
      toast.error(e?.message || "Mikrofon-Zugriff verweigert");
    }
  }
  function stop() {
    stopTimer();
    try { recRef.current?.stop(); } catch { /* noop */ }
  }

  const busy = state === "processing";
  return (
    <Button
      type="button"
      variant={state === "recording" ? "destructive" : "outline"}
      size="icon"
      disabled={disabled || busy}
      onClick={state === "recording" ? stop : start}
      title={state === "recording" ? `Aufnahme läuft (${seconds}s) – klicken zum Stoppen` : "Sprachnotiz diktieren"}
      className={cn("h-9 w-9", className)}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : state === "recording" ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
    </Button>
  );
}

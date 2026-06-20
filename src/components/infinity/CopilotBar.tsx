import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/contexts/TenantContext";
import { Sparkles, X, Send, Loader2, MessageSquareMore, Wrench } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string; trace?: { name: string; args: any }[] };

export function CopilotBar() {
  const { user } = useAuth();
  const { sourceFilter } = useTenant();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Hotkey: Cmd/Ctrl + J
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (scrollerRef.current) scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [msgs, busy]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content: text }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("alix-copilot", {
        body: {
          messages: next.map(m => ({ role: m.role, content: m.content })),
          page: location.pathname,
          tenantSources: sourceFilter,
        },
      });
      if (error) throw error;
      const content = (data as any)?.content || (data as any)?.error || "Keine Antwort erhalten.";
      const trace = (data as any)?.tool_trace ?? [];
      setMsgs(m => [...m, { role: "assistant", content, trace }]);
    } catch (e: any) {
      setMsgs(m => [...m, { role: "assistant", content: `Fehler: ${e?.message || "Anfrage fehlgeschlagen."}` }]);
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;

  return (
    <>
      {/* Floating Trigger */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="ALIX Copilot öffnen (Strg+J)"
          className="fixed bottom-3 right-3 z-[60] group flex items-center gap-2 rounded-full border border-amber-400/30 bg-black/70 backdrop-blur px-3 py-2 shadow-[0_10px_40px_-10px_rgba(245,158,11,0.5)] hover:border-amber-400/60 transition print:hidden"
        >
          <Sparkles className="h-4 w-4 text-amber-300 group-hover:rotate-12 transition" />
          <span className="text-sm font-medium sig-mark">ALIX Copilot</span>
          <kbd className="hidden sm:inline-block text-[10px] text-muted-foreground border border-white/15 rounded px-1.5 py-0.5">⌘J</kbd>
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-3 right-3 z-[60] w-[min(420px,calc(100vw-1.5rem))] max-h-[min(640px,calc(100vh-1.5rem))] flex flex-col overflow-hidden rounded-2xl border border-amber-400/25 bg-black/85 backdrop-blur-xl shadow-[0_40px_80px_-20px_rgba(0,0,0,0.9)] print:hidden">
          <div className="relative border-b border-white/10 px-4 py-3 flex items-center justify-between"
            style={{ background: "linear-gradient(90deg, hsl(38 90% 55% / 0.10), transparent 60%)" }}>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-300" />
              <div className="font-semibold sig-mark">ALIX Copilot</div>
              <span className="text-[10px] uppercase tracking-widest text-amber-300/60">Beta</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground" aria-label="Schließen">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={scrollerRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-sm">
            {msgs.length === 0 && (
              <div className="text-muted-foreground space-y-3">
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-amber-300/70">
                  <MessageSquareMore className="h-3 w-3" /> Vorschläge
                </div>
                {[
                  "Wie sind die offenen Tickets verteilt?",
                  "Welche Module gibt es im Finance-Bereich?",
                  "Erkläre den Genehmigungs-Workflow für Production-Bestellungen.",
                  "Was bedeutet ein -AT-Suffix bei Aufträgen?",
                ].map((s) => (
                  <button key={s} onClick={() => setInput(s)}
                    className="block w-full text-left rounded-lg border border-white/10 bg-white/5 hover:border-amber-400/40 hover:bg-amber-500/5 px-3 py-2 text-xs transition">
                    {s}
                  </button>
                ))}
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                <div className={`rounded-2xl px-3 py-2 max-w-[85%] whitespace-pre-wrap leading-relaxed ${
                  m.role === "user"
                    ? "bg-amber-500/15 border border-amber-400/30 text-amber-50"
                    : "bg-white/5 border border-white/10 text-foreground"
                }`}>
                  {m.content}
                </div>
                {m.trace && m.trace.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1 max-w-[85%]">
                    {m.trace.map((t, ti) => (
                      <span key={ti} className="inline-flex items-center gap-1 text-[10px] text-amber-200/70 border border-amber-400/20 rounded px-1.5 py-0.5 bg-amber-500/5">
                        <Wrench className="h-2.5 w-2.5" />{t.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="rounded-2xl px-3 py-2 bg-white/5 border border-white/10 flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> ALIX denkt nach …
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-white/10 p-2.5 flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
              }}
              placeholder="Frag ALIX … (Enter zum Senden, Shift+Enter = Zeile)"
              rows={1}
              className="flex-1 resize-none rounded-lg bg-black/50 border border-white/10 focus:border-amber-400/50 focus:outline-none px-3 py-2 text-sm max-h-32"
            />
            <button
              onClick={send}
              disabled={busy || !input.trim()}
              className="rounded-lg p-2 bg-gradient-to-br from-amber-400 to-amber-600 text-black disabled:opacity-40 hover:brightness-110"
              aria-label="Senden"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

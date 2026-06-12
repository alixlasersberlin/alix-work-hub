import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useUiTemplate } from "@/hooks/useUiTemplate";
import { Sparkles, Check } from "lucide-react";

/** Schwebender Live-Switch für das Design-Template (sichtbar in jeder Seite). */
export default function TemplateSwitcher() {
  const { template, setTemplate } = useUiTemplate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  // Mobile-Bereich (/m/*) ist fest auf NEO — kein Switcher.
  if (pathname === "/m" || pathname.startsWith("/m/")) return null;
  // Öffentliche Beratungsseite ist fest auf Standard — kein Switcher.
  if (pathname === "/beratung" || pathname.startsWith("/beratung/")) return null;
  if (typeof document !== "undefined" && document.documentElement.getAttribute("data-lock-template")) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[100] print:hidden">
      {open && (
        <div className="mb-2 w-64 rounded-2xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl p-3 space-y-2 animate-in fade-in slide-in-from-bottom-2">
          <div className="text-xs font-semibold text-muted-foreground px-1">Design-Template</div>
          {([
            { id: "standard", label: "Standard", hint: "Black / Gold" },
            { id: "neo", label: "ALIXWORK NEO", hint: "Glassmorphism · Aurora" },
          ] as const).map((opt) => (
            <button
              key={opt.id}
              onClick={() => { setTemplate(opt.id); setOpen(false); }}
              className={`w-full text-left rounded-xl p-2 border transition flex items-center justify-between ${
                template === opt.id
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50 hover:bg-muted/40"
              }`}
            >
              <div>
                <div className="text-sm font-medium">{opt.label}</div>
                <div className="text-[11px] text-muted-foreground">{opt.hint}</div>
              </div>
              {template === opt.id && <Check className="h-4 w-4 text-primary" />}
            </button>
          ))}
          <a
            href="/design-template"
            className="block text-center text-[11px] text-muted-foreground hover:text-primary pt-1"
          >
            Vorschau &amp; Details öffnen →
          </a>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        title="Design-Template wechseln"
        className="h-12 w-12 rounded-full border border-border bg-card/90 backdrop-blur-xl shadow-xl flex items-center justify-center hover:scale-105 transition relative"
        style={{
          backgroundImage: template === "neo"
            ? "linear-gradient(135deg, hsl(217 91% 60% / .9), hsl(188 94% 43% / .9))"
            : undefined,
        }}
      >
        <Sparkles className={`h-5 w-5 ${template === "neo" ? "text-white" : "text-primary"}`} />
        <span className="absolute -top-1 -right-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-background border border-border">
          {template === "neo" ? "NEO" : "STD"}
        </span>
      </button>
    </div>
  );
}

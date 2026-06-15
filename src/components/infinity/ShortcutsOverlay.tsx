import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Keyboard, Command } from "lucide-react";

type Shortcut = { keys: string[]; label: string };
type Group = { title: string; items: Shortcut[] };

const GROUPS: Group[] = [
  {
    title: "Navigation",
    items: [
      { keys: ["⌘", "K"], label: "Globale Suche / Command Palette" },
      { keys: ["⌘", "J"], label: "AI Copilot ein-/ausblenden" },
      { keys: ["G", "D"], label: "Dashboard öffnen" },
      { keys: ["G", "O"], label: "Aufträge öffnen" },
      { keys: ["G", "C"], label: "Kunden öffnen" },
      { keys: ["G", "F"], label: "Finance öffnen" },
    ],
  },
  {
    title: "Aktionen",
    items: [
      { keys: ["N"], label: "Neuer Eintrag (kontextabhängig)" },
      { keys: ["E"], label: "Bearbeiten" },
      { keys: ["⌘", "S"], label: "Speichern" },
      { keys: ["Esc"], label: "Schließen / Abbrechen" },
      { keys: ["/"], label: "Suchfeld fokussieren" },
    ],
  },
  {
    title: "Tabellen",
    items: [
      { keys: ["↑", "↓"], label: "Zeile auswählen" },
      { keys: ["Enter"], label: "Zeile öffnen" },
      { keys: ["⌘", "A"], label: "Alle markieren" },
      { keys: ["⌘", "E"], label: "CSV exportieren" },
    ],
  },
  {
    title: "System",
    items: [
      { keys: ["?"], label: "Diese Übersicht" },
      { keys: ["⌘", "."], label: "Theme wechseln" },
      { keys: ["⌘", "Shift", "L"], label: "Abmelden" },
    ],
  },
];

const Key = ({ k }: { k: string }) => (
  <kbd className="inline-grid place-items-center min-w-[26px] h-7 px-2 rounded-md border border-amber-500/30 bg-gradient-to-b from-amber-500/10 to-transparent text-[11px] font-semibold text-amber-100 shadow-[inset_0_-2px_0_rgba(0,0,0,0.4)]">
    {k === "⌘" ? <Command className="h-3 w-3" /> : k}
  </kbd>
);

export const ShortcutsOverlay = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-3xl border-amber-500/20 bg-background/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-100">
            <Keyboard className="h-5 w-5 text-amber-400" />
            Tastenkürzel
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              <kbd className="px-1.5 py-0.5 rounded border border-amber-500/30 text-amber-200">?</kbd>{" "}
              zum Ein-/Ausblenden
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
          {GROUPS.map((g) => (
            <div key={g.title} className="space-y-2">
              <h3 className="text-[11px] uppercase tracking-[0.18em] font-semibold text-amber-400/80 border-b border-amber-500/10 pb-1.5">
                {g.title}
              </h3>
              <ul className="space-y-1.5">
                {g.items.map((s) => (
                  <li
                    key={s.label}
                    className="flex items-center justify-between gap-3 px-2 py-1.5 rounded-lg hover:bg-amber-500/5"
                  >
                    <span className="text-sm text-foreground/85">{s.label}</span>
                    <span className="flex items-center gap-1 shrink-0">
                      {s.keys.map((k, i) => (
                        <span key={i} className="flex items-center gap-1">
                          {i > 0 && <span className="text-[10px] text-muted-foreground">+</span>}
                          <Key k={k} />
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-muted-foreground mt-4 text-center">
          Auf Windows/Linux entspricht <Key k="⌘" /> der <Key k="Strg" />-Taste.
        </p>
      </DialogContent>
    </Dialog>
  );
};

export default ShortcutsOverlay;

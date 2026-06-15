import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUiTemplate, type UiTemplate } from "@/hooks/useUiTemplate";
import { useInfinityTheme, INFINITY_THEMES, type InfinityTheme } from "@/hooks/useInfinityTheme";
import { Sparkles, Layers, Check, Infinity as InfinityIcon } from "lucide-react";
import { A11yPrefsPanel } from "@/components/infinity/A11yPrefsPanel";
import { AIBackgroundPanel } from "@/components/infinity/AIBackgroundPanel";
import { PageHeader } from "@/components/infinity/PageHeader";

const OPTIONS: { id: UiTemplate; name: string; description: string; preview: React.ReactNode }[] = [
  {
    id: "standard",
    name: "Standard (Black / Gold)",
    description: "Aktuelles Premium-Enterprise-Layout. Hohe Informationsdichte, klassische Sidebar, klare Tabellen.",
    preview: (
      <div className="h-32 rounded-lg bg-[#0a0a0a] border border-yellow-500/30 flex">
        <div className="w-12 border-r border-yellow-500/20 bg-black/60" />
        <div className="flex-1 p-2 space-y-1">
          <div className="h-3 w-24 rounded bg-yellow-500/40" />
          <div className="h-2 w-40 rounded bg-white/20" />
          <div className="h-2 w-32 rounded bg-white/10" />
          <div className="h-2 w-44 rounded bg-white/10" />
        </div>
      </div>
    ),
  },
  {
    id: "neo",
    name: "ALIXWORK NEO",
    description: "Premium Glassmorphism SaaS 2026: Aurora-Gradients, schwebende Sidebar, Glass-Cards, AI-Branding.",
    preview: (
      <div className="relative h-32 rounded-lg overflow-hidden border border-blue-400/30" style={{
        background:
          "radial-gradient(40% 60% at 20% 30%, #3B82F6 0%, transparent 60%), radial-gradient(40% 60% at 80% 70%, #06B6D4 0%, transparent 60%), #09090B",
      }}>
        <div className="absolute inset-2 flex gap-2">
          <div className="w-10 rounded-2xl border border-white/15 bg-white/5 backdrop-blur" />
          <div className="flex-1 space-y-2">
            <div className="h-6 rounded-xl border border-white/15 bg-white/5 backdrop-blur" />
            <div className="grid grid-cols-3 gap-2">
              <div className="h-12 rounded-xl border border-white/15 bg-white/5 backdrop-blur" />
              <div className="h-12 rounded-xl border border-white/15 bg-white/5 backdrop-blur" />
              <div className="h-12 rounded-xl border border-white/15 bg-white/5 backdrop-blur" />
            </div>
          </div>
        </div>
      </div>
    ),
  },
];

export default function DesignTemplate() {
  const { template, setTemplate } = useUiTemplate();
  const { theme: infinityTheme, setTheme: setInfinityTheme } = useInfinityTheme();

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <PageHeader
        icon={Layers}
        title="Design-Template"
        subtitle="Wähle das visuelle Erscheinungsbild von AlixWork. Die Umschaltung erfolgt sofort und ohne Neuladen. Alle Funktionen und Daten bleiben identisch."
        noBreadcrumbs
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {OPTIONS.map((opt) => {
          const active = template === opt.id;
          return (
            <Card key={opt.id} className={active ? "ring-2 ring-primary" : ""}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    {opt.id === "neo" && <Sparkles className="h-4 w-4 text-primary" />}
                    {opt.name}
                  </CardTitle>
                  {active && <Badge variant="outline" className="gap-1"><Check className="h-3 w-3" /> Aktiv</Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {opt.preview}
                <p className="text-sm text-muted-foreground">{opt.description}</p>
                <Button
                  className="w-full"
                  variant={active ? "outline" : "default"}
                  onClick={() => setTemplate(opt.id)}
                  disabled={active}
                >
                  {active ? "Aktuell aktiviert" : `${opt.name} aktivieren`}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <InfinityIcon className="h-5 w-5 text-primary" />
            ALIXSMART INFINITY OS™ — Theme Gallery
            <Badge variant="outline" className="ml-2">Phase I-1</Badge>
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Zusätzliche Theme-Schicht über Aurora. Aktivierung sofort, ohne Neuladen. Aurora & Standard bleiben unverändert.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {INFINITY_THEMES.map((opt) => {
              const active = infinityTheme === opt.id;
              return (
                <div
                  key={opt.id}
                  className={`rounded-xl border p-4 transition ${active ? "ring-2 ring-primary border-primary/40" : "border-border hover:border-primary/30"}`}
                >
                  <InfinityPreview id={opt.id} />
                  <div className="mt-3 flex items-center justify-between">
                    <div className="font-semibold">{opt.name}</div>
                    {active && <Badge variant="outline" className="gap-1"><Check className="h-3 w-3" /> Aktiv</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 min-h-[2.5rem]">{opt.description}</p>
                  <Button
                    size="sm"
                    className="w-full mt-3"
                    variant={active ? "outline" : "default"}
                    onClick={() => setInfinityTheme(opt.id)}
                    disabled={active}
                  >
                    {active ? "Aktiv" : "Aktivieren"}
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <A11yPrefsPanel />
      <AIBackgroundPanel />

      <Card>
        <CardHeader><CardTitle>Hinweise</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>• Die Auswahl wird im Browser gespeichert und gilt geräteweit.</p>
          <p>• Bestehende Funktionen, Daten und Berechtigungen sind in beiden Templates identisch.</p>
          <p>• <strong>ALIXWORK NEO</strong> nutzt Aurora-Gradients, Glassmorphism-Karten, schwebende Sidebar &amp; Header, Electric-Blue/Cyan-Akzente und sanfte Hover-Animationen.</p>
          <p>• <strong>Infinity Themes</strong> liegen als zusätzliche Schicht darüber und sind jederzeit auf <em>Aurora pur</em> zurücksetzbar.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function InfinityPreview({ id }: { id: InfinityTheme }) {
  const styles: Record<InfinityTheme, React.CSSProperties> = {
    "off": {
      background: "linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)",
    },
    "infinity-glass": {
      background:
        "radial-gradient(60% 50% at 20% 10%, rgba(56,189,248,0.25), transparent 70%), radial-gradient(50% 40% at 90% 90%, rgba(167,139,250,0.20), transparent 70%), #0b1220",
    },
    "infinity-neon": {
      background:
        "radial-gradient(40% 30% at 25% 25%, rgba(34,211,238,0.45), transparent 70%), radial-gradient(40% 30% at 80% 80%, rgba(244,114,182,0.40), transparent 70%), #050814",
    },
    "infinity-executive": {
      background:
        "radial-gradient(70% 50% at 50% 0%, rgba(212,175,55,0.25), transparent 70%), linear-gradient(180deg, #0a0a0a 0%, #050505 100%)",
    },
    "infinity-signature": {
      background:
        "radial-gradient(50% 35% at 10% 0%, rgba(56,189,248,0.20), transparent 70%), radial-gradient(45% 30% at 90% 100%, rgba(234,179,8,0.22), transparent 70%), #0a0a0f",
    },
  };
  return (
    <div className="h-24 rounded-lg overflow-hidden border border-white/10" style={styles[id]}>
      <div className="h-full w-full p-2 flex flex-col justify-between">
        <div className="h-2 w-20 rounded bg-white/30" />
        <div className="grid grid-cols-3 gap-1">
          <div className="h-6 rounded bg-white/10 backdrop-blur-sm" />
          <div className="h-6 rounded bg-white/10 backdrop-blur-sm" />
          <div className="h-6 rounded bg-white/10 backdrop-blur-sm" />
        </div>
      </div>
    </div>
  );
}

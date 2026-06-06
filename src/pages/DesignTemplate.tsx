import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUiTemplate, type UiTemplate } from "@/hooks/useUiTemplate";
import { useDesignVariant, type DesignVariant } from "@/hooks/useDesignVariant";
import { Sparkles, Layers, Check, Monitor, Wand2 } from "lucide-react";

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

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Layers className="h-7 w-7 text-primary" /> Design-Template
        </h1>
        <p className="text-muted-foreground mt-1">
          Wähle das visuelle Erscheinungsbild von AlixWork. Die Umschaltung erfolgt sofort und ohne Neuladen.
          Alle Funktionen und Daten bleiben identisch.
        </p>
      </div>

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
        <CardHeader><CardTitle>Hinweise</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>• Die Auswahl wird im Browser gespeichert und gilt geräteweit.</p>
          <p>• Bestehende Funktionen, Daten und Berechtigungen sind in beiden Templates identisch.</p>
          <p>• <strong>ALIXWORK NEO</strong> nutzt Aurora-Gradients, Glassmorphism-Karten, schwebende Sidebar &amp; Header, Electric-Blue/Cyan-Akzente und sanfte Hover-Animationen.</p>
        </CardContent>
      </Card>
    </div>
  );
}

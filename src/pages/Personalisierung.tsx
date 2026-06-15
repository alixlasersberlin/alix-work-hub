import { Palette, Eye, Sparkles, Zap, Keyboard } from "lucide-react";
import { PageHeader } from "@/components/infinity/PageHeader";
import { A11yPrefsPanel } from "@/components/infinity/A11yPrefsPanel";
import { AIBackgroundPanel } from "@/components/infinity/AIBackgroundPanel";
import { usePageFade } from "@/hooks/usePageFade";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const Card = ({
  icon: Icon,
  title,
  desc,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  children: React.ReactNode;
}) => (
  <div className="rounded-2xl border border-amber-500/15 bg-gradient-to-br from-amber-500/[0.04] to-transparent backdrop-blur p-5 space-y-3">
    <div className="flex items-start gap-3">
      <div className="grid place-items-center h-10 w-10 rounded-xl border border-amber-500/25 bg-amber-500/10">
        <Icon className="h-4 w-4 text-amber-300" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
    </div>
    <div>{children}</div>
  </div>
);

const PageFadeToggle = () => {
  const { on, setOn } = usePageFade();
  return (
    <div className="flex items-center justify-between pt-1">
      <Label htmlFor="page-fade" className="text-sm">Seitenwechsel-Fade</Label>
      <Switch id="page-fade" checked={on} onCheckedChange={setOn} />
    </div>
  );
};

export default function Personalisierung() {
  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <PageHeader
        title="Personalisierung"
        subtitle="Passe Aussehen, Bewegung und Komfort der gesamten App an deine Vorlieben an. Alle Einstellungen werden lokal gespeichert."
        icon={Palette}
        actions={
          <Button asChild variant="outline">
            <Link to="/infinity-showcase">
              <Sparkles className="h-4 w-4 mr-2" />
              Showcase
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* A11y */}
        <div className="md:col-span-2">
          <A11yPrefsPanel />
        </div>

        {/* AI Background */}
        <AIBackgroundPanel />

        {/* Bewegung */}
        <Card
          icon={Zap}
          title="Bewegung & Übergänge"
          desc='Sanfte Animationen bei Seitenwechseln. Deaktiviert sich bei „Reduzierte Bewegung" automatisch.'
        >
          <PageFadeToggle />
        </Card>

        {/* Shortcuts */}
        <Card
          icon={Keyboard}
          title="Tastenkürzel"
          desc="Übersicht aller globalen Shortcuts mit ⌘K, ⌘J und mehr."
        >
          <p className="text-xs text-muted-foreground">
            Drücke{" "}
            <kbd className="px-1.5 py-0.5 rounded border border-amber-500/30 text-amber-200 text-[10px]">?</kbd>{" "}
            irgendwo in der App, um die Cheatsheet einzublenden.
          </p>
        </Card>

        {/* Vorschau */}
        <Card
          icon={Eye}
          title="Komponenten-Vorschau"
          desc="Alle Premium-Komponenten an einem Ort: KPI-Kacheln, Tabellen, Status-Badges, Skeletons."
        >
          <Button asChild className="w-full bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold">
            <Link to="/infinity-showcase">Showcase öffnen</Link>
          </Button>
        </Card>
      </div>
    </div>
  );
}

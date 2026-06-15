import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accessibility, RotateCcw } from "lucide-react";
import { useA11yPrefs } from "@/hooks/useA11yPrefs";

const SCALES: { v: 100 | 110 | 125 | 150; label: string }[] = [
  { v: 100, label: "100 %" },
  { v: 110, label: "110 %" },
  { v: 125, label: "125 %" },
  { v: 150, label: "150 %" },
];

export function A11yPrefsPanel() {
  const { prefs, update, reset } = useA11yPrefs();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Accessibility className="h-5 w-5 text-primary" />
          Accessibility Pro
          <Badge variant="outline" className="ml-2">Phase I-11</Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-2">
          Persönliche Barrierefreiheits-Einstellungen. Wirkt sofort und systemweit, ohne Neuladen.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Kontrast */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="a11y-contrast" className="text-sm font-medium">Hoher Kontrast</Label>
            <p className="text-xs text-muted-foreground">Schwarz/Gelb-Schema mit verstärkten Rändern.</p>
          </div>
          <Switch
            id="a11y-contrast"
            checked={prefs.highContrast}
            onCheckedChange={(v) => update({ highContrast: v })}
          />
        </div>

        {/* Bewegung */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label className="text-sm font-medium">Bewegung reduzieren</Label>
            <p className="text-xs text-muted-foreground">Deaktiviert Animationen, Lichtspuren & Übergänge.</p>
          </div>
          <div className="inline-flex rounded-lg border border-border overflow-hidden">
            {(["auto", "on", "off"] as const).map((v) => (
              <button
                key={v}
                onClick={() => update({ reducedMotion: v })}
                className={`px-3 py-1.5 text-xs ${prefs.reducedMotion === v ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
              >
                {v === "auto" ? "Auto (System)" : v === "on" ? "An" : "Aus"}
              </button>
            ))}
          </div>
        </div>

        {/* Schriftgröße */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label className="text-sm font-medium">Schriftgröße</Label>
            <p className="text-xs text-muted-foreground">Skaliert die gesamte Oberfläche.</p>
          </div>
          <div className="inline-flex rounded-lg border border-border overflow-hidden">
            {SCALES.map((s) => (
              <button
                key={s.v}
                onClick={() => update({ textScale: s.v })}
                className={`px-3 py-1.5 text-xs ${prefs.textScale === s.v ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Fokus-Ring */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label className="text-sm font-medium">Fokus-Ring</Label>
            <p className="text-xs text-muted-foreground">Hebt das aktuell fokussierte Element deutlicher hervor.</p>
          </div>
          <div className="inline-flex rounded-lg border border-border overflow-hidden">
            {(["default", "bold"] as const).map((v) => (
              <button
                key={v}
                onClick={() => update({ focusRing: v })}
                className={`px-3 py-1.5 text-xs ${prefs.focusRing === v ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
              >
                {v === "default" ? "Standard" : "Verstärkt"}
              </button>
            ))}
          </div>
        </div>

        {/* Links unterstreichen */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="a11y-underline" className="text-sm font-medium">Links unterstreichen</Label>
            <p className="text-xs text-muted-foreground">Hilfreich bei Farbschwäche.</p>
          </div>
          <Switch
            id="a11y-underline"
            checked={prefs.underlineLinks}
            onCheckedChange={(v) => update({ underlineLinks: v })}
          />
        </div>

        <div className="pt-2 border-t border-border flex justify-end">
          <Button variant="outline" size="sm" onClick={reset} className="gap-1">
            <RotateCcw className="h-3.5 w-3.5" />
            Auf Standard zurücksetzen
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

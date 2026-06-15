import { useAIBackground } from "@/hooks/useAIBackground";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Sparkles } from "lucide-react";

export const AIBackgroundPanel = () => {
  const { on, setOn } = useAIBackground();
  return (
    <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-amber-400" />
        <h3 className="text-sm font-semibold text-amber-100">AI Background Engine</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Generativer Hintergrund mit weichen Farbfeldern, der sich an die Tageszeit anpasst. Wird bei
        „Reduzierte Bewegung" automatisch deaktiviert.
      </p>
      <div className="flex items-center justify-between pt-1">
        <Label htmlFor="ai-bg" className="text-sm">Aktivieren</Label>
        <Switch id="ai-bg" checked={on} onCheckedChange={setOn} />
      </div>
    </div>
  );
};

export default AIBackgroundPanel;

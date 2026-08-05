import { Minus, Plus, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMenuScale, MENU_SCALE_STEP, MENU_SCALE_MIN, MENU_SCALE_MAX } from '@/hooks/useUiPrefs';

/** Kleine Steuerung zum Ändern der Menü-/Schriftgröße in der Sidebar. */
export default function MenuScaleControl({ compact }: { compact?: boolean }) {
  const { scale, setScale } = useMenuScale();

  return (
    <div className="flex items-center gap-0.5" title="Menü-/Schriftgröße anpassen">
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-foreground"
        onClick={() => setScale(scale - MENU_SCALE_STEP)}
        disabled={scale <= MENU_SCALE_MIN}
        aria-label="Schrift kleiner"
      >
        <Minus className="w-3.5 h-3.5" />
      </Button>
      {!compact && (
        <span className="text-[11px] tabular-nums text-muted-foreground w-8 text-center">
          {Math.round(scale * 100)}%
        </span>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-foreground"
        onClick={() => setScale(scale + MENU_SCALE_STEP)}
        disabled={scale >= MENU_SCALE_MAX}
        aria-label="Schrift größer"
      >
        <Plus className="w-3.5 h-3.5" />
      </Button>
      {!compact && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={() => setScale(1)}
          disabled={scale === 1}
          aria-label="Größe zurücksetzen"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  );
}

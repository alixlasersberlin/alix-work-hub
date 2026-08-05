import { PanelLeftClose, Type } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import MenuScaleControl from '@/components/MenuScaleControl';
import { useUiPrefs } from '@/hooks/useUiPrefs';

/** Persönliche Menü- und Sidebar-Einstellungen (pro Benutzer in Supabase gespeichert). */
export default function UiPrefsPanel() {
  const { menuScale, sidebarCollapsed, sidebarAutoCollapse, setMenuScale, setSidebarCollapsed, setSidebarAutoCollapse } =
    useUiPrefs();

  return (
    <div className="rounded-2xl border border-amber-500/15 bg-gradient-to-br from-amber-500/[0.04] to-transparent backdrop-blur p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="grid place-items-center h-10 w-10 rounded-xl border border-amber-500/25 bg-amber-500/10">
          <Type className="h-4 w-4 text-amber-300" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold">Menü & Sidebar</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Schriftgröße und Verhalten der Navigation — wird pro Benutzer gespeichert.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-3 py-2.5">
        <div className="min-w-0">
          <div className="text-sm">Menü-/Schriftgröße</div>
          <div className="text-xs text-muted-foreground">{Math.round(menuScale * 100)} %</div>
        </div>
        <div className="flex items-center gap-2">
          <MenuScaleControl />
          <Button variant="outline" size="sm" onClick={() => setMenuScale(1)} disabled={menuScale === 1}>
            Standard
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-3 py-2.5">
        <div className="min-w-0">
          <div className="text-sm flex items-center gap-2">
            <PanelLeftClose className="h-3.5 w-3.5 text-muted-foreground" />
            Sidebar eingeklappt
          </div>
          <div className="text-xs text-muted-foreground">Navigation dauerhaft schmal anzeigen.</div>
        </div>
        <Switch checked={sidebarCollapsed} onCheckedChange={setSidebarCollapsed} />
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-3 py-2.5">
        <div className="min-w-0">
          <div className="text-sm">Auto-Einklappen</div>
          <div className="text-xs text-muted-foreground">
            Menü bleibt schmal und öffnet sich automatisch bei Mauskontakt.
          </div>
        </div>
        <Switch checked={sidebarAutoCollapse} onCheckedChange={setSidebarAutoCollapse} />
      </div>
    </div>
  );
}

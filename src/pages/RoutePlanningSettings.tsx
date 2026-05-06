import { Settings } from 'lucide-react';

export default function RoutePlanningSettings() {
  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
          <Settings className="w-6 h-6 text-primary" />
          Tourenplanung – Einstellungen
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Konfiguration der Tourenplanung.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card card-glow p-8 text-center">
        <p className="text-muted-foreground">Hier können zukünftig Einstellungen für die Tourenplanung verwaltet werden.</p>
      </div>
    </div>
  );
}

import { Wrench } from 'lucide-react';

export default function Reparaturannahme() {
  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <Wrench className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-display font-bold text-foreground">Reparaturannahme</h1>
      </div>
      <div className="rounded-xl border border-border bg-card p-8 card-glow text-center text-muted-foreground">
        Dieses Modul wird in Kürze verfügbar sein.
      </div>
    </div>
  );
}

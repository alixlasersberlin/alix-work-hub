import { ShieldCheck } from 'lucide-react';

export default function MdrCe() {
  return (
    <div className="container max-w-5xl py-6 space-y-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="w-7 h-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">MDR CE</h1>
          <p className="text-sm text-muted-foreground">
            Medical Device Regulation – CE-Konformität.
          </p>
        </div>
      </div>
      <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
        Dieser Bereich befindet sich im Aufbau.
      </div>
    </div>
  );
}

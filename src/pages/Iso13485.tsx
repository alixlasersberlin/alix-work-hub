import { ShieldCheck } from 'lucide-react';

export default function Iso13485() {
  return (
    <div className="container max-w-5xl py-6 space-y-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="w-7 h-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ISO 13485</h1>
          <p className="text-sm text-muted-foreground">
            Qualitätsmanagementsystem für Medizinprodukte.
          </p>
        </div>
      </div>
      <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
        Dieser Bereich befindet sich im Aufbau.
      </div>
    </div>
  );
}

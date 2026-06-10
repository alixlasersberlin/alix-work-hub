import { ClipboardList } from 'lucide-react';

export default function OrdersCh() {
  return (
    <div className="p-6 max-w-5xl mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <ClipboardList className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-display font-bold gold-text">🇨🇭 Aufträge CH</h1>
          <p className="text-sm text-muted-foreground">Alix Schweiz – Verkäufe & Aufträge</p>
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card/50 p-10 text-center">
        <p className="text-muted-foreground">
          Das Schweiz-Modul wird vorbereitet. Sobald die Anbindung an das CH-Quellsystem erfolgt ist,
          erscheinen hier alle Aufträge mit Suffix <span className="font-mono text-foreground">-CH</span>.
        </p>
      </div>
    </div>
  );
}

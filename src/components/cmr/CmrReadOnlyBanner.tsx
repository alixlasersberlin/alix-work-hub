import { Lock } from 'lucide-react';

/** Hinweis für Nutzer mit der Rolle „CMR Viewer" – Lesezugriff ohne Buchungsrechte. */
export default function CmrReadOnlyBanner() {
  return (
    <div className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
      <Lock className="h-3.5 w-3.5 shrink-0" />
      Nur-Lese-Zugriff: Änderungen und Buchungen sind für deine Rolle gesperrt.
    </div>
  );
}

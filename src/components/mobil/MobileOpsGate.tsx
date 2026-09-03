/**
 * PROMPT 9 – Zugriffs-, Wartungs- und Kill-Switch-Gate für ALIXWORK MOBILE.
 *
 * Wichtig: Dieses Gate ist reine Darstellung. Die verbindliche Prüfung
 * erfolgt serverseitig (RLS + `mobile_access_state`). Wer das Frontend
 * umgeht, erhält trotzdem keine Schreibrechte.
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Loader2, Lock, Wrench, RefreshCw, ArrowUpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ACCESS_REASON_TEXT, fetchAccessState, type MobileAccessState } from '@/lib/mobil/golive';
import { APP_BUILD, APP_VERSION_MOBILE, ENVIRONMENT } from '@/lib/mobil/appInfo';

type Ctx = {
  state: MobileAccessState | null;
  loading: boolean;
  readOnly: boolean;
  refresh: () => void;
};

const OpsCtx = createContext<Ctx>({ state: null, loading: true, readOnly: false, refresh: () => {} });

export function useMobileOps() {
  return useContext(OpsCtx);
}

/** Bequemer Guard für Schreibaktionen in der UI. */
export function useMobileWriteAllowed(): { allowed: boolean; hint: string | null } {
  const { readOnly } = useMobileOps();
  return { allowed: !readOnly, hint: readOnly ? 'Wartungsmodus – nur Lesen' : null };
}

export default function MobileOpsGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MobileAccessState | null>(null);
  const [loading, setLoading] = useState(true);
  const [softDismissed, setSoftDismissed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const s = await fetchAccessState();
    setState(s);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Kill-Switch/Wartung regelmässig neu prüfen (leichtgewichtig).
  useEffect(() => {
    const t = window.setInterval(() => { void fetchAccessState().then((s) => s && setState(s)); }, 120000);
    return () => window.clearInterval(t);
  }, []);

  if (loading && !state) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Fail-safe: wenn der Serverstatus nicht abrufbar ist, wird nicht blockiert
  // (die eigentliche Absicherung liegt ohnehin in den RLS-Policies).
  if (state && !state.allowed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center bg-background">
        <Lock className="h-10 w-10 text-muted-foreground" />
        <div className="text-lg font-semibold">AlixWork Mobile</div>
        <p className="text-sm text-muted-foreground max-w-xs">
          {ACCESS_REASON_TEXT[state.reason] ?? 'AlixWork Mobile ist für Ihr Konto noch nicht freigeschaltet.'}
        </p>
        <Button variant="outline" onClick={() => void load()}>
          <RefreshCw className="h-4 w-4 mr-2" /> Erneut prüfen
        </Button>
        <div className="text-[10px] text-muted-foreground">
          {APP_VERSION_MOBILE} · Build {APP_BUILD} · {ENVIRONMENT}
        </div>
      </div>
    );
  }

  if (state?.update_required === 'HARD') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center bg-background">
        <ArrowUpCircle className="h-10 w-10 text-destructive" />
        <div className="text-lg font-semibold">Update erforderlich</div>
        <p className="text-sm text-muted-foreground max-w-xs">
          Diese Version von AlixWork wird nicht mehr unterstützt. Bitte aktualisieren Sie die App
          (mindestens Version {state.minimum_supported_version}).
        </p>
        <Button onClick={() => window.location.reload()}>App neu laden</Button>
      </div>
    );
  }

  const readOnly = !!state?.read_only;

  return (
    <OpsCtx.Provider value={{ state, loading, readOnly, refresh: () => void load() }}>
      {state?.maintenance_mode && (
        <div className="mx-3 mt-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] flex items-start gap-2">
          <Wrench className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden />
          <div>
            <div className="font-semibold">WARTUNGSMODUS – NUR LESEN</div>
            <div className="text-muted-foreground">
              {state.maintenance_message || 'AlixWork Mobile wird derzeit gewartet. Lesen ist weiterhin möglich.'}
            </div>
          </div>
        </div>
      )}

      {!state?.maintenance_mode && readOnly && (
        <div className="mx-3 mt-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] font-semibold">
          WARTUNGSMODUS – NUR LESEN
        </div>
      )}

      {state?.update_required === 'SOFT' && !softDismissed && (
        <div className="mx-3 mt-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-[11px] flex items-center gap-2">
          <ArrowUpCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="flex-1">Update verfügbar (Version {state.recommended_version})</span>
          <button className="underline" onClick={() => window.location.reload()}>Update öffnen</button>
          <button className="text-muted-foreground" onClick={() => setSoftDismissed(true)}>Später</button>
        </div>
      )}

      {children}
    </OpsCtx.Provider>
  );
}

import { Component, type ReactNode } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Sichtbarer Ladezustand statt leerer Seite, während ein Modul nachgeladen wird. */
export function RouteFallback() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Seite wird geladen …</span>
      </div>
    </div>
  );
}

interface State { error: Error | null }

/**
 * Fängt Render-Fehler einzelner Seiten ab, damit statt einer weißen/leeren
 * Seite eine verständliche Meldung mit Neuladen-Option erscheint.
 */
export class RouteErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[RouteErrorBoundary]', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-xl border border-border bg-card p-6 text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-destructive" />
          </div>
          <h2 className="text-lg font-semibold">Diese Seite konnte nicht geladen werden</h2>
          <p className="text-sm text-muted-foreground break-words">
            {this.state.error.message || 'Unbekannter Fehler'}
          </p>
          <div className="flex justify-center gap-2">
            <Button onClick={() => window.location.reload()}>Neu laden</Button>
            <Button variant="outline" onClick={() => this.setState({ error: null })}>
              Erneut versuchen
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

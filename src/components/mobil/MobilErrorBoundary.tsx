/**
 * Globale & bereichsspezifische Error Boundary (Prompt 7, Punkt 41/42).
 * Technische Details bleiben eingeklappt und werden nicht an Kunden gezeigt.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type Props = { children: ReactNode; area?: string; fallbackCompact?: boolean };
type State = { error: Error | null };

export default class MobilErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Kein Kundeninhalt, keine Tokens – nur technische Kennung.
    console.error(`[mobil:${this.props.area ?? 'app'}] ${error.name}: ${error.message}`, info.componentStack?.slice(0, 400));
  }

  private reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallbackCompact) {
      return (
        <Card className="p-3 text-xs text-muted-foreground flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="flex-1">Bereich „{this.props.area ?? 'Modul'}“ konnte nicht geladen werden.</span>
          <Button size="sm" variant="outline" onClick={this.reset}>Erneut</Button>
        </Card>
      );
    }

    return (
      <div className="p-6 flex flex-col items-center justify-center gap-4 min-h-[60vh] text-center">
        <AlertTriangle className="w-10 h-10 text-amber-500" />
        <div>
          <div className="text-lg font-semibold">Ein Fehler ist aufgetreten.</div>
          <div className="text-xs text-muted-foreground mt-1">
            Der Vorgang wurde abgebrochen. Ihre Daten sind unverändert.
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={this.reset}>Erneut versuchen</Button>
          <Button variant="outline" onClick={() => { window.location.href = '/mobil'; }}>Zur Startseite</Button>
        </div>
        <details className="text-[10px] text-muted-foreground max-w-full">
          <summary className="cursor-pointer">Technische Details</summary>
          <code className="break-all">{error.name}: {error.message}</code>
        </details>
      </div>
    );
  }
}

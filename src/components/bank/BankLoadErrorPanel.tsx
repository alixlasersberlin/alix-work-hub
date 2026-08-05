import { AlertTriangle, Copy, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatBankLoadError, type BankLoadError } from '@/lib/bank/loadError';

export default function BankLoadErrorPanel({
  error,
  onRetry,
}: {
  error: BankLoadError;
  onRetry?: () => void;
}) {
  const copy = async () => {
    await navigator.clipboard.writeText(formatBankLoadError(error));
    toast.success('Fehlerdetails kopiert');
  };

  return (
    <Card className="border-destructive/40 bg-destructive/5">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="space-y-1">
            <p className="font-medium text-destructive">Daten konnten nicht geladen werden</p>
            <p className="text-sm text-muted-foreground">{error.message}</p>
          </div>
        </div>

        <dl className="grid gap-1 rounded-md border border-border/60 bg-background/60 p-3 font-mono text-xs">
          <div className="flex gap-2">
            <dt className="w-32 shrink-0 text-muted-foreground">Endpoint</dt>
            <dd className="break-all">{error.endpoint}</dd>
          </div>
          {error.url && (
            <div className="flex gap-2">
              <dt className="w-32 shrink-0 text-muted-foreground">URL</dt>
              <dd className="break-all">{error.url}</dd>
            </div>
          )}
          {error.status != null && (
            <div className="flex gap-2">
              <dt className="w-32 shrink-0 text-muted-foreground">HTTP-Status</dt>
              <dd>{error.status}</dd>
            </div>
          )}
          {error.code && (
            <div className="flex gap-2">
              <dt className="w-32 shrink-0 text-muted-foreground">Fehlercode</dt>
              <dd>{error.code}</dd>
            </div>
          )}
          {error.details && (
            <div className="flex gap-2">
              <dt className="w-32 shrink-0 text-muted-foreground">Details</dt>
              <dd className="break-all">{error.details}</dd>
            </div>
          )}
          {error.hint && (
            <div className="flex gap-2">
              <dt className="w-32 shrink-0 text-muted-foreground">Hinweis</dt>
              <dd className="break-all">{error.hint}</dd>
            </div>
          )}
          <div className="flex gap-2">
            <dt className="w-32 shrink-0 text-muted-foreground">Korrelationscode</dt>
            <dd className="font-semibold">{error.correlationId}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-32 shrink-0 text-muted-foreground">Zeitpunkt</dt>
            <dd>{new Date(error.at).toLocaleString('de-DE')}</dd>
          </div>
        </dl>

        <div className="flex flex-wrap gap-2">
          {onRetry && (
            <Button size="sm" onClick={onRetry}>
              <RefreshCw className="mr-2 h-4 w-4" /> Erneut laden
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={copy}>
            <Copy className="mr-2 h-4 w-4" /> Details kopieren
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

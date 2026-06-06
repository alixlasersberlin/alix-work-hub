import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Globe, Plus, CheckCircle2, AlertCircle } from 'lucide-react';

const PLACEHOLDER_DOMAINS = [
  { name: 'alixwork.de', spf: true, dkim: true, dmarc: false },
  { name: 'alix-finance.de', spf: true, dkim: true, dmarc: true },
];

export default function MailCenterDomains() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-display font-semibold text-foreground">Domains</h2>
          <p className="text-sm text-muted-foreground">SPF / DKIM / DMARC-Status der Versanddomains.</p>
        </div>
        <Button disabled><Plus className="w-4 h-4 mr-2" /> Domain hinzufügen</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {PLACEHOLDER_DOMAINS.map((d) => (
          <Card key={d.name} className="card-glow">
            <CardHeader>
              <CardTitle className="text-sm font-display flex items-center gap-2">
                <Globe className="w-4 h-4 text-primary" /> {d.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {(['spf', 'dkim', 'dmarc'] as const).map((k) => {
                const ok = d[k];
                return (
                  <div key={k} className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-3 py-2">
                    <span className="uppercase tracking-wide text-xs text-muted-foreground">{k}</span>
                    {ok ? (
                      <span className="flex items-center gap-1.5 text-emerald-500">
                        <CheckCircle2 className="w-4 h-4" /> OK
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-amber-500">
                        <AlertCircle className="w-4 h-4" /> ausstehend
                      </span>
                    )}
                  </div>
                );
              })}
              <p className="text-xs text-muted-foreground pt-2">
                Diese Anzeige ist ein Platzhalter und wird im nächsten Schritt an
                <code className="mx-1 px-1 rounded bg-muted">mail_domains</code>
                angebunden.
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

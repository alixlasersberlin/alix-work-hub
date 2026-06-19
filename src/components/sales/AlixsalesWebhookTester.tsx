import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Send, Webhook, CheckCircle2, AlertTriangle, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const PROJECT_REF = import.meta.env.VITE_SUPABASE_PROJECT_ID as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const ENDPOINT = `https://${PROJECT_REF}.supabase.co/functions/v1/alixsales-import`;

const SAMPLE = {
  id: `AS-TEST-${Date.now()}`,
  form_name: 'Webhook-Test (Alix Work)',
  first_name: 'Max',
  last_name: 'Mustermann',
  company: 'Mustermann GmbH',
  email: 'max@mustermann.de',
  phone: '+49 30 123456',
  street: 'Musterstr. 1',
  zip: '10115',
  city: 'Berlin',
  country: 'DE',
  product: 'Bizzon Bench',
  device_category: 'Sitzbank',
  customer_goal: 'Modernisierung Wartebereich',
  implementation_period: 'Q3 2026',
  message: 'Test-Anfrage aus dem Webhook-Tester',
};

type Result = {
  ok: boolean;
  status: number;
  durationMs: number;
  body: any;
};

export function AlixsalesWebhookTester() {
  const [apiKey, setApiKey] = useState('');
  const [payload, setPayload] = useState(() => JSON.stringify(SAMPLE, null, 2));
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const parsed = useMemo(() => {
    try {
      JSON.parse(payload);
      return { ok: true as const };
    } catch (e: any) {
      return { ok: false as const, error: e?.message ?? 'Ungültiges JSON' };
    }
  }, [payload]);

  const send = async () => {
    if (!apiKey.trim()) {
      toast.error('Webhook-Key fehlt');
      return;
    }
    if (!parsed.ok) {
      toast.error('Ungültiges JSON: ' + parsed.error);
      return;
    }
    setSending(true);
    setResult(null);
    const t0 = performance.now();
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey.trim(),
        },
        body: payload,
      });
      const text = await res.text();
      let body: any = text;
      try { body = JSON.parse(text); } catch { /* leave as text */ }
      const r: Result = {
        ok: res.ok,
        status: res.status,
        durationMs: Math.round(performance.now() - t0),
        body,
      };
      setResult(r);
      if (res.ok) toast.success(`Import OK – Lead ${body?.lead_id ?? ''}`);
      else toast.error(`Import fehlgeschlagen (HTTP ${res.status})`);
    } catch (e: any) {
      setResult({
        ok: false,
        status: 0,
        durationMs: Math.round(performance.now() - t0),
        body: { error: e?.message ?? String(e) },
      });
      toast.error('Netzwerk-Fehler: ' + (e?.message ?? String(e)));
    } finally {
      setSending(false);
    }
  };

  const copyEndpoint = async () => {
    await navigator.clipboard.writeText(ENDPOINT);
    toast.success('Endpoint kopiert');
  };

  const fillSample = () => setPayload(JSON.stringify({ ...SAMPLE, id: `AS-TEST-${Date.now()}` }, null, 2));

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Webhook className="h-4 w-4 text-primary" />
          Alixsales.com Webhook-Tester
          <Badge variant="outline" className="ml-auto font-mono text-[10px]">POST /alixsales-import</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Input value={ENDPOINT} readOnly className="font-mono text-xs" />
          <Button type="button" variant="outline" size="icon" onClick={copyEndpoint} title="Endpoint kopieren">
            <Copy className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">x-api-key (ALIXSALES_WEBHOOK_KEY)</label>
          <Input
            type="password"
            placeholder="Webhook-Key eingeben"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            autoComplete="off"
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">Body (JSON)</label>
            <Button type="button" variant="ghost" size="sm" onClick={fillSample}>Beispiel laden</Button>
          </div>
          <Textarea
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            rows={12}
            className="font-mono text-xs"
            spellCheck={false}
          />
          {!parsed.ok && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> {parsed.error}
            </p>
          )}
        </div>

        <Button onClick={send} disabled={sending || !parsed.ok} className="gap-2">
          <Send className="h-4 w-4" />
          {sending ? 'Sende…' : 'Webhook senden'}
        </Button>

        {result && (
          <div className={`rounded-md border p-3 space-y-2 ${result.ok ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-destructive/40 bg-destructive/5'}`}>
            <div className="flex items-center gap-2 text-sm">
              {result.ok ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-destructive" />
              )}
              <span className="font-medium">
                {result.ok ? 'Erfolg' : 'Fehler'} – HTTP {result.status}
              </span>
              <Badge variant="outline" className="ml-auto text-[10px]">{result.durationMs} ms</Badge>
            </div>
            <pre className="text-xs bg-background/60 rounded p-2 overflow-auto max-h-60">
{typeof result.body === 'string' ? result.body : JSON.stringify(result.body, null, 2)}
            </pre>
            {result.ok && result.body?.lead_id && (
              <a
                href={`/verkauf/anfragen/${result.body.lead_id}`}
                className="text-xs text-primary underline"
              >
                Importierten Lead öffnen →
              </a>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

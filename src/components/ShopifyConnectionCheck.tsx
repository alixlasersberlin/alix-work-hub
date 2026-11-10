import { useState } from 'react';
import { Store, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type Result = { ok: boolean; message?: string; error?: string; shop?: { name: string }; permissions?: { orders: boolean; all_orders: boolean } };

export function ShopifyConnectionCheck() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  async function check() {
    setBusy(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('shopify-orders', { body: { action: 'check' } });
      if (error) {
        let message = 'Verbindungsprüfung nicht verfügbar.';
        if (error.context instanceof Response) {
          try { const details = await error.context.json(); message = details.error ?? message; } catch { /* retain safe message */ }
        }
        setResult({ ok: false, error: message });
      } else setResult(data);
    } catch { setResult({ ok: false, error: 'Verbindungsprüfung fehlgeschlagen.' }); }
    finally { setBusy(false); }
  }
  return <section className="border-b pb-5 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h2 className="text-xl font-semibold flex items-center gap-2"><Store className="h-5 w-5"/>Shopify</h2><p className="text-sm text-muted-foreground mt-1">0213c2-4.myshopify.com</p></div>
      <Button variant="outline" disabled={busy} onClick={check}><RefreshCw className={`h-4 w-4 mr-2 ${busy ? 'animate-spin' : ''}`}/>Verbindung prüfen</Button>
    </div>
    {result && <div role="status" className={result.ok ? 'text-foreground' : 'text-destructive'}>{result.ok ? result.message : result.error}</div>}
    {result?.ok && <div className="flex flex-wrap gap-2"><Badge variant="outline">{result.shop?.name}</Badge><Badge variant={result.permissions?.orders ? 'secondary' : 'destructive'}>{result.permissions?.orders ? 'Bestellleserechte vorhanden' : 'Bestellleserechte fehlen'}</Badge><Badge variant={result.permissions?.all_orders ? 'secondary' : 'outline'}>{result.permissions?.all_orders ? 'Gesamte Bestellhistorie freigegeben' : 'Gesamte Bestellhistorie nicht freigegeben'}</Badge></div>}
  </section>;
}
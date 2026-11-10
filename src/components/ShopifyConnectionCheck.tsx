import { useState } from 'react';
import { Store, RefreshCw, FlaskConical, Download, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';

type Result = { ok: boolean; message?: string; error?: string; shop?: { name: string }; permissions?: { orders: boolean; all_orders: boolean } };
type Entry = { external_id: string; name: string; status: string; message: string };

export function ShopifyConnectionCheck() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [summary, setSummary] = useState<{ count: number; errors: number; all_orders: boolean } | null>(null);
  const [runId, setRunId] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [progress, setProgress] = useState('');
  async function request(body: Record<string, unknown>) {
    const { data, error } = await supabase.functions.invoke('shopify-orders', { body });
    if (error) {
      let message = 'Shopify-Aufruf nicht verfügbar.';
      if (error.context instanceof Response) { try { message = (await error.context.json()).error ?? message; } catch { /* safe fallback */ } }
      throw new Error(message);
    }
    if (!data?.ok) throw new Error(data?.error ?? 'Shopify-Verarbeitung fehlgeschlagen.');
    return data;
  }
  async function test() {
    setBusy(true); setSummary(null); setEntries([]); setResult(null);
    const run = crypto.randomUUID(); const cutoff = new Date().toISOString(); setRunId(run);
    let cursor: string | null = null; let count = 0;
    try {
      do {
        const data = await request({ action: 'test', run, cutoff, cursor });
        setEntries(previous => [...previous, ...data.results]); count += data.results.length;
        setProgress(`${count} Bestellungen geprüft · keine Aufträge angelegt`);
        cursor = data.next; if (data.summary) setSummary(data.summary);
      } while (cursor);
    } catch (e) { setResult({ ok: false, error: e instanceof Error ? e.message : 'Test fehlgeschlagen.' }); }
    finally { setBusy(false); }
  }
  async function importOrders() {
    setConfirm(false); setBusy(true); setResult(null); setEntries([]);
    try {
      await request({ action: 'approve', run: runId, confirmed: true });
      let cursor: string | null = null; let count = 0;
      do {
        const data = await request({ action: 'import', cursor });
        setEntries(previous => [...previous, ...data.results]); count += data.results.length;
        setProgress(`${count} Bestellungen verarbeitet`); cursor = data.next;
      } while (cursor);
      const hooks = await request({ action: 'webhooks' });
      setResult({ ok: hooks.ok, message: 'Import abgeschlossen; automatische Shopify-Synchronisierung eingerichtet.' });
    } catch (e) { setResult({ ok: false, error: e instanceof Error ? e.message : 'Import unterbrochen; Protokoll prüfen.' }); }
    finally { setBusy(false); setSummary(null); }
  }
  function download() {
    const quote = (v: string) => `"${v.replaceAll('"', '""')}"`;
    const csv = '\uFEFF' + [['Bestell-ID','Bestellung','Status','Ergebnis'], ...entries.map(e => [e.external_id,e.name,e.status,e.message])].map(r => r.map(quote).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'Shopify-Bestellprotokoll.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
  }
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
      <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={check}><RefreshCw className={`h-4 w-4 mr-2 ${busy ? 'animate-spin' : ''}`}/>Verbindung prüfen</Button><Button disabled={busy} onClick={test}><FlaskConical className="h-4 w-4 mr-2"/>Bestellimport testen</Button></div>
    </div>
    {result && <div role="status" className={result.ok ? 'text-foreground' : 'text-destructive'}>{result.ok ? result.message : result.error}</div>}
    {result?.ok && <div className="flex flex-wrap gap-2"><Badge variant="outline">{result.shop?.name}</Badge><Badge variant={result.permissions?.orders ? 'secondary' : 'destructive'}>{result.permissions?.orders ? 'Bestellleserechte vorhanden' : 'Bestellleserechte fehlen'}</Badge><Badge variant={result.permissions?.all_orders ? 'secondary' : 'outline'}>{result.permissions?.all_orders ? 'Gesamte Bestellhistorie freigegeben' : 'Gesamte Bestellhistorie nicht freigegeben'}</Badge></div>}
    {progress && <p role="status" className="text-sm text-muted-foreground">{progress}</p>}
    {summary && <div className="space-y-3"><p className="font-semibold">{summary.count} zugängliche Shopify-Bestellungen · {summary.errors} Fehler</p><p className="text-sm text-muted-foreground">{summary.all_orders ? 'Gesamte Bestellhistorie zugänglich.' : 'Nur die aktuell freigegebene Bestellhistorie; ältere Bestellungen sind noch nicht zugänglich.'}</p><Button disabled={busy || summary.errors > 0 || summary.count === 0} onClick={() => setConfirm(true)}><CheckCircle2 className="h-4 w-4 mr-2"/>Produktivimport freigeben</Button></div>}
    {entries.length > 0 && <><Button variant="outline" onClick={download}><Download className="h-4 w-4 mr-2"/>Protokoll herunterladen</Button><div className="max-h-72 overflow-auto"><table className="w-full text-sm"><thead><tr className="text-left border-b"><th className="py-2">Bestellung</th><th>Status</th><th>Ergebnis</th></tr></thead><tbody>{entries.map((e,i) => <tr key={`${e.external_id}-${i}`} className="border-b"><td className="py-2 pr-3">{e.name}</td><td className="pr-3">{({ready:'Test erfolgreich',skipped:'Übersprungen',imported:'Importiert',error:'Fehler'} as Record<string,string>)[e.status] ?? e.status}</td><td className="break-words">{e.message}</td></tr>)}</tbody></table></div></>}
    <AlertDialog open={confirm} onOpenChange={setConfirm}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Shopify-Bestellimport freigeben?</AlertDialogTitle><AlertDialogDescription>{summary?.count} geprüfte Bestellungen werden übernommen. Bereits vorhandene Bestellungen werden übersprungen. Neue Bestellungen, Änderungen, Stornierungen und Rückerstattungen werden anschließend automatisch synchronisiert; andere Aufträge und die Zugangsdaten bleiben unverändert.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Abbrechen</AlertDialogCancel><AlertDialogAction onClick={importOrders}>Freigeben und importieren</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>;
}
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, AlertCircle, ExternalLink, Loader2, Percent } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type PriceMode = 'brutto' | 'netto';

export interface OrderVatState {
  priceMode: PriceMode;
  vatCountry: string;
  vatNumber: string;
  isValid: boolean | null;
  checkedAt?: string;
  companyName?: string | null;
}

const EU_COUNTRIES: { code: string; label: string }[] = [
  { code: 'AT', label: 'Österreich' }, { code: 'BE', label: 'Belgien' },
  { code: 'BG', label: 'Bulgarien' }, { code: 'CY', label: 'Zypern' },
  { code: 'CZ', label: 'Tschechien' }, { code: 'DE', label: 'Deutschland' },
  { code: 'DK', label: 'Dänemark' }, { code: 'EE', label: 'Estland' },
  { code: 'EL', label: 'Griechenland' }, { code: 'ES', label: 'Spanien' },
  { code: 'FI', label: 'Finnland' }, { code: 'FR', label: 'Frankreich' },
  { code: 'HR', label: 'Kroatien' }, { code: 'HU', label: 'Ungarn' },
  { code: 'IE', label: 'Irland' }, { code: 'IT', label: 'Italien' },
  { code: 'LT', label: 'Litauen' }, { code: 'LU', label: 'Luxemburg' },
  { code: 'LV', label: 'Lettland' }, { code: 'MT', label: 'Malta' },
  { code: 'NL', label: 'Niederlande' }, { code: 'PL', label: 'Polen' },
  { code: 'PT', label: 'Portugal' }, { code: 'RO', label: 'Rumänien' },
  { code: 'SE', label: 'Schweden' }, { code: 'SI', label: 'Slowenien' },
  { code: 'SK', label: 'Slowakei' }, { code: 'XI', label: 'Nordirland' },
];

const STORAGE_KEY = (orderId: string) => `order-vat:${orderId}`;
const DEFAULT_TEST = { country: 'DE', number: '321691012' };

export function loadVatState(orderId: string): OrderVatState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(orderId));
    if (raw) return { priceMode: 'brutto', vatCountry: 'DE', vatNumber: '', isValid: null, ...JSON.parse(raw) };
  } catch {}
  return { priceMode: 'brutto', vatCountry: 'DE', vatNumber: '', isValid: null };
}

export function useOrderVatState(orderId?: string) {
  const [state, setState] = useState<OrderVatState>(() => orderId ? loadVatState(orderId) : {
    priceMode: 'brutto', vatCountry: 'DE', vatNumber: '', isValid: null,
  });
  useEffect(() => { if (orderId) setState(loadVatState(orderId)); }, [orderId]);
  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('orders').select('vat_display_mode').eq('id', orderId).maybeSingle();
      const m = (data as any)?.vat_display_mode;
      if (!cancelled && (m === 'netto' || m === 'brutto')) {
        setState((s) => (s.priceMode === m ? s : { ...s, priceMode: m }));
      }
    })();
    return () => { cancelled = true; };
  }, [orderId]);
  useEffect(() => {
    if (!orderId) return;
    try { localStorage.setItem(STORAGE_KEY(orderId), JSON.stringify(state)); } catch {}
    // notify same-tab listeners
    window.dispatchEvent(new CustomEvent('order-vat-changed', { detail: { orderId, state } }));
  }, [orderId, state]);
  // subscribe to other panels updating for same orderId
  useEffect(() => {
    if (!orderId) return;
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d?.orderId === orderId) setState(d.state);
    };
    window.addEventListener('order-vat-changed', handler);
    return () => window.removeEventListener('order-vat-changed', handler);
  }, [orderId]);
  return [state, setState] as const;
}

interface Props {
  orderId: string;
}

export default function OrderVatPanel({ orderId }: Props) {
  const [state, setState] = useOrderVatState(orderId);
  const [checking, setChecking] = useState(false);

  const setPriceMode = (priceMode: PriceMode) => {
    setState((s) => ({ ...s, priceMode }));
    supabase.from('orders').update({ vat_display_mode: priceMode }).eq('id', orderId).then(({ error }) => {
      if (error) toast.error('MwSt.-Anzeige konnte nicht gespeichert werden');
    });
  };

  const runCheck = async (country?: string, number?: string) => {
    const c = (country ?? state.vatCountry).toUpperCase();
    const n = (number ?? state.vatNumber).replace(/[^A-Za-z0-9]/g, '');
    if (!c || !n) { toast.error('Land und UID eingeben'); return; }
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke('vies-check', {
        method: 'GET' as any,
        // supabase.functions.invoke doesn't support query on GET across all versions - fallback via body
        body: { country: c, number: n } as any,
      });
      let result: any = data;
      if (error || !result) {
        // fallback: direct fetch with query string
        const base = (supabase as any).functions?.url || '';
        const url = `${base}/vies-check?country=${encodeURIComponent(c)}&number=${encodeURIComponent(n)}`;
        const r = await fetch(url, { headers: { apikey: (supabase as any).supabaseKey || '' } });
        result = await r.json();
      }
      const valid = !!result?.isValid;
      setState((s) => ({
        ...s,
        vatCountry: c, vatNumber: n,
        isValid: valid,
        checkedAt: new Date().toISOString(),
        companyName: result?.name && result.name !== '---' ? result.name : null,
      }));
      valid ? toast.success('UID gültig') : toast.error(`UID ungültig${result?.userError ? ` (${result.userError})` : ''}`);
    } catch (e: any) {
      toast.error(`Prüfung fehlgeschlagen: ${e?.message || e}`);
      setState((s) => ({ ...s, isValid: false, checkedAt: new Date().toISOString() }));
    } finally {
      setChecking(false);
    }
  };

  const applyTest = () => runCheck(DEFAULT_TEST.country, DEFAULT_TEST.number);

  return (
    <div className="mt-5 pt-4 border-t border-border space-y-4">
      {/* Preis-Anzeige Toggle */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <Label className="flex items-center gap-1.5 text-sm font-medium">
            <Percent className="w-3.5 h-3.5 text-primary" /> MwSt.-Anzeige
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Gesamtpreis bleibt gleich – nur die Darstellung ändert sich.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${state.priceMode === 'netto' ? 'text-primary' : 'text-muted-foreground'}`}>Netto</span>
          <Switch
            checked={state.priceMode === 'brutto'}
            onCheckedChange={(v) => setPriceMode(v ? 'brutto' : 'netto')}
          />
          <span className={`text-xs font-medium ${state.priceMode === 'brutto' ? 'text-primary' : 'text-muted-foreground'}`}>Brutto</span>
        </div>
      </div>

      {/* UID */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">USt-IdNr. (UID)</Label>
        <div className="flex gap-2">
          <Select value={state.vatCountry} onValueChange={(v) => setState((s) => ({ ...s, vatCountry: v, isValid: null }))}>
            <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-72">
              {EU_COUNTRIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>{c.code} · {c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            className="flex-1"
            placeholder="z. B. 321691012"
            value={state.vatNumber}
            onChange={(e) => setState((s) => ({ ...s, vatNumber: e.target.value, isValid: null }))}
          />
          {state.isValid === true && <CheckCircle2 className="w-6 h-6 text-emerald-500 flex-shrink-0 self-center" />}
          {state.isValid === false && <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0 self-center" />}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => runCheck()} disabled={checking}>
            {checking ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
            UID prüfen (VIES)
          </Button>
          <a
            href={`https://ec.europa.eu/taxation_customs/vies/#/vat-validation`}
            target="_blank" rel="noreferrer"
            className="text-xs text-primary inline-flex items-center gap-1 hover:underline"
          >
            EU-Prüfportal <ExternalLink className="w-3 h-3" />
          </a>
          <Button size="sm" variant="ghost" className="text-xs" onClick={applyTest}>
            Test-UID DE321691012
          </Button>
        </div>
        {state.companyName && (
          <p className="text-xs text-muted-foreground">Firma laut VIES: <span className="text-foreground">{state.companyName}</span></p>
        )}
        {state.checkedAt && (
          <p className="text-xs text-muted-foreground">Zuletzt geprüft: {new Date(state.checkedAt).toLocaleString('de-DE')}</p>
        )}
      </div>
    </div>
  );
}

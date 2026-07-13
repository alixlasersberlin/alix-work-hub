import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Play } from 'lucide-react';

const MODES = [
  { v: 'uvp_minus_pct', l: 'UVP minus %' },
  { v: 'uvp_plus_pct', l: 'UVP plus %' },
  { v: 'uvp_factor', l: 'UVP × Faktor' },
  { v: 'fixed', l: 'Fester Wert' },
  { v: 'rounding', l: 'Nur Rundung' },
];

interface Rule {
  id: string;
  code: string;
  name: string;
  mode: string;
  percent_value: number | null;
  factor_value: number | null;
  fixed_value: number | null;
  rounding: number | null;
  is_active: boolean;
}

interface PriceRow {
  id: string;
  item_id: string;
  country_id: string | null;
  uvp_net: number | null;
  uvp_gross: number | null;
  standard_net: number | null;
  standard_gross: number | null;
  currency_code: string | null;
  tax_rate: number | null;
  item?: { sku: string; name: string };
  country?: { iso2: string; name: string };
}

function applyRule(uvp: number, rule: Rule): number {
  let result = uvp;
  switch (rule.mode) {
    case 'uvp_minus_pct':
      result = uvp * (1 - (rule.percent_value ?? 0) / 100);
      break;
    case 'uvp_plus_pct':
      result = uvp * (1 + (rule.percent_value ?? 0) / 100);
      break;
    case 'uvp_factor':
      result = uvp * (rule.factor_value ?? 1);
      break;
    case 'fixed':
      result = rule.fixed_value ?? uvp;
      break;
    case 'rounding':
      result = uvp;
      break;
  }
  const round = rule.rounding && rule.rounding > 0 ? Number(rule.rounding) : 0.01;
  return Math.round(result / round) * round;
}

export default function KatalogPreisregeln() {
  const { toast } = useToast();
  const client = supabase as any;
  const [rows, setRows] = useState<Rule[]>([]);
  const [f, setF] = useState<any>({ code: '', name: '', mode: 'uvp_minus_pct', percent_value: 0, factor_value: 1, fixed_value: 0, rounding: 0.01 });

  const [applyRule_, setApplyRule] = useState<Rule | null>(null);
  const [applyPrices, setApplyPrices] = useState<PriceRow[]>([]);
  const [selection, setSelection] = useState<Record<string, boolean>>({});
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyBusy, setApplyBusy] = useState(false);
  const [scope, setScope] = useState<'net' | 'gross'>('gross');

  const load = async () => {
    const { data, error } = await client.from('catalog_price_rules').select('*').order('code');
    if (error) return toast({ title: 'Zugriff verweigert', description: 'Nur Preis-Berechtigte sehen Regeln.', variant: 'destructive' });
    setRows((data ?? []) as Rule[]);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!f.code || !f.name) return toast({ title: 'Code und Name erforderlich' });
    const { error } = await client.from('catalog_price_rules').insert(f);
    if (error) return toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    setF({ code: '', name: '', mode: 'uvp_minus_pct', percent_value: 0, factor_value: 1, fixed_value: 0, rounding: 0.01 });
    load();
  };

  const del = async (id: string) => {
    if (!confirm('Regel löschen?')) return;
    const { error } = await client.from('catalog_price_rules').delete().eq('id', id);
    if (error) return toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    load();
  };

  const openApply = async (rule: Rule) => {
    setApplyRule(rule);
    setSelection({});
    setApplyLoading(true);
    const { data, error } = await client
      .from('catalog_item_prices')
      .select('id, item_id, country_id, uvp_net, uvp_gross, standard_net, standard_gross, currency_code, tax_rate, item:catalog_items(sku,name), country:catalog_countries(iso2,name)')
      .not('uvp_gross', 'is', null)
      .limit(500);
    setApplyLoading(false);
    if (error) return toast({ title: 'Fehler beim Laden', description: error.message, variant: 'destructive' });
    setApplyPrices((data ?? []) as PriceRow[]);
  };

  const preview = useMemo(() => {
    if (!applyRule_) return [];
    return applyPrices.map((p) => {
      const base = scope === 'gross' ? Number(p.uvp_gross ?? 0) : Number(p.uvp_net ?? 0);
      const cur = scope === 'gross' ? Number(p.standard_gross ?? 0) : Number(p.standard_net ?? 0);
      const next = base > 0 ? applyRule(base, applyRule_) : 0;
      return { ...p, base, cur, next };
    });
  }, [applyPrices, applyRule_, scope]);

  const toggleAll = (val: boolean) => {
    const next: Record<string, boolean> = {};
    if (val) preview.forEach((p) => { if (p.base > 0) next[p.id] = true; });
    setSelection(next);
  };

  const applyNow = async () => {
    if (!applyRule_) return;
    const chosen = preview.filter((p) => selection[p.id] && p.base > 0);
    if (chosen.length === 0) return toast({ title: 'Nichts ausgewählt' });
    setApplyBusy(true);
    let ok = 0;
    let fail = 0;
    for (const p of chosen) {
      const patch: any = { rule_id: applyRule_.id, price_status: 'zur_freigabe' };
      if (scope === 'gross') {
        patch.standard_gross = p.next;
        if (p.tax_rate && p.tax_rate > 0) patch.standard_net = Number((p.next / (1 + Number(p.tax_rate) / 100)).toFixed(2));
      } else {
        patch.standard_net = p.next;
        if (p.tax_rate && p.tax_rate > 0) patch.standard_gross = Number((p.next * (1 + Number(p.tax_rate) / 100)).toFixed(2));
      }
      const { error } = await client.from('catalog_item_prices').update(patch).eq('id', p.id);
      if (error) fail++; else ok++;
    }
    setApplyBusy(false);
    toast({ title: 'Regel angewendet', description: `${ok} Preise aktualisiert${fail ? `, ${fail} fehlgeschlagen` : ''}. Status: zur Freigabe.` });
    setApplyRule(null);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Neue Preisregel (auf UVP-Basis)</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-7 gap-3">
          <div><Label>Code</Label><Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></div>
          <div><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div>
            <Label>Modus</Label>
            <Select value={f.mode} onValueChange={(v) => setF({ ...f, mode: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{MODES.map((m) => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Prozent</Label><Input type="number" step="0.01" value={f.percent_value} onChange={(e) => setF({ ...f, percent_value: Number(e.target.value) })} /></div>
          <div><Label>Faktor</Label><Input type="number" step="0.0001" value={f.factor_value} onChange={(e) => setF({ ...f, factor_value: Number(e.target.value) })} /></div>
          <div><Label>Rundung</Label><Input type="number" step="0.01" value={f.rounding} onChange={(e) => setF({ ...f, rounding: Number(e.target.value) })} /></div>
          <div className="flex items-end"><Button onClick={add}><Plus className="h-4 w-4 mr-1" />Anlegen</Button></div>
        </CardContent>
      </Card>

      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Modus</TableHead><TableHead>%</TableHead><TableHead>Faktor</TableHead><TableHead>Rundung</TableHead><TableHead>Aktiv</TableHead><TableHead className="text-right w-40">Aktion</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono">{r.code}</TableCell>
                <TableCell>{r.name}</TableCell>
                <TableCell>{MODES.find((m) => m.v === r.mode)?.l ?? r.mode}</TableCell>
                <TableCell>{r.percent_value ?? '—'}</TableCell>
                <TableCell>{r.factor_value ?? '—'}</TableCell>
                <TableCell>{r.rounding ?? '—'}</TableCell>
                <TableCell>{r.is_active ? '✓' : ''}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="outline" size="sm" onClick={() => openApply(r)}><Play className="h-4 w-4 mr-1" />Anwenden</Button>
                  <Button variant="ghost" size="sm" onClick={() => del(r.id)}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Keine Regeln definiert.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!applyRule_} onOpenChange={(o) => !o && setApplyRule(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Regel „{applyRule_?.name}" anwenden</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              Vorschau der neuen Preise auf Basis UVP. Änderungen werden mit Status <b>zur Freigabe</b> gespeichert (Vier-Augen-Prinzip).
            </div>
            <Select value={scope} onValueChange={(v: 'net' | 'gross') => setScope(v)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="gross">Brutto</SelectItem>
                <SelectItem value="net">Netto</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ScrollArea className="h-[420px] border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={preview.length > 0 && preview.every((p) => selection[p.id] || p.base === 0)}
                      onCheckedChange={(v) => toggleAll(!!v)}
                    />
                  </TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Artikel</TableHead>
                  <TableHead>Land</TableHead>
                  <TableHead className="text-right">UVP</TableHead>
                  <TableHead className="text-right">Aktuell</TableHead>
                  <TableHead className="text-right">Neu</TableHead>
                  <TableHead className="text-right">Δ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applyLoading && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Lade Preise…</TableCell></TableRow>}
                {!applyLoading && preview.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Keine Preise mit UVP vorhanden.</TableCell></TableRow>}
                {preview.map((p) => {
                  const delta = p.cur > 0 ? p.next - p.cur : 0;
                  const cur = p.currency_code ?? 'EUR';
                  return (
                    <TableRow key={p.id} className={p.base === 0 ? 'opacity-50' : ''}>
                      <TableCell>
                        <Checkbox
                          disabled={p.base === 0}
                          checked={!!selection[p.id]}
                          onCheckedChange={(v) => setSelection({ ...selection, [p.id]: !!v })}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{p.item?.sku ?? '—'}</TableCell>
                      <TableCell className="text-sm">{p.item?.name ?? '—'}</TableCell>
                      <TableCell className="text-xs">{p.country?.iso2 ?? '—'}</TableCell>
                      <TableCell className="text-right">{p.base ? `${p.base.toFixed(2)} ${cur}` : '—'}</TableCell>
                      <TableCell className="text-right">{p.cur ? `${p.cur.toFixed(2)} ${cur}` : '—'}</TableCell>
                      <TableCell className="text-right font-semibold">{p.base ? `${p.next.toFixed(2)} ${cur}` : '—'}</TableCell>
                      <TableCell className={`text-right text-xs ${delta > 0 ? 'text-emerald-500' : delta < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                        {p.cur > 0 ? `${delta >= 0 ? '+' : ''}${delta.toFixed(2)}` : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
          <DialogFooter>
            <div className="text-sm text-muted-foreground mr-auto">
              {Object.values(selection).filter(Boolean).length} von {preview.filter((p) => p.base > 0).length} ausgewählt
            </div>
            <Button variant="ghost" onClick={() => setApplyRule(null)}>Abbrechen</Button>
            <Button onClick={applyNow} disabled={applyBusy || Object.values(selection).filter(Boolean).length === 0}>
              {applyBusy ? 'Wende an…' : 'Anwenden & zur Freigabe'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

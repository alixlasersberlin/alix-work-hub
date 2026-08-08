import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Sparkles, PhoneCall, CalendarClock, Flame, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  COMPETITORS, FINANCING_TYPES, LEAD_SOURCES, LOSS_REASONS, PRODUCTS, STAGES,
  bandLabel, computeFollowups, computeForecast, daysSince, eur, offerDate, offerScore,
  offerValue, probabilityOf, stageOf, type OfferRow,
} from '@/lib/sales/offer-analytics';

/* ------------------------------------------------------------ Pflege-Dialog */

export function OfferEditDialog({ offer, onClose, onSaved }: { offer: OfferRow | null; onClose: () => void; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const o = offer;
  const val = (k: keyof OfferRow) => (form[k] !== undefined ? form[k] : (o?.[k] ?? '')) ?? '';
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!o) return;
    setBusy(true);
    const patch: Record<string, any> = { ...form };
    ['next_followup_at', 'last_contact_at'].forEach((k) => {
      if (patch[k]) patch[k] = new Date(patch[k]).toISOString();
      else if (patch[k] === '') patch[k] = null;
    });
    if (patch.expected_close_date === '') patch.expected_close_date = null;
    if (patch.discount_percent !== undefined) patch.discount_percent = Number(patch.discount_percent) || 0;
    const { error } = await (supabase.from('offers') as any).update(patch).eq('id', o.id);
    setBusy(false);
    if (error) { toast.error('Speichern fehlgeschlagen: ' + error.message); return; }
    toast.success('Angebot aktualisiert');
    setForm({});
    onSaved();
    onClose();
  };

  const logCall = async () => {
    if (!o) return;
    setBusy(true);
    const now = new Date().toISOString();
    await (supabase.from('offers') as any).update({ last_contact_at: now }).eq('id', o.id);
    await (supabase.from('offer_activities') as any).insert({ offer_id: o.id, kind: 'call', note: form.followup_note ?? null });
    setBusy(false);
    toast.success('Anruf protokolliert');
    onSaved();
  };

  const Select = ({ k, options, placeholder }: { k: string; options: string[]; placeholder: string }) => (
    <select
      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
      value={String(val(k as keyof OfferRow) ?? '')}
      onChange={(e) => set(k, e.target.value || null)}
    >
      <option value="">{placeholder}</option>
      {options.map((x) => <option key={x} value={x}>{x}</option>)}
    </select>
  );

  return (
    <Dialog open={!!o} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Angebot pflegen — {o?.offer_number} · {o?.customer_name}</DialogTitle>
        </DialogHeader>
        {o && (
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Vertriebsphase</Label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={String(val('stage') || stageOf(o))}
                onChange={(e) => set('stage', e.target.value)}
              >
                {STAGES.map((s) => <option key={s.code} value={s.code}>{s.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Produktkategorie</Label>
              <Select k="product_category" options={PRODUCTS} placeholder="automatisch aus Positionen" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Lead-Herkunft</Label>
              <Select k="lead_source" options={LEAD_SOURCES} placeholder="unbekannt" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Finanzierungsart</Label>
              <Select k="financing_type" options={FINANCING_TYPES} placeholder="offen" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Verlustgrund</Label>
              <Select k="loss_reason" options={LOSS_REASONS} placeholder="kein Verlust" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Wettbewerber</Label>
              <Select k="competitor" options={COMPETITORS} placeholder="keiner bekannt" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Rabatt (%)</Label>
              <Input type="number" step="0.1" value={String(val('discount_percent') ?? '')} onChange={(e) => set('discount_percent', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Geplantes Abschlussdatum</Label>
              <Input type="date" value={String(val('expected_close_date') || '').slice(0, 10)} onChange={(e) => set('expected_close_date', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Letzter Kontakt</Label>
              <Input type="datetime-local" value={String(val('last_contact_at') || '').slice(0, 16)} onChange={(e) => set('last_contact_at', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Wiedervorlage</Label>
              <Input type="datetime-local" value={String(val('next_followup_at') || '').slice(0, 16)} onChange={(e) => set('next_followup_at', e.target.value)} />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">Nachfass-Notiz</Label>
              <Textarea rows={3} value={String(val('followup_note') ?? '')} onChange={(e) => set('followup_note', e.target.value)} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={logCall} disabled={busy}>
            <PhoneCall className="h-4 w-4 mr-2" />Anruf protokollieren
          </Button>
          <Button onClick={save} disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Speichern</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------ Angebotsliste */

function OfferList({ title, rows, onPick, tone }: { title: string; rows: OfferRow[]; onPick: (o: OfferRow) => void; tone?: 'danger' | 'warn' }) {
  return (
    <Card className={cn('p-4 space-y-2', tone === 'danger' && 'border-destructive/40', tone === 'warn' && 'border-amber-500/40')}>
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</h4>
        <Badge variant="secondary">{rows.length}</Badge>
      </div>
      <div className="space-y-1 max-h-72 overflow-y-auto">
        {rows.slice(0, 40).map((o) => {
          const s = offerScore(o);
          return (
            <button
              key={o.id}
              onClick={() => onPick(o)}
              className="w-full text-left rounded-md px-2 py-1.5 hover:bg-muted/60 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium truncate">{o.customer_name || o.offer_number}</span>
                <span className="text-[11px] tabular-nums text-muted-foreground">{eur(offerValue(o))}</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span>{o.offer_number}</span>
                <span>· {daysSince(offerDate(o))} T. alt</span>
                <span className={cn(s.band === 'hot' && 'text-emerald-500', s.band === 'cold' && 'text-destructive')}>· {bandLabel(s.band)} {s.score}</span>
              </div>
            </button>
          );
        })}
        {rows.length === 0 && <p className="text-xs text-muted-foreground py-2">Keine Angebote.</p>}
      </div>
    </Card>
  );
}

export function FollowupSection({ offers, onRefresh }: { offers: OfferRow[]; onRefresh: () => void }) {
  const [picked, setPicked] = useState<OfferRow | null>(null);
  const f = useMemo(() => computeFollowups(offers), [offers]);
  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
        <OfferList title="Heute angerufen" rows={f.calledToday} onPick={setPicked} />
        <OfferList title="Gestern angerufen" rows={f.calledYesterday} onPick={setPicked} />
        <OfferList title="Seit 7 Tagen kein Kontakt" rows={f.stale7} onPick={setPicked} tone="warn" />
        <OfferList title="Seit 14 Tagen kein Kontakt" rows={f.stale14} onPick={setPicked} tone="danger" />
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
        <OfferList title="Wiedervorlage heute" rows={f.dueToday} onPick={setPicked} />
        <OfferList title="Wiedervorlage morgen" rows={f.dueTomorrow} onPick={setPicked} />
        <OfferList title="Diese Woche" rows={f.dueWeek} onPick={setPicked} />
        <OfferList title="Überfällig" rows={f.overdue} onPick={setPicked} tone="danger" />
      </div>
      <OfferEditDialog offer={picked} onClose={() => setPicked(null)} onSaved={onRefresh} />
    </div>
  );
}

/* ----------------------------------------------------------------- Forecast */

export function ForecastSection({ offers }: { offers: OfferRow[] }) {
  const fc = computeForecast(offers);
  const items = [
    { label: 'Dieser Monat', v: fc.thisMonth },
    { label: 'Nächster Monat', v: fc.nextMonth },
    { label: 'Aktuelles Quartal', v: fc.quarter },
  ];
  return (
    <Card className="p-5 space-y-3">
      <h3 className="font-display font-semibold text-sm">Umsatz-Forecast (gewichtet)</h3>
      <div className="grid md:grid-cols-3 gap-3">
        {items.map((i) => (
          <div key={i.label} className="rounded-lg border border-border bg-muted/20 p-4 space-y-1">
            <div className="text-xs text-muted-foreground">{i.label}</div>
            <div className="text-xl font-display font-bold tabular-nums">{eur(i.v.weighted)}</div>
            <div className="text-[11px] text-muted-foreground">Pipeline {eur(i.v.value)} · {i.v.count} Angebote</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ KI-Panel */

export function AiSection({ offers, onRefresh }: { offers: OfferRow[]; onRefresh: () => void }) {
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<OfferRow | null>(null);

  const ranked = useMemo(
    () => [...offers]
      .filter((o) => !o.declined_at && o.status !== 'order' && o.status !== 'signed')
      .sort((a, b) => probabilityOf(b) * offerValue(b) - probabilityOf(a) * offerValue(a))
      .slice(0, 25),
    [offers],
  );

  const runAi = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('offers-ai-score', {
      body: { offer_ids: ranked.slice(0, 15).map((o) => o.id) },
    });
    setBusy(false);
    if (error) { toast.error('KI-Bewertung fehlgeschlagen'); return; }
    toast.success(`${(data as any)?.scored ?? 0} Angebote bewertet`);
    onRefresh();
  };

  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold text-sm flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />KI-Bewertung & Prioritätenliste
        </h3>
        <Button size="sm" onClick={runAi} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
          Top-Angebote bewerten
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-muted-foreground">
            <tr className="border-b border-border">
              <th className="text-left py-2 font-medium">Angebot</th>
              <th className="text-left font-medium">Kunde</th>
              <th className="text-right font-medium">Wert</th>
              <th className="text-right font-medium">Score</th>
              <th className="text-right font-medium">Kaufwahrsch.</th>
              <th className="text-left font-medium pl-3">KI-Empfehlung</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {ranked.map((o) => {
              const s = offerScore(o);
              const actions = Array.isArray(o.ai_actions) ? o.ai_actions : [];
              return (
                <tr key={o.id} className="border-b border-border/50">
                  <td className="py-2">{o.offer_number}</td>
                  <td className="truncate max-w-[180px]">{o.customer_name}</td>
                  <td className="text-right tabular-nums">{eur(offerValue(o))}</td>
                  <td className="text-right tabular-nums">
                    <span className={cn(s.band === 'hot' && 'text-emerald-500', s.band === 'cold' && 'text-destructive')}>
                      {s.band === 'hot' && <Flame className="h-3 w-3 inline mr-1" />}{s.score}
                    </span>
                  </td>
                  <td className="text-right tabular-nums">{Math.round(probabilityOf(o) * 100)} %</td>
                  <td className="pl-3 text-muted-foreground max-w-[320px] truncate" title={o.ai_reason ?? ''}>
                    {actions[0] ?? o.ai_reason ?? '—'}
                  </td>
                  <td className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => setPicked(o)}>
                      <CalendarClock className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <OfferEditDialog offer={picked} onClose={() => setPicked(null)} onSaved={onRefresh} />
    </Card>
  );
}

/* ------------------------------------------------------------ GF-Cockpit */

export function ExecutiveSection({ offers }: { offers: OfferRow[] }) {
  const open = offers.filter((o) => !o.declined_at && o.status !== 'order' && o.status !== 'signed');
  const top = [...open].sort((a, b) => offerValue(b) - offerValue(a)).slice(0, 10);
  const risk = open.filter((o) => (daysSince(offerDate(o)) ?? 0) > 14);
  const fc = computeForecast(offers);
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card className="p-5 space-y-3">
        <h3 className="font-display font-semibold text-sm">Top-10 Angebote</h3>
        <ul className="space-y-1">
          {top.map((o) => (
            <li key={o.id} className="flex items-center justify-between text-xs border-b border-border/50 py-1.5">
              <span className="truncate">{o.customer_name} · {o.offer_number}</span>
              <span className="tabular-nums font-medium">{eur(offerValue(o))}</span>
            </li>
          ))}
        </ul>
      </Card>
      <div className="space-y-4">
        <Card className="p-5 space-y-2">
          <h3 className="font-display font-semibold text-sm">Pipeline-Gesundheit</h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-lg font-bold tabular-nums">{open.length}</div>
              <div className="text-[11px] text-muted-foreground">offen</div>
            </div>
            <div>
              <div className="text-lg font-bold tabular-nums text-destructive">{risk.length}</div>
              <div className="text-[11px] text-muted-foreground">Risiko &gt; 14 Tage</div>
            </div>
            <div>
              <div className="text-lg font-bold tabular-nums">{eur(fc.quarter.weighted)}</div>
              <div className="text-[11px] text-muted-foreground">Quartals-Forecast</div>
            </div>
          </div>
        </Card>
        <Card className="p-5 space-y-2">
          <h3 className="font-display font-semibold text-sm">Risiko-Angebote</h3>
          <ul className="space-y-1 max-h-52 overflow-y-auto">
            {risk.slice(0, 20).map((o) => (
              <li key={o.id} className="flex items-center justify-between text-xs py-1">
                <span className="truncate">{o.customer_name}</span>
                <span className="text-destructive tabular-nums">{daysSince(offerDate(o))} Tage</span>
              </li>
            ))}
            {risk.length === 0 && <p className="text-xs text-muted-foreground">Keine Risiko-Angebote.</p>}
          </ul>
        </Card>
      </div>
    </div>
  );
}

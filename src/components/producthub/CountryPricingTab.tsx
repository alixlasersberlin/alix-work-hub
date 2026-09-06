import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  PH_PRICE_COUNTRIES, PH_RENT_TERMS, PhCountryPrice, convertAmount, effectivePrice,
  formatMoney, readCountryPrice, rentBaseAmount, rentMonthly, depositAmount,
  readPowerTier, uvpForPower, effectivePriceForPower, type PhPowerTier,
} from '@/lib/producthub/countryPricing';
import { PH_DEFAULT_POWERS } from '@/lib/producthub/deviceConfig';


interface Props {
  value: any;
  disabled?: boolean;
  /** Auswahl aus dem Reiter „Konfiguration“ (ph_products.config_powers) */
  powers?: string[] | null;
  onChange: (next: any) => void;
}

/** Preise je Land (Deutschland, Österreich, USA, Vietnam, Dubai) mit Brutto/Netto-Umschalter. */
export function CountryPricingTab({ value, disabled, powers, onChange }: Props) {
  const [active, setActive] = useState(PH_PRICE_COUNTRIES[0].code);
  const [view, setView] = useState<'net' | 'gross'>('net');

  // Immer alle Standard-Leistungsstufen anbieten (inkl. 5000 W), ergänzt um produktspezifische Werte.
  const powerOptions = Array.from(
    new Set([...(PH_DEFAULT_POWERS as readonly string[]), ...((powers || []) as string[])].map(p => String(p).trim()).filter(Boolean)),
  );
  const def = PH_PRICE_COUNTRIES.find(c => c.code === active)!;
  const price = readCountryPrice(value, def);

  const patch = (p: Partial<PhCountryPrice>) =>
    onChange({ ...(value && typeof value === 'object' ? value : {}), [def.code]: { ...price, ...p } });

  const show = (v: number | null) => {
    const n = Number(v || 0);
    if (!n) return '—';
    return formatMoney(convertAmount(n, price.input_mode, view, price.vat_rate), def, price.currency);
  };

  return (
    <Card><CardContent className="p-4 space-y-5">
      {/* Länderauswahl */}
      <div className="flex flex-wrap gap-2">
        {PH_PRICE_COUNTRIES.map(c => {
          const p = readCountryPrice(value, c);
          return (
            <Button key={c.code} type="button" size="sm"
              variant={c.code === active ? 'default' : 'outline'}
              onClick={() => setActive(c.code)} className="gap-2">
              <span>{c.flag}</span>{c.label}
              {p.public && <Badge variant="secondary" className="ml-1 text-[10px]">online</Badge>}
            </Button>
          );
        })}
      </div>

      {disabled && (
        <p className="rounded-md border border-border bg-secondary/50 p-3 text-xs text-muted-foreground">
          Preise sind für alle sichtbar. Änderungen darf ausschließlich der Super Admin vornehmen.
        </p>
      )}

      {/* Brutto / Netto Umschalter */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
        <div>
          <Label className="text-sm">Anzeige: {view === 'net' ? 'Netto' : 'Brutto'}</Label>
          <p className="text-xs text-muted-foreground">
            Eingetragen werden {price.input_mode === 'net' ? 'Netto' : 'Brutto'}-Beträge · Steuersatz {price.vat_rate}%
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs">Netto</span>
            <Switch checked={view === 'gross'} onCheckedChange={v => setView(v ? 'gross' : 'net')} />
            <span className="text-xs">Brutto</span>
          </div>
          <div className="flex items-center gap-2 border-l border-border pl-4">
            <span className="text-xs text-muted-foreground">Eingabe als</span>
            <select className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={price.input_mode} disabled={disabled}
              onChange={e => patch({ input_mode: e.target.value as 'net' | 'gross' })}>
              <option value="net">Netto</option>
              <option value="gross">Brutto</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
        <div>
          <Label className="text-sm">Preise für {def.label} auf der Webseite anzeigen</Label>
          <p className="text-xs text-muted-foreground">Standard: unsichtbar.</p>
        </div>
        <Switch checked={price.public} disabled={disabled} onCheckedChange={v => patch({ public: v })} />
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Währung</Label>
          <Input value={price.currency} disabled={disabled}
            onChange={e => patch({ currency: e.target.value.toUpperCase() })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Steuersatz (%)</Label>
          <Input type="number" step="0.1" value={price.vat_rate ?? ''} disabled={disabled}
            onChange={e => patch({ vat_rate: e.target.value === '' ? 0 : Number(e.target.value) })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">UVP ({price.input_mode === 'net' ? 'netto' : 'brutto'})</Label>
          <Input type="number" step="0.01" value={price.uvp ?? ''} disabled={disabled}
            onChange={e => patch({ uvp: e.target.value === '' ? null : Number(e.target.value) })} />
          <p className="text-xs text-muted-foreground">{view === 'net' ? 'Netto' : 'Brutto'}: {show(price.uvp)}</p>
        </div>
      </div>

      {([
        { label: 'VK Minimal', mode: 'vk_min_mode', val: 'vk_min_value', which: 'min' },
        { label: 'VK Maximal', mode: 'vk_max_mode', val: 'vk_max_value', which: 'max' },
      ] as const).map(row => {
        const isPct = price[row.mode] === 'percent';
        const eff = effectivePrice(price, row.which);
        return (
          <div key={row.mode} className="grid md:grid-cols-3 gap-3 items-end rounded-lg border border-border p-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{row.label} – Regulierung</Label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={price[row.mode]} disabled={disabled}
                onChange={e => patch({ [row.mode]: e.target.value } as any)}>
                <option value="fixed">Festpreis ({price.currency})</option>
                <option value="percent">Prozent vom UVP (%)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{isPct ? (row.which === 'min' ? 'Abschlag vom UVP in % (z. B. 15)' : 'Abweichung in % (z. B. -15)') : `Festpreis in ${price.currency}`}</Label>
              <Input type="number" step="0.01" value={price[row.val] ?? ''} disabled={disabled}
                onChange={e => patch({ [row.val]: e.target.value === '' ? null : Number(e.target.value) } as any)} />
            </div>
            <p className="text-xs text-muted-foreground pb-2">
              Ergibt ({view === 'net' ? 'netto' : 'brutto'}): {eff
                ? formatMoney(convertAmount(eff, price.input_mode, view, price.vat_rate), def, price.currency)
                : '—'}
            </p>
          </div>
        );
      })}

      {/* Staffelung nach Leistung Lasermodul */}
      <div className="space-y-3 rounded-lg border border-border p-3">
        <div>
          <Label className="text-sm">Staffelung nach „Leistung Lasermodul“</Label>
          <p className="text-xs text-muted-foreground">
            Je Leistung ein Aufschlag auf den UVP oder ein eigener UVP. Nicht aktivierte Leistungen nutzen den Standard-UVP.
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          {powerOptions.map(pw => {
            const t = readPowerTier(price, pw);
            const setTier = (patchTier: Partial<PhPowerTier>) => patch({
              power_tiers: { ...((price as any).power_tiers || {}), [pw]: { ...t, ...patchTier } },
            } as any);
            const uvpPw = uvpForPower(price, pw);
            return (
              <div key={pw} className="space-y-2 rounded-md border border-border p-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">{pw}</Label>
                  <Switch checked={t.enabled} disabled={disabled}
                    onCheckedChange={v => setTier({ enabled: v })} />
                </div>
                <select className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                  value={t.mode} disabled={disabled || !t.enabled}
                  onChange={e => setTier({ mode: e.target.value as PhPowerTier['mode'] })}>
                  <option value="surcharge_percent">Aufschlag in % vom UVP</option>
                  <option value="surcharge_fixed">Aufschlag als Betrag ({price.currency})</option>
                  <option value="price_fixed">Eigener UVP ({price.currency})</option>
                </select>
                <Input type="number" step="0.01" value={t.value ?? ''} disabled={disabled || !t.enabled}
                  placeholder={t.mode === 'surcharge_percent' ? 'z. B. 7.5' : `Betrag in ${price.currency}`}
                  onChange={e => setTier({ value: e.target.value === '' ? null : Number(e.target.value) })} />
                <p className="text-xs text-muted-foreground">
                  UVP: {show(uvpPw)} · VK Min: {show(effectivePriceForPower(price, 'min', pw))} · VK Max: {show(effectivePriceForPower(price, 'max', pw))}
                </p>
              </div>
            );
          })}
          {powerOptions.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Für dieses Gerät sind unter „Konfiguration“ noch keine Leistungen hinterlegt.
            </p>
          )}
        </div>
      </div>


      {/* Miete */}
      <div className="space-y-4 rounded-lg border border-border p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Switch checked={price.rent_active} disabled={disabled}
              onCheckedChange={v => patch({ rent_active: v })} />
            <div>
              <Label className="text-sm">Miete anbieten ({def.label})</Label>
              <p className="text-xs text-muted-foreground">Laufzeiten 12, 24 oder 36 Monate – Preis aus dem VK-Preis.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Auf der Webseite anzeigen</span>
            <Switch checked={price.rent_public} disabled={disabled || !price.rent_active}
              onCheckedChange={v => patch({ rent_public: v })} />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Berechnungsbasis</Label>
            <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={price.rent_base} disabled={disabled || !price.rent_active}
              onChange={e => patch({ rent_base: e.target.value as any })}>
              <option value="vk_min">VK Minimal</option>
              <option value="vk_max">VK Maximal</option>
              <option value="uvp">UVP</option>
            </select>
            <p className="text-xs text-muted-foreground">
              Basis ({view === 'net' ? 'netto' : 'brutto'}): {show(rentBaseAmount(price))}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Hinweis zur Miete (optional)</Label>
            <Input value={price.rent_note} disabled={disabled || !price.rent_active}
              placeholder="z. B. inkl. Wartung, zzgl. Verbrauchsmaterial"
              onChange={e => patch({ rent_note: e.target.value })} />
          </div>
        </div>

        {/* Kaution – Teil der Miete */}
        <div className="grid md:grid-cols-4 gap-3 items-end border-t border-border pt-3">
          <div className="flex items-center gap-3">
            <Switch checked={price.deposit_active} disabled={disabled || !price.rent_active}
              onCheckedChange={v => patch({ deposit_active: v })} />
            <Label className="text-sm">Kaution</Label>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Berechnung</Label>
            <select className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={price.deposit_mode}
              disabled={disabled || !price.rent_active || !price.deposit_active}
              onChange={e => patch({ deposit_mode: e.target.value as any })}>
              <option value="percent">% der Basis</option>
              <option value="fixed">Fester Betrag ({price.currency})</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Wert</Label>
            <Input type="number" step="0.01" value={price.deposit_value ?? ''}
              disabled={disabled || !price.rent_active || !price.deposit_active}
              placeholder={price.deposit_mode === 'percent' ? 'z. B. 10' : `Betrag in ${price.currency}`}
              onChange={e => patch({ deposit_value: e.target.value === '' ? null : Number(e.target.value) })} />
            <p className="text-xs text-muted-foreground">
              Kaution ({view === 'net' ? 'netto' : 'brutto'}): {show(depositAmount(price))}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Hinweis zur Kaution (optional)</Label>
            <Input value={price.deposit_note}
              disabled={disabled || !price.rent_active || !price.deposit_active}
              placeholder="z. B. Rückzahlung nach Rückgabe"
              onChange={e => patch({ deposit_note: e.target.value })} />
          </div>
        </div>


        <div className="grid md:grid-cols-3 gap-3">
          {PH_RENT_TERMS.map(term => {
            const cfg = price.rent_terms[String(term)];
            const setTerm = (p: any) => patch({
              rent_terms: { ...price.rent_terms, [String(term)]: { ...cfg, ...p } },
            });
            return (
              <div key={term} className="space-y-2 rounded-md border border-border p-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">{term} Monate</Label>
                  <Switch checked={cfg.enabled} disabled={disabled || !price.rent_active}
                    onCheckedChange={v => setTerm({ enabled: v })} />
                </div>
                <select className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                  value={cfg.mode} disabled={disabled || !price.rent_active || !cfg.enabled}
                  onChange={e => setTerm({ mode: e.target.value })}>
                  <option value="percent">% der Basis pro Monat</option>
                  <option value="fixed">Fester Monatsbetrag ({price.currency})</option>
                </select>
                <Input type="number" step="0.01" value={cfg.value ?? ''}
                  disabled={disabled || !price.rent_active || !cfg.enabled}
                  placeholder={cfg.mode === 'percent' ? 'z. B. 3.5' : `Betrag in ${price.currency}`}
                  onChange={e => setTerm({ value: e.target.value === '' ? null : Number(e.target.value) })} />
                <p className="text-xs text-muted-foreground">
                  Monatlich ({view === 'net' ? 'netto' : 'brutto'}): {show(rentMonthly(price, term))}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-border p-3">
        <div className="flex items-center gap-3">
          <Switch checked={price.promo_active} disabled={disabled}
            onCheckedChange={v => patch({ promo_active: v })} />
          <Label className="text-xs">Sonderaktion aktiv ({def.label})</Label>
        </div>
        <div className="space-y-1.5 max-w-md">
          <Label className="text-xs">Name der Sonderaktion</Label>
          <Input value={price.promo_name} disabled={disabled || !price.promo_active}
            placeholder="z. B. Sommeraktion 2026"
            onChange={e => patch({ promo_name: e.target.value })} />
        </div>
      </div>

    </CardContent></Card>
  );
}

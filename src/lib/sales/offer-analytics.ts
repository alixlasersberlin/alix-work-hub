// Vertriebs-Cockpit — Auswertungslogik für Angebote (Angebotsanalyse).
// Reine Berechnungs-/Ableitungsschicht, keine UI, keine Mutationen.

export interface OfferRow {
  id: string;
  offer_number: string | null;
  offer_date: string | null;
  valid_until: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  total_net: number | null;
  total_gross: number | null;
  status: string | null;
  signed_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  declined_reason: string | null;
  created_at: string | null;
  created_by: string | null;
  created_by_name: string | null;
  payload: any;
  stage: string | null;
  loss_reason: string | null;
  competitor: string | null;
  lead_source: string | null;
  financing_type: string | null;
  product_category: string | null;
  discount_percent: number | null;
  win_probability: number | null;
  offer_score: number | null;
  ai_probability: number | null;
  ai_reason: string | null;
  ai_actions: any;
  ai_scored_at: string | null;
  last_contact_at: string | null;
  next_followup_at: string | null;
  followup_note: string | null;
  expected_close_date: string | null;
  opened_at: string | null;
}

/* ---------------------------------------------------------------- Stammdaten */

export const STAGES = [
  { code: 'interessent', label: 'Interessent' },
  { code: 'beratung', label: 'Beratung' },
  { code: 'angebot_erstellt', label: 'Angebot erstellt' },
  { code: 'angebot_versendet', label: 'Angebot versendet' },
  { code: 'nachfassen', label: 'Nachfassen' },
  { code: 'verhandlung', label: 'Verhandlung' },
  { code: 'finanzierung', label: 'Finanzierung' },
  { code: 'bestellung', label: 'Bestellung' },
  { code: 'geliefert', label: 'Geliefert' },
  { code: 'abgeschlossen', label: 'Abgeschlossen' },
] as const;

export const LOSS_REASONS = [
  'Preis', 'Leasing abgelehnt', 'Konkurrenz', 'Kein Bedarf', 'Zeit',
  'Keine Finanzierung', 'Nicht erreichbar', 'Kein Vertrauen', 'Anderer Hersteller', 'Sonstige',
];

export const COMPETITORS = ['Asclepion', 'Lumenis', 'Candela', 'Alma', 'InMode', 'Andere'];

export const FINANCING_TYPES = ['Barzahlung', 'Leasing', 'Miete', 'Ratenzahlung', 'Bank'];

export const LEAD_SOURCES = [
  'Google', 'Instagram', 'Facebook', 'TikTok', 'Empfehlung', 'Messe',
  'Bestandskunde', 'Telefon', 'Website', 'Partner', 'Affiliate',
];

export const PRODUCTS = ['BlueIce', 'Fusion', 'SkinMaster', 'HeadSpa', 'Hydrafacial', 'CO₂', 'PMU'];

const PRODUCT_MATCHERS: { label: string; re: RegExp }[] = [
  { label: 'BlueIce', re: /blue\s?ice/i },
  { label: 'Fusion', re: /fusion/i },
  { label: 'SkinMaster', re: /skin\s?master/i },
  { label: 'HeadSpa', re: /head\s?spa/i },
  { label: 'Hydrafacial', re: /hydra\s?facial/i },
  { label: 'CO₂', re: /co2|co₂/i },
  { label: 'PMU', re: /\bpmu\b/i },
];

/* ------------------------------------------------------------------ Helpers */

export const eur = (n: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);

export const pct = (n: number, digits = 0) => `${(n * 100).toFixed(digits)} %`;

export const offerValue = (o: OfferRow) => Number(o.total_gross ?? o.total_net ?? 0);

export const offerDate = (o: OfferRow) => new Date(o.offer_date || o.created_at || Date.now());

export const daysSince = (d?: string | Date | null) => {
  if (!d) return null;
  const t = typeof d === 'string' ? new Date(d) : d;
  return Math.floor((Date.now() - t.getTime()) / 86_400_000);
};

export const isWon = (o: OfferRow) =>
  o.status === 'order' || o.status === 'signed' || !!o.signed_at || !!o.accepted_at ||
  o.stage === 'abgeschlossen' || o.stage === 'geliefert' || o.stage === 'bestellung';

export const isLost = (o: OfferRow) => !!o.declined_at || !!o.loss_reason;

export const isOpen = (o: OfferRow) => !isWon(o) && !isLost(o);

/** Produktkategorie: gepflegtes Feld, sonst aus Positionen des Angebots abgeleitet. */
export function productOf(o: OfferRow): string {
  if (o.product_category) return o.product_category;
  const items = Array.isArray(o.payload?.items) ? o.payload.items : [];
  const text = [items.map((i: any) => `${i?.name ?? ''} ${i?.description ?? ''} ${i?.sku ?? ''}`).join(' '), o.payload?.title ?? '']
    .join(' ');
  const hit = PRODUCT_MATCHERS.find((m) => m.re.test(text));
  return hit?.label ?? 'Sonstige';
}

export function stageOf(o: OfferRow): string {
  if (o.stage) return o.stage;
  if (isWon(o)) return 'abgeschlossen';
  return 'angebot_erstellt';
}

export function discountOf(o: OfferRow): number {
  if (o.discount_percent != null) return Number(o.discount_percent);
  const d = Number(o.payload?.discount_percent ?? o.payload?.discountPercent ?? 0);
  return Number.isFinite(d) ? d : 0;
}

/* ------------------------------------------------------------- Angebots-Score */

export interface ScoreDetail { label: string; points: number; hit: boolean }

export function offerScore(o: OfferRow): { score: number; details: ScoreDetail[]; band: 'hot' | 'warm' | 'cold' } {
  const age = daysSince(offerDate(o)) ?? 999;
  const details: ScoreDetail[] = [
    { label: 'Kunde telefonisch erreicht', points: 10, hit: !!o.last_contact_at },
    { label: 'Termin vereinbart', points: 10, hit: !!o.next_followup_at },
    { label: 'Finanzierung vorhanden', points: 15, hit: !!o.financing_type && o.financing_type !== 'Barzahlung' },
    { label: 'Angebot geöffnet', points: 10, hit: !!o.opened_at || !!o.payload?.portal_opened_at },
    { label: 'Angebotsalter < 7 Tage', points: 10, hit: age < 7 },
    { label: 'Nachfassanruf erfolgt', points: 10, hit: (daysSince(o.last_contact_at) ?? 999) <= 7 },
    { label: 'Dokumente vollständig', points: 10, hit: Array.isArray(o.payload?.items) && o.payload.items.length > 0 },
    { label: 'Bonitätsprüfung positiv', points: 15, hit: o.payload?.credit_check === 'ok' || o.payload?.credit_score_band === 'green' },
    { label: 'KI-Kaufwahrscheinlichkeit hoch', points: 10, hit: Number(o.ai_probability ?? 0) >= 0.7 },
  ];
  const score = Math.min(100, details.filter((d) => d.hit).reduce((s, d) => s + d.points, 0));
  const band = score >= 80 ? 'hot' : score >= 50 ? 'warm' : 'cold';
  return { score, details, band };
}

export const bandLabel = (b: 'hot' | 'warm' | 'cold') =>
  b === 'hot' ? 'Hot Deal' : b === 'warm' ? 'Warm Deal' : 'Cold Deal';

/** Abschlusswahrscheinlichkeit für Forecast: KI > manuell > Score-Heuristik. */
export function probabilityOf(o: OfferRow): number {
  if (o.ai_probability != null) return Number(o.ai_probability);
  if (o.win_probability != null) return Number(o.win_probability) / (Number(o.win_probability) > 1 ? 100 : 1);
  return offerScore(o).score / 100;
}

/* --------------------------------------------------------------------- KPIs */

export interface Kpis {
  openValue: number;
  openCount: number;
  avgValue: number;
  todayCount: number;
  monthCount: number;
  winRate: number;
  avgDaysToClose: number;
  avgDiscount: number;
  expectedRevenue: number;
}

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
const inMonth = (d: Date, ref: Date) => d.getMonth() === ref.getMonth() && d.getFullYear() === ref.getFullYear();

export function computeKpis(offers: OfferRow[], ref = new Date()): Kpis {
  const open = offers.filter(isOpen);
  const won = offers.filter(isWon);
  const closed = [...won, ...offers.filter(isLost)];
  const closeDays = won
    .map((o) => {
      const end = o.signed_at || o.accepted_at;
      return end ? Math.max(0, (new Date(end).getTime() - offerDate(o).getTime()) / 86_400_000) : null;
    })
    .filter((n): n is number => n != null);
  const discounts = offers.map(discountOf).filter((n) => n > 0);

  return {
    openValue: open.reduce((s, o) => s + offerValue(o), 0),
    openCount: open.length,
    avgValue: offers.length ? offers.reduce((s, o) => s + offerValue(o), 0) / offers.length : 0,
    todayCount: offers.filter((o) => sameDay(offerDate(o), ref)).length,
    monthCount: offers.filter((o) => inMonth(offerDate(o), ref)).length,
    winRate: closed.length ? won.length / closed.length : 0,
    avgDaysToClose: closeDays.length ? closeDays.reduce((s, n) => s + n, 0) / closeDays.length : 0,
    avgDiscount: discounts.length ? discounts.reduce((s, n) => s + n, 0) / discounts.length : 0,
    expectedRevenue: open.reduce((s, o) => s + offerValue(o) * probabilityOf(o), 0),
  };
}

export function previousMonthOffers(offers: OfferRow[], ref = new Date()) {
  const prev = new Date(ref.getFullYear(), ref.getMonth() - 1, 15);
  return offers.filter((o) => inMonth(offerDate(o), prev));
}

export function currentMonthOffers(offers: OfferRow[], ref = new Date()) {
  return offers.filter((o) => inMonth(offerDate(o), ref));
}

export const delta = (now: number, before: number) => (before ? (now - before) / before : now ? 1 : 0);

/* ------------------------------------------------------------------ Trichter */

export interface FunnelRow { code: string; label: string; count: number; value: number; share: number; avgDays: number }

export function computeFunnel(offers: OfferRow[]): FunnelRow[] {
  const total = offers.length || 1;
  return STAGES.map((s) => {
    const rows = offers.filter((o) => stageOf(o) === s.code);
    const days = rows.map((o) => daysSince(offerDate(o)) ?? 0);
    return {
      code: s.code,
      label: s.label,
      count: rows.length,
      value: rows.reduce((sum, o) => sum + offerValue(o), 0),
      share: rows.length / total,
      avgDays: days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : 0,
    };
  });
}

/* -------------------------------------------------------------- Angebotsalter */

export const AGE_BUCKETS = [
  { label: 'Heute', min: 0, max: 0 },
  { label: '1–3 Tage', min: 1, max: 3 },
  { label: '4–7 Tage', min: 4, max: 7 },
  { label: '8–14 Tage', min: 8, max: 14 },
  { label: '15–30 Tage', min: 15, max: 30 },
  { label: 'über 30 Tage', min: 31, max: 99999 },
];

export function computeAges(offers: OfferRow[]) {
  const open = offers.filter(isOpen);
  return AGE_BUCKETS.map((b) => {
    const rows = open.filter((o) => {
      const d = daysSince(offerDate(o)) ?? 0;
      return d >= b.min && d <= b.max;
    });
    return { ...b, count: rows.length, value: rows.reduce((s, o) => s + offerValue(o), 0), critical: b.min > 14 };
  });
}

/* ----------------------------------------------------------- Verkäufer-Ranking */

export interface RepRow {
  name: string;
  count: number;
  volume: number;
  won: number;
  lost: number;
  rate: number;
  revenue: number;
  commission: number;
  avgValue: number;
  avgDays: number;
}

export function computeReps(offers: OfferRow[], commissionRate = 0.03): RepRow[] {
  const map = new Map<string, OfferRow[]>();
  offers.forEach((o) => {
    const key = o.created_by_name?.trim() || 'Unbekannt';
    map.set(key, [...(map.get(key) ?? []), o]);
  });
  return Array.from(map.entries())
    .map(([name, rows]) => {
      const won = rows.filter(isWon);
      const lost = rows.filter(isLost);
      const revenue = won.reduce((s, o) => s + offerValue(o), 0);
      const days = won
        .map((o) => {
          const end = o.signed_at || o.accepted_at;
          return end ? (new Date(end).getTime() - offerDate(o).getTime()) / 86_400_000 : null;
        })
        .filter((n): n is number => n != null);
      return {
        name,
        count: rows.length,
        volume: rows.reduce((s, o) => s + offerValue(o), 0),
        won: won.length,
        lost: lost.length,
        rate: won.length + lost.length ? won.length / (won.length + lost.length) : 0,
        revenue,
        commission: revenue * commissionRate,
        avgValue: rows.length ? rows.reduce((s, o) => s + offerValue(o), 0) / rows.length : 0,
        avgDays: days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

/* -------------------------------------------------------- Gruppierte Analysen */

export interface GroupRow {
  key: string;
  count: number;
  value: number;
  won: number;
  lost: number;
  rate: number;
  avgPrice: number;
  avgDiscount: number;
}

export function groupBy(offers: OfferRow[], keyFn: (o: OfferRow) => string | null): GroupRow[] {
  const map = new Map<string, OfferRow[]>();
  offers.forEach((o) => {
    const k = keyFn(o);
    if (!k) return;
    map.set(k, [...(map.get(k) ?? []), o]);
  });
  return Array.from(map.entries())
    .map(([key, rows]) => {
      const won = rows.filter(isWon).length;
      const lost = rows.filter(isLost).length;
      const discounts = rows.map(discountOf).filter((n) => n > 0);
      return {
        key,
        count: rows.length,
        value: rows.reduce((s, o) => s + offerValue(o), 0),
        won,
        lost,
        rate: won + lost ? won / (won + lost) : 0,
        avgPrice: rows.length ? rows.reduce((s, o) => s + offerValue(o), 0) / rows.length : 0,
        avgDiscount: discounts.length ? discounts.reduce((a, b) => a + b, 0) / discounts.length : 0,
      };
    })
    .sort((a, b) => b.count - a.count);
}

/* ------------------------------------------------------------------- Heatmap */

const WEEKDAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
export const HOUR_SLOTS = ['08-10', '10-12', '12-14', '14-16', '16-18', '18-20'];

export function computeHeatmap(offers: OfferRow[]) {
  const grid: Record<string, Record<string, { count: number; won: number }>> = {};
  WEEKDAYS.forEach((d) => {
    grid[d] = {};
    HOUR_SLOTS.forEach((h) => { grid[d][h] = { count: 0, won: 0 }; });
  });
  offers.forEach((o) => {
    const d = new Date(o.created_at || o.offer_date || Date.now());
    const day = WEEKDAYS[(d.getDay() + 6) % 7];
    const hour = d.getHours();
    const slot = HOUR_SLOTS.find((s) => hour >= Number(s.slice(0, 2)) && hour < Number(s.slice(3, 5)));
    if (!slot) return;
    grid[day][slot].count += 1;
    if (isWon(o)) grid[day][slot].won += 1;
  });
  return { weekdays: WEEKDAYS, slots: HOUR_SLOTS, grid };
}

/* ------------------------------------------------------- Nachfassen / Wiedervorlage */

export function computeFollowups(offers: OfferRow[]) {
  const open = offers.filter(isOpen);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 86_400_000);
  const weekEnd = new Date(today.getTime() + 7 * 86_400_000);
  const contactAge = (o: OfferRow) => daysSince(o.last_contact_at) ?? 9999;

  return {
    calledToday: open.filter((o) => o.last_contact_at && new Date(o.last_contact_at) >= today),
    calledYesterday: open.filter((o) => {
      if (!o.last_contact_at) return false;
      const t = new Date(o.last_contact_at);
      return t >= new Date(today.getTime() - 86_400_000) && t < today;
    }),
    stale7: open.filter((o) => contactAge(o) >= 7 && contactAge(o) < 14),
    stale14: open.filter((o) => contactAge(o) >= 14),
    dueToday: open.filter((o) => o.next_followup_at && new Date(o.next_followup_at) >= today && new Date(o.next_followup_at) < tomorrow),
    dueTomorrow: open.filter((o) => o.next_followup_at && new Date(o.next_followup_at) >= tomorrow && new Date(o.next_followup_at) < new Date(tomorrow.getTime() + 86_400_000)),
    dueWeek: open.filter((o) => o.next_followup_at && new Date(o.next_followup_at) >= today && new Date(o.next_followup_at) < weekEnd),
    overdue: open.filter((o) => o.next_followup_at && new Date(o.next_followup_at) < today),
  };
}

/* ------------------------------------------------------------------ Forecast */

export function computeForecast(offers: OfferRow[], ref = new Date()) {
  const open = offers.filter(isOpen);
  const bucket = (from: Date, to: Date) =>
    open
      .filter((o) => {
        const d = o.expected_close_date ? new Date(o.expected_close_date) : new Date(offerDate(o).getTime() + 30 * 86_400_000);
        return d >= from && d < to;
      })
      .reduce((s, o) => ({ value: s.value + offerValue(o), weighted: s.weighted + offerValue(o) * probabilityOf(o), count: s.count + 1 }), { value: 0, weighted: 0, count: 0 });

  const mStart = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const mNext = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
  const mAfter = new Date(ref.getFullYear(), ref.getMonth() + 2, 1);
  const qEnd = new Date(ref.getFullYear(), Math.floor(ref.getMonth() / 3) * 3 + 3, 1);

  return {
    thisMonth: bucket(mStart, mNext),
    nextMonth: bucket(mNext, mAfter),
    quarter: bucket(mStart, qEnd),
  };
}

/* --------------------------------------------------------- Kartenansicht (PLZ) */

export function offerLocation(o: OfferRow): { plz: string | null; city: string | null } {
  const p = o.payload?.customer ?? o.payload ?? {};
  const plz = String(p.postal_code ?? p.zip ?? p.plz ?? '').match(/\d{4,5}/)?.[0] ?? null;
  const city = p.city ?? p.ort ?? null;
  return { plz, city: city ? String(city) : null };
}

export function offerPinColor(o: OfferRow): 'hot' | 'open' | 'overdue' {
  const age = daysSince(offerDate(o)) ?? 0;
  if (age > 14) return 'overdue';
  if (offerScore(o).score >= 80) return 'hot';
  return 'open';
}

export function computePlzZones(offers: OfferRow[]) {
  const open = offers.filter(isOpen);
  const zones = new Map<string, { count: number; value: number; hot: number; overdue: number }>();
  open.forEach((o) => {
    const { plz } = offerLocation(o);
    const zone = plz ? `${plz[0]}0000er` : 'Ohne PLZ';
    const cur = zones.get(zone) ?? { count: 0, value: 0, hot: 0, overdue: 0 };
    cur.count += 1;
    cur.value += offerValue(o);
    const color = offerPinColor(o);
    if (color === 'hot') cur.hot += 1;
    if (color === 'overdue') cur.overdue += 1;
    zones.set(zone, cur);
  });
  return Array.from(zones.entries()).map(([zone, v]) => ({ zone, ...v })).sort((a, b) => b.value - a.value);
}

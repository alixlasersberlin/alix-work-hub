// Deterministic mock aggregations for ABIC – no DB writes, no schema changes.
// Numbers are illustrative only; replace by real read-only queries later.

import type { AbicSectionConfig, ChartDef, Kpi, TimeSeriesPoint } from "./types";

function seed(n: number) {
  let s = n;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function series(len: number, base: number, variance: number, seedNum = 1): TimeSeriesPoint[] {
  const r = seed(seedNum);
  const now = new Date();
  return Array.from({ length: len }).map((_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (len - i - 1));
    return { t: d.toISOString().slice(0, 10), v: Math.round(base + (r() - 0.5) * variance) };
  });
}

function multiSeries(len: number, keys: string[], base: number, variance: number, seedNum = 1) {
  const r = seed(seedNum);
  const now = new Date();
  return Array.from({ length: len }).map((_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (len - i - 1));
    const row: TimeSeriesPoint = { t: d.toISOString().slice(0, 10), v: 0 };
    keys.forEach((k) => (row[k] = Math.round(base + (r() - 0.5) * variance)));
    return row;
  });
}

function categorical(items: string[], base: number, variance: number, seedNum = 1) {
  const r = seed(seedNum);
  return items.map((name) => ({ t: name, v: Math.round(base + (r() - 0.5) * variance) })) as TimeSeriesPoint[];
}

// ---- Section factory ------------------------------------------------------
const kpi = (id: string, label: string, value: number | string, opts: Partial<Kpi> = {}): Kpi => ({
  id, label, value, trend: "up", delta: 4.2, ...opts,
});

export const abicSections: Record<string, AbicSectionConfig> = {
  executive: {
    key: "executive",
    title: "Executive Dashboard",
    subtitle: "Echtzeit-Cockpit der Geschäftsleitung",
    kpis: [
      kpi("rev_today", "Umsatz heute", 24800, { format: "currency", delta: 3.4, drill: "/abic/sales" }),
      kpi("rev_month", "Umsatz Monat", 486300, { format: "currency", delta: 6.1, drill: "/abic/sales" }),
      kpi("rev_year", "Umsatz Jahr", 4820000, { format: "currency", delta: 12.5, drill: "/abic/sales" }),
      kpi("open_offers", "Offene Angebote", 78, { delta: -1.8, trend: "down", drill: "/abic/sales" }),
      kpi("close_rate", "Abschlussquote", 34, { format: "percent", delta: 2.1, drill: "/abic/sales" }),
      kpi("open_service", "Offene Einsätze", 41, { drill: "/abic/service" }),
      kpi("sla", "SLA-Erfüllung", 96, { format: "percent", drill: "/abic/service" }),
      kpi("trainings_month", "Schulungen Monat", 27, { drill: "/abic/training" }),
      kpi("apts_today", "Termine heute", 63, { drill: "/abic/operations" }),
      kpi("utilization", "Auslastung", 82, { format: "percent", drill: "/abic/employees" }),
      kpi("new_customers", "Neukunden Monat", 34, { drill: "/abic/customers" }),
      kpi("open_tickets", "Offene Tickets", 12, { trend: "down", delta: -8, drill: "/abic/service" }),
    ],
    charts: [
      { id: "rev_trend", title: "Umsatzentwicklung (90 Tage)", type: "area", data: series(90, 16000, 8000, 11) },
      { id: "orders_by_region", title: "Umsatz nach Region", type: "bar", data: categorical(["DE","AT","CH","EU","US","AE"], 42000, 30000, 22) },
      { id: "channel_split", title: "Vertriebskanäle", type: "pie", data: categorical(["Direkt","Partner","Online","Messe"], 100, 60, 33) },
      { id: "service_load", title: "Servicelast (7 Tage)", type: "line", data: series(14, 38, 20, 44) },
    ],
  },
  sales: {
    key: "sales", title: "Sales Analytics",
    subtitle: "Vertrieb, Pipeline & Conversion",
    kpis: [
      kpi("pipeline", "Pipeline", 1_240_000, { format: "currency" }),
      kpi("avg_order", "Ø Auftragswert", 8420, { format: "currency" }),
      kpi("cycle", "Verkaufszyklus", 21, { unit: "Tage" }),
      kpi("conversion", "Conversion", 28, { format: "percent" }),
      kpi("leads", "Neue Leads", 156),
      kpi("financings", "Finanzierungen", 24),
    ],
    charts: [
      { id: "rev_month", title: "Umsatz nach Monat", type: "bar", data: categorical(["Jan","Feb","Mrz","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"], 380000, 180000, 55) },
      { id: "rev_products", title: "Top-Produkte", type: "bar", data: categorical(["Alix Pro","Alix Slim","Alix Compact","Alix Ultra","Zubehör"], 260000, 140000, 66) },
      { id: "rev_employees", title: "Umsatz nach Vertriebler", type: "bar", data: categorical(["A. Müller","B. Schmidt","C. Weber","D. Braun","E. Klein"], 180000, 100000, 77) },
      { id: "sources", title: "Leadquellen", type: "pie", data: categorical(["Empfehlung","Website","Messe","Kaltakquise","Partner"], 100, 60, 88) },
      { id: "conv_trend", title: "Conversion-Verlauf", type: "line", data: series(60, 28, 8, 99) },
    ],
  },
  service: {
    key: "service", title: "Service Analytics",
    kpis: [
      kpi("open", "Offene Einsätze", 41),
      kpi("done", "Abgeschlossen (M)", 312),
      kpi("react", "Reaktionszeit", 4.2, { unit: "h" }),
      kpi("avg_dur", "Ø Einsatzdauer", 2.8, { unit: "h" }),
      kpi("sla", "SLA-Erfüllung", 96, { format: "percent" }),
      kpi("parts", "Ersatzteilverbrauch", 184),
    ],
    charts: [
      { id: "cases_type", title: "Fälle nach Art", type: "pie", data: categorical(["Garantie","Kulanz","Reparatur","Wartung"], 100, 60, 12) },
      { id: "tech_load", title: "Technikerauslastung", type: "bar", data: categorical(["T1","T2","T3","T4","T5","T6"], 78, 20, 13) },
      { id: "react_trend", title: "Reaktionszeit-Verlauf", type: "line", data: series(60, 4.2, 1.4, 14) },
      { id: "part_use", title: "Ersatzteile Top 10", type: "bar", data: categorical(["ET-01","ET-02","ET-03","ET-04","ET-05","ET-06","ET-07","ET-08","ET-09","ET-10"], 40, 30, 15) },
    ],
  },
  training: {
    key: "training", title: "Schulungsanalytics",
    kpis: [
      kpi("booked", "Gebuchte Schulungen", 27),
      kpi("attendees", "Teilnehmer", 214),
      kpi("occupancy", "Auslastung", 78, { format: "percent" }),
      kpi("pass_rate", "Prüfungserfolg", 92, { format: "percent" }),
      kpi("avg_grade", "Ø Note", 1.9),
      kpi("rebook", "Wiederbuchungen", 34),
    ],
    charts: [
      { id: "occ_month", title: "Auslastung nach Monat", type: "line", data: series(180, 78, 20, 21) },
      { id: "by_type", title: "Präsenz vs Virtuell vs NiSV", type: "bar", data: categorical(["Präsenz","Virtuell","NiSV"], 40, 30, 22) },
      { id: "by_loc", title: "Nach Standort", type: "bar", data: categorical(["Berlin","Wien","Dubai","Miami","Riga"], 60, 40, 23) },
      { id: "by_teacher", title: "Nach Dozent", type: "bar", data: categorical(["Dr. K.","Dr. L.","Dr. M.","Dr. N."], 60, 40, 24) },
    ],
  },
  finance: {
    key: "finance", title: "Finanzanalyse (Read-Only)",
    subtitle: "Nur Anzeige aus vorhandenen Finanzmodulen",
    kpis: [
      kpi("open_inv", "Offene Rechnungen", 214_000, { format: "currency" }),
      kpi("in_pay", "Zahlungseingänge (M)", 486_000, { format: "currency" }),
      kpi("deposits", "Anzahlungen", 92_000, { format: "currency" }),
      kpi("financings", "Finanzierungen", 24 ),
      kpi("leasing", "Leasing aktiv", 11 ),
      kpi("provision", "Provisionen (M)", 34_000, { format: "currency" }),
    ],
    charts: [
      { id: "cf", title: "Zahlungsflüsse (90 Tage)", type: "area", data: series(90, 12000, 8000, 31) },
      { id: "open_ageing", title: "Offene Posten – Ageing", type: "bar", data: categorical(["0-30","31-60","61-90","90+"], 60, 40, 32) },
    ],
  },
  customers: {
    key: "customers", title: "Kundenanalytics",
    kpis: [
      kpi("new_c", "Neukunden (M)", 34),
      kpi("existing", "Bestandskunden", 1284),
      kpi("repeat", "Wiederkäufer", 46, { format: "percent" }),
      kpi("churn", "Kündigungen", 6),
      kpi("clv", "Customer Lifetime Value", 18400, { format: "currency" }),
      kpi("nps", "NPS", 62),
    ],
    charts: [
      { id: "reg", title: "Nach Region", type: "bar", data: categorical(["DE","AT","CH","EU","US","AE"], 200, 100, 41) },
      { id: "branch", title: "Nach Branche", type: "pie", data: categorical(["Klinik","Praxis","Studio","Distributor"], 100, 60, 42) },
      { id: "growth", title: "Kundenwachstum", type: "line", data: series(180, 1200, 60, 43) },
    ],
  },
  operations: {
    key: "operations", title: "Operations",
    kpis: [
      kpi("apts", "Termine heute", 63),
      kpi("conf", "Bestätigungen offen", 8),
      kpi("free_cap", "Freie Kapazitäten", 22, { format: "percent" }),
      kpi("no_show", "No-Shows (M)", 4, { format: "percent" }),
    ],
    charts: [
      { id: "heat", title: "Auslastung Wochenheatmap", type: "heatmap",
        data: (["Mo","Di","Mi","Do","Fr","Sa"]).flatMap((d, di) =>
          Array.from({ length: 10 }).map((_, h) => ({ t: `${d} ${8+h}:00`, day: d, hour: 8+h, v: Math.round(40 + Math.random()*60) })),
        ) as TimeSeriesPoint[] },
      { id: "apts_trend", title: "Termine (60 Tage)", type: "line", data: series(60, 55, 20, 51) },
    ],
  },
  marketing: {
    key: "marketing", title: "Marketing Analytics",
    kpis: [
      kpi("camp", "Kampagnen aktiv", 6),
      kpi("leads_m", "Leads (M)", 156),
      kpi("web", "Website-Sitzungen", 12400),
      kpi("conv", "Conversions", 214),
      kpi("rev_ad", "Umsatz aus Ads", 82000, { format: "currency" }),
      kpi("reviews", "Bewertungen Ø", 4.7),
    ],
    charts: [
      { id: "channels", title: "Kanäle", type: "pie", data: categorical(["Google","Meta","LinkedIn","Newsletter","Organic"], 100, 60, 61) },
      { id: "landing", title: "Landingpages – Conversion", type: "bar", data: categorical(["LP-1","LP-2","LP-3","LP-4","LP-5"], 8, 6, 62) },
    ],
  },
  devices: {
    key: "devices", title: "Geräteanalytics",
    kpis: [
      kpi("sold", "Verkauft (Jahr)", 412),
      kpi("installed", "Installiert", 2148),
      kpi("service_freq", "Ø Serviceintervall", 9, { unit: "Monate" }),
      kpi("warranty", "Garantiefälle", 34),
      kpi("firmware", "Aktueller Firmware-Stand", 84, { format: "percent" }),
    ],
    charts: [
      { id: "models", title: "Beliebteste Modelle", type: "bar", data: categorical(["Alix Pro","Alix Slim","Alix Compact","Alix Ultra"], 120, 80, 71) },
      { id: "err", title: "Fehlerarten", type: "pie", data: categorical(["Hardware","Software","Bedienung","Verschleiß"], 100, 60, 72) },
      { id: "lifecycle", title: "Lebenszyklus (Alter)", type: "bar", data: categorical(["0-1","1-3","3-5","5+"], 80, 40, 73) },
    ],
  },
  employees: {
    key: "employees", title: "Mitarbeiteranalytics",
    kpis: [
      kpi("util", "Auslastung", 82, { format: "percent" }),
      kpi("apts", "Termine gesamt (M)", 812),
      kpi("service", "Serviceeinsätze (M)", 312),
      kpi("training", "Schulungen (M)", 27),
      kpi("overtime", "Überstunden (M)", 148, { unit: "h" }),
      kpi("vac", "Urlaub geplant", 34),
    ],
    charts: [
      { id: "team_util", title: "Auslastung nach Team", type: "bar", data: categorical(["Vertrieb","Service","Schulung","Backoffice"], 78, 15, 81) },
      { id: "productivity", title: "Produktivität (Index)", type: "line", data: series(90, 100, 20, 82) },
    ],
  },
  locations: {
    key: "locations", title: "Standortanalytics",
    kpis: [
      kpi("sites", "Standorte", 6),
      kpi("staff", "Mitarbeiter gesamt", 84),
      kpi("rev_top", "Top-Standort Umsatz", 1_240_000, { format: "currency" }),
    ],
    charts: [
      { id: "rev_loc", title: "Umsatz nach Standort", type: "bar", data: categorical(["Berlin","Dubai","Miami","Wien","Riga"], 700000, 500000, 91) },
      { id: "svc_loc", title: "Serviceeinsätze nach Standort", type: "bar", data: categorical(["Berlin","Dubai","Miami","Wien","Riga"], 60, 30, 92) },
      { id: "occ_loc", title: "Auslastung nach Standort", type: "bar", data: categorical(["Berlin","Dubai","Miami","Wien","Riga"], 75, 20, 93) },
    ],
  },
  forecast: {
    key: "forecast", title: "Forecast (Schätzung)",
    subtitle: "Vorhersage auf Basis historischer Daten – als Schätzung markiert",
    kpis: [
      kpi("rev_next", "Prognose Umsatz (nächster Monat)", 512_000, { format: "currency" }),
      kpi("util_next", "Prognose Auslastung", 84, { format: "percent" }),
      kpi("srv_next", "Prognose Serviceeinsätze", 342 ),
      kpi("train_next", "Prognose Schulungen", 31),
    ],
    charts: [
      { id: "rev_f", title: "Umsatz-Prognose 6 Monate", type: "line",
        data: multiSeries(180, ["ist","prognose"], 16000, 5000, 101) },
      { id: "cap_f", title: "Auslastung-Prognose", type: "area", data: series(120, 82, 8, 102) },
    ],
  },
};

export function getSection(key: string): AbicSectionConfig | undefined {
  return abicSections[key];
}

export function listSectionKeys(): string[] {
  return Object.keys(abicSections);
}

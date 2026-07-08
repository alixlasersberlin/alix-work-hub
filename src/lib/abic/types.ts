// ABIC – Enterprise Analytics & BI Center
// Read-only analytics layer. No mutations, no new tables.

export type Trend = "up" | "down" | "flat";

export interface Kpi {
  id: string;
  label: string;
  value: number | string;
  unit?: string;
  delta?: number; // % vs previous period
  trend?: Trend;
  target?: number;
  actual?: number;
  format?: "currency" | "number" | "percent" | "duration";
  drill?: string; // deep link
}

export interface TimeSeriesPoint {
  t: string; // ISO date or label
  v: number;
  [k: string]: number | string;
}

export interface ChartDef {
  id: string;
  title: string;
  type: "line" | "bar" | "pie" | "area" | "heatmap" | "table" | "pivot" | "kpi";
  data: TimeSeriesPoint[] | Record<string, unknown>[];
  keys?: string[];
  category?: string;
  description?: string;
}

export interface AbicSectionConfig {
  key: string;
  title: string;
  subtitle?: string;
  kpis: Kpi[];
  charts: ChartDef[];
}

export type AbicRole = "executive" | "manager" | "employee";

export interface AbicGoal {
  id: string;
  label: string;
  target: number;
  actual: number;
  unit?: string;
  period: "day" | "week" | "month" | "quarter" | "year";
}

export interface AbicReportDef {
  id: string;
  name: string;
  description?: string;
  cadence: "daily" | "weekly" | "monthly" | "quarterly" | "yearly" | "adhoc";
  blocks: Array<{ type: "kpi" | "chart" | "table" | "text"; ref?: string; text?: string }>;
  recipients?: string[];
  format: "pdf" | "excel" | "csv";
  createdAt: string;
}

export interface AbicKpiDef {
  id: string;
  name: string;
  formula: string; // human-readable
  unit?: string;
  category: string;
  createdAt: string;
}

export interface AbicDashboardDef {
  id: string;
  name: string;
  widgets: Array<{ id: string; type: string; x: number; y: number; w: number; h: number; ref?: string }>;
  favorite?: boolean;
  updatedAt: string;
}

export interface AbicAuditEntry {
  id: string;
  ts: string;
  actor: string;
  action: "export" | "report" | "kpi.update" | "dashboard.update";
  target: string;
  meta?: Record<string, unknown>;
}

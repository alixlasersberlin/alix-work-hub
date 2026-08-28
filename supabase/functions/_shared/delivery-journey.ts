// Gemeinsame Ableitungslogik für den kundenseitigen Lieferstatus.
// Nutzt ausschließlich bestehende AlixWork-Daten + optionale Overrides
// aus public.order_delivery_status. Es werden NIE interne Kommentare ausgegeben.

export type StepStatus = "done" | "active" | "pending" | "issue";

export interface JourneyStep {
  key: string;
  label: string;
  status: StepStatus;
  hint?: string;
}

export interface SubStep {
  key: string;
  label: string;
  status: StepStatus;
}

export const PHASE_ORDER = [
  "order_received",
  "order_check",
  "production_planned",
  "in_production",
  "qc",
  "provisioning",
  "tour_planning",
  "out_for_delivery",
  "delivered",
] as const;

export type Phase = (typeof PHASE_ORDER)[number];

export const PHASE_LABELS: Record<Phase, string> = {
  order_received: "Auftrag eingegangen",
  order_check: "Auftragsprüfung",
  production_planned: "Produktion vorbereitet",
  in_production: "Produktion",
  qc: "Qualitätsprüfung",
  provisioning: "Bereitstellung",
  tour_planning: "Tourenplanung",
  out_for_delivery: "Auslieferung",
  delivered: "Geliefert",
};

export const PHASE_CUSTOMER_TEXT: Record<Phase, string> = {
  order_received: "Ihr Auftrag ist bei uns eingegangen und wird erfasst.",
  order_check: "Ihre Auftragsunterlagen und Gerätekonfiguration werden geprüft.",
  production_planned: "Ihr Gerät ist eingeplant, die Fertigung wird vorbereitet.",
  in_production: "Ihr Gerät wird aktuell gefertigt.",
  qc: "Ihr Gerät befindet sich in der Qualitätsprüfung.",
  provisioning: "Ihr Gerät wird für die Auslieferung bereitgestellt.",
  tour_planning: "Ihre Auslieferung wird derzeit terminlich geplant.",
  out_for_delivery: "Ihr Gerät ist auf dem Weg zu Ihnen.",
  delivered: "Ihr Gerät wurde erfolgreich übergeben.",
};

export const PHASE_NEXT_TEXT: Record<Phase, string> = {
  order_received: "Im nächsten Schritt prüfen wir Ihre Auftrags- und Gerätedaten.",
  order_check: "Nach Abschluss der Prüfung wird Ihr Gerät für die Fertigung eingeplant.",
  production_planned: "Anschließend startet die Fertigung Ihres ALIX Systems.",
  in_production: "Nach der Fertigung folgt die vollständige Qualitätsprüfung.",
  qc: "Nach erfolgreicher Qualitätsprüfung wird Ihr Gerät zur Auslieferung freigegeben.",
  provisioning: "Sobald alle internen Freigaben vorliegen, planen wir Ihren Liefertermin.",
  tour_planning: "Sobald die Tour steht, erhalten Sie Ihren bestätigten Liefertermin mit Zeitfenster.",
  out_for_delivery: "Unser Team übergibt Ihnen das Gerät und weist Sie ein.",
  delivered: "Ihre Geräteunterlagen und Nachweise finden Sie in Ihren Dokumenten.",
};

export const DEFAULT_PRODUCTION_STEPS = [
  { key: "housing", label: "Gehäusemontage" },
  { key: "electronics", label: "Elektronik" },
  { key: "cooling", label: "Kühlsystem" },
  { key: "laser", label: "Laserquelle" },
  { key: "handpiece", label: "Handstück" },
  { key: "software", label: "Software / KI" },
  { key: "assembly", label: "Endmontage" },
];

export const DEFAULT_QC_STEPS = [
  { key: "electric", label: "Elektrische Prüfung" },
  { key: "power", label: "Laserleistungsprüfung" },
  { key: "cooling", label: "Kühlsystem" },
  { key: "software", label: "Softwareprüfung" },
  { key: "safety", label: "Sicherheitsprüfung" },
  { key: "function", label: "Funktionsprüfung" },
  { key: "final", label: "Endkontrolle" },
];

function normSteps(raw: any, defaults: { key: string; label: string }[]): SubStep[] {
  if (Array.isArray(raw) && raw.length) {
    return raw
      .filter((s: any) => s && s.key)
      .map((s: any) => ({
        key: String(s.key),
        label: String(s.label ?? s.key),
        status: (["done", "active", "pending", "issue"].includes(s.status) ? s.status : "pending") as StepStatus,
      }));
  }
  return defaults.map((d) => ({ ...d, status: "pending" as StepStatus }));
}

export interface JourneyInput {
  order: any;
  status: any | null;              // order_delivery_status row
  approvals: any | null;           // delivery_approvals row
  productionOrder: any | null;
  appointment: any | null;         // delivery_appointments row
  tourStop: any | null;
  trackingEvents: any[];
  items: any[];
  events: any[];                   // order_delivery_events (visible_to_customer)
}

/** Leitet die aktuelle Phase automatisch aus vorhandenen Daten ab. */
export function derivePhase(i: JourneyInput): Phase {
  const os = String(i.order?.order_status || "").toLowerCase();
  if (i.appointment?.delivered_at || os === "geliefert" || os === "abgeschlossen") return "delivered";

  const tourStatus = String(i.tourStop?.tour_status || "").toLowerCase();
  if (["aktiv", "unterwegs"].includes(tourStatus) || String(i.appointment?.status || "") === "unterwegs") {
    return "out_for_delivery";
  }

  const a = i.approvals;
  const allApproved = a && a.warehouse_status === "approved" && a.accounting_status === "approved" && a.dispatch_status === "approved";
  if (i.appointment?.planned_date) return allApproved ? "tour_planning" : "provisioning";

  if (a && (a.warehouse_status === "approved" || a.accounting_status === "approved")) return "provisioning";

  if (i.status?.qc_completed_at) return "provisioning";
  if (i.status?.qc_started_at) return "qc";
  if (i.status?.production_started_at) return "in_production";

  const po = i.productionOrder;
  if (po && po.approval_status === "approved" && po.status === "gesendet") return "in_production";
  if (po) return "production_planned";

  if (i.order?.deposit_ok) return "order_check";
  return "order_received";
}

export function buildJourney(i: JourneyInput) {
  const manualPhase = i.status?.phase && i.status.phase !== "auto" && (PHASE_ORDER as readonly string[]).includes(i.status.phase)
    ? (i.status.phase as Phase)
    : null;
  const phase: Phase = manualPhase ?? derivePhase(i);
  const phaseIdx = PHASE_ORDER.indexOf(phase);

  const productionSteps = normSteps(i.status?.production_steps, DEFAULT_PRODUCTION_STEPS);
  const qcSteps = normSteps(i.status?.qc_steps, DEFAULT_QC_STEPS);

  const hasRealProductionData = Array.isArray(i.status?.production_steps) && i.status.production_steps.length > 0;
  const doneCount = productionSteps.filter((s) => s.status === "done").length;
  const productionProgress = hasRealProductionData
    ? Math.round((doneCount / productionSteps.length) * 100)
    : null;

  const steps: JourneyStep[] = PHASE_ORDER.filter((p) => p !== "delivered").map((p, idx) => ({
    key: p,
    label: PHASE_LABELS[p],
    status: phase === "delivered"
      ? "done"
      : idx < phaseIdx ? "done" : idx === phaseIdx ? "active" : "pending",
  }));
  steps.push({
    key: "delivered",
    label: PHASE_LABELS.delivered,
    status: phase === "delivered" ? "done" : "pending",
  });

  const a = i.approvals;
  const releases = {
    warehouse: {
      label: "Bereitstellung",
      approved: a?.warehouse_status === "approved",
      text: a?.warehouse_status === "approved" ? "freigegeben" : "Freigabe ausstehend",
    },
    accounting: {
      label: "Buchhaltung",
      approved: a?.accounting_status === "approved",
      text: a?.accounting_status === "approved" ? "freigegeben" : "Zahlungsfreigabe ausstehend",
    },
    dispatch: {
      label: "Tourenplanung",
      approved: a?.dispatch_status === "approved",
      text: a?.dispatch_status === "approved" ? "freigegeben" : "Tour wird derzeit geplant",
    },
  };

  const appt = i.appointment;
  const eta = {
    earliest: i.status?.eta_earliest ?? null,
    planned: i.status?.eta_planned ?? appt?.planned_date ?? i.order?.expected_shipment_date ?? null,
    latest: i.status?.eta_latest ?? null,
    confirmed: Boolean(i.status?.eta_confirmed || appt?.confirmed_at),
    window_start: i.status?.time_window_start ?? appt?.time_window_start ?? null,
    window_end: i.status?.time_window_end ?? appt?.time_window_end ?? null,
    delivered_at: appt?.delivered_at ?? null,
  };

  const confidence: "confirmed" | "planning" | "forecast" =
    eta.confirmed ? "confirmed" : eta.planned ? "forecast" : "planning";

  const devices = (i.items ?? [])
    .filter((it: any) => Number(it.quantity ?? 1) > 0 && it.item_name)
    .map((it: any) => ({
      name: String(it.item_name),
      quantity: Number(it.quantity ?? 1),
      serial_number: null as string | null,
    }));
  if (appt?.serial_number && devices[0]) devices[0].serial_number = appt.serial_number;
  else if (i.productionOrder?.seriennummer && devices[0]) devices[0].serial_number = i.productionOrder.seriennummer;

  const tourSteps = appt?.planned_date
    ? [
        { key: "prepared", label: "Tour vorbereitet", status: (i.tourStop ? "done" : "pending") as StepStatus },
        { key: "loaded", label: "Fahrzeug beladen", status: (["aktiv", "abgeschlossen"].includes(String(i.tourStop?.tour_status)) ? "done" : "pending") as StepStatus },
        { key: "started", label: "Tour gestartet", status: (String(i.tourStop?.tour_status) === "aktiv" ? "active" : phase === "delivered" ? "done" : "pending") as StepStatus },
        { key: "enroute", label: "Auf dem Weg", status: (phase === "out_for_delivery" ? "active" : phase === "delivered" ? "done" : "pending") as StepStatus },
        { key: "arrived", label: "Ankunft", status: (phase === "delivered" ? "done" : "pending") as StepStatus },
      ]
    : [];

  const history = [
    ...(i.events ?? []).map((e: any) => ({
      date: e.created_at,
      title: e.title,
      description: e.description ?? null,
    })),
    ...(i.trackingEvents ?? []).map((e: any) => ({
      date: e.created_at,
      title: String(e.event_type || "Aktualisierung"),
      description: e.message ?? null,
    })),
  ].sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime());

  return {
    phase,
    phase_label: PHASE_LABELS[phase],
    phase_text: i.status?.customer_note || PHASE_CUSTOMER_TEXT[phase],
    next_text: PHASE_NEXT_TEXT[phase],
    steps,
    production: {
      steps: productionSteps,
      progress: productionProgress,
      started_at: i.status?.production_started_at ?? null,
      end_planned: i.status?.production_end_planned ?? null,
    },
    qc: {
      steps: qcSteps,
      started_at: i.status?.qc_started_at ?? null,
      completed_at: i.status?.qc_completed_at ?? null,
      passed: Boolean(i.status?.qc_completed_at),
    },
    releases,
    eta,
    confidence,
    delay: i.status?.is_delayed
      ? { active: true, reason: i.status?.customer_delay_reason || "Wir informieren Sie, sobald ein neuer Termin feststeht." }
      : { active: false, reason: null },
    partial_delivery: Boolean(i.status?.partial_delivery),
    devices,
    tour_steps: tourSteps,
    history,
    last_update: i.status?.last_status_change ?? i.order?.updated_at ?? null,
  };
}

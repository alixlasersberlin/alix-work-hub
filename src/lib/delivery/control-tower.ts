/** Regelbasierte Ampel-, ETA- und Eskalationslogik für den Delivery Control Tower. */

export type TrafficLight = 'gruen' | 'gelb' | 'rot' | 'grau';
export type EtaState = 'forecast' | 'planned' | 'confirmed' | 'at_risk' | 'delayed' | 'delivered';

export const BLOCKER_TYPES: { value: string; label: string }[] = [
  { value: 'payment_open', label: 'Zahlung offen' },
  { value: 'contract_open', label: 'Vertrag offen' },
  { value: 'config_incomplete', label: 'Gerätekonfiguration unvollständig' },
  { value: 'part_missing', label: 'Bauteil fehlt' },
  { value: 'production_open', label: 'Produktion nicht abgeschlossen' },
  { value: 'qc_open', label: 'Qualitätsprüfung offen' },
  { value: 'qc_failed', label: 'Qualitätsprüfung nicht bestanden' },
  { value: 'documentation_open', label: 'Dokumentation unvollständig' },
  { value: 'provisioning_open', label: 'Bereitstellung nicht freigegeben' },
  { value: 'accounting_open', label: 'Buchhaltung nicht freigegeben' },
  { value: 'tour_missing', label: 'Tour nicht geplant' },
  { value: 'customer_unconfirmed', label: 'Kunde hat Termin nicht bestätigt' },
  { value: 'address_unclear', label: 'Lieferadresse ungeklärt' },
  { value: 'customer_unreachable', label: 'Kunde nicht erreichbar' },
  { value: 'vehicle_issue', label: 'Fahrzeugproblem' },
  { value: 'staff_issue', label: 'Personalausfall' },
  { value: 'other', label: 'Sonstiges' },
];

export const BLOCKER_LABELS: Record<string, string> = Object.fromEntries(
  BLOCKER_TYPES.map((b) => [b.value, b.label]),
);

export const PRIORITIES: { value: string; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'hoch', label: 'Hoch' },
  { value: 'vip', label: 'VIP' },
  { value: 'kritisch', label: 'Kritisch' },
];

export const ETA_STATE_LABELS: Record<EtaState, string> = {
  forecast: 'Prognose',
  planned: 'Eingeplant',
  confirmed: 'Bestätigt',
  at_risk: 'Gefährdet',
  delayed: 'Verzögert',
  delivered: 'Geliefert',
};

export const TRAFFIC_LABELS: Record<TrafficLight, string> = {
  gruen: 'Planmäßig',
  gelb: 'Termin gefährdet',
  rot: 'Termin nicht haltbar',
  grau: 'Noch keine Terminplanung',
};

export interface DeliveryRowInput {
  phase: string | null;
  eta_planned: string | null;
  eta_confirmed: boolean | null;
  is_delayed: boolean | null;
  qc_completed_at: string | null;
  production_end_planned: string | null;
  tour_id: string | null;
  tour_planned: boolean;
  customer_response: string | null;
  delivered: boolean;
  open_blockers: number;
}

export function daysUntil(date?: string | null): number | null {
  if (!date) return null;
  const d = new Date(`${String(date).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

/** Ampel strikt nach Regeln – keine Prognose-Heuristik. */
export function computeTrafficLight(r: DeliveryRowInput): { light: TrafficLight; reasons: string[] } {
  const reasons: string[] = [];
  if (r.delivered || r.phase === 'delivered') return { light: 'gruen', reasons: ['Geliefert'] };
  if (!r.eta_planned) return { light: 'grau', reasons: ['Noch kein Liefertermin geplant'] };

  const d = daysUntil(r.eta_planned);
  let light: TrafficLight = 'gruen';
  const escalate = (to: TrafficLight, reason: string) => {
    reasons.push(reason);
    const rank: Record<TrafficLight, number> = { grau: 0, gruen: 1, gelb: 2, rot: 3 };
    if (rank[to] > rank[light]) light = to;
  };

  if (d !== null && d < 0 && !r.delivered) escalate('rot', 'Liefertermin überschritten, noch nicht geliefert');
  if (d === 0 && !r.tour_planned) escalate('rot', 'Liefertermin heute, Tour nicht gestartet');
  if (d !== null && d <= 2 && d >= 0 && !r.tour_planned) escalate('gelb', 'Liefertermin in ≤ 2 Tagen, Tour nicht geplant');
  if (d !== null && d <= 3 && d >= 0 && !r.qc_completed_at) escalate('gelb', 'Liefertermin in ≤ 3 Tagen, Qualitätsprüfung offen');

  const prodOverdue = daysUntil(r.production_end_planned);
  if (prodOverdue !== null && prodOverdue < 0 && !r.qc_completed_at) {
    escalate(prodOverdue < -7 ? 'rot' : 'gelb', 'Produktionsende überschritten, Produktion nicht abgeschlossen');
  }

  if (r.is_delayed) escalate('rot', 'Als verzögert markiert');
  if (r.open_blockers > 0) escalate('gelb', `${r.open_blockers} offene(r) Blocker`);

  if (reasons.length === 0) reasons.push('Lieferung planmäßig');
  return { light, reasons };
}

export function computeEtaState(r: DeliveryRowInput): EtaState {
  if (r.delivered || r.phase === 'delivered') return 'delivered';
  if (r.is_delayed) return 'delayed';
  const d = daysUntil(r.eta_planned);
  if (d !== null && d < 0) return 'delayed';
  if (d !== null && d <= 3 && !r.qc_completed_at) return 'at_risk';
  if (r.eta_confirmed) return 'confirmed';
  if (r.eta_planned) return 'planned';
  return 'forecast';
}

export function isWaitingForCustomer(r: DeliveryRowInput): boolean {
  if (r.delivered) return false;
  if (r.customer_response === 'change_requested') return true;
  return Boolean(r.eta_planned) && !r.eta_confirmed && !r.customer_response;
}

export const TRAFFIC_CLASSES: Record<TrafficLight, string> = {
  gruen: 'bg-emerald-600 text-white',
  gelb: 'bg-amber-500 text-black',
  rot: 'bg-destructive text-destructive-foreground',
  grau: 'bg-muted text-muted-foreground',
};

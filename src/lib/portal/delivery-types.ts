/** Typen für die kundenseitige Delivery Journey (Payload aus customer-portal-lookup). */

export type DjStepStatus = 'done' | 'active' | 'pending' | 'issue';

export interface DjStep {
  key: string;
  label: string;
  status: DjStepStatus;
  hint?: string | null;
}

export interface DjRelease {
  label: string;
  approved: boolean;
  text: string;
}

export interface DeliveryJourneyPayload {
  phase: string;
  phase_label: string;
  phase_text: string;
  next_text: string;
  steps: DjStep[];
  production: {
    steps: DjStep[];
    progress: number | null;
    started_at: string | null;
    end_planned: string | null;
  };
  qc: {
    steps: DjStep[];
    started_at: string | null;
    completed_at: string | null;
    passed: boolean;
  };
  releases: { warehouse: DjRelease; accounting: DjRelease; dispatch: DjRelease };
  eta: {
    earliest: string | null;
    planned: string | null;
    latest: string | null;
    confirmed: boolean;
    window_start: string | null;
    window_end: string | null;
    delivered_at: string | null;
  };
  confidence: 'confirmed' | 'planning' | 'forecast';
  delay: { active: boolean; reason: string | null };
  partial_delivery: boolean;
  customer_response?: {
    response: 'confirmed' | 'change_requested' | null;
    responded_at: string | null;
    alternative_date: string | null;
    note: string | null;
    can_confirm: boolean;
  } | null;
  devices: { name: string; quantity: number; serial_number: string | null }[];
  tour_steps: DjStep[];
  history: { date: string; title: string; description: string | null }[];
  last_update: string | null;
}

export const PHASE_STEP_LABELS: Record<string, string> = {
  order_received: 'Auftrag',
  order_check: 'Auftragsprüfung',
  production_planned: 'Produktionsplanung',
  in_production: 'Produktion',
  qc: 'Qualitätsprüfung',
  provisioning: 'Bereitstellung',
  tour_planning: 'Tourenplanung',
  out_for_delivery: 'Auslieferung',
  delivered: 'Geliefert',
};

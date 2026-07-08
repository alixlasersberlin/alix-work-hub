// Alix AI · ESC types (Prompt 7)
// The AI never mutates data by itself. All suggestions are stored transparently
// with reasoning, expected benefit and referenced source data.

export type AiSuggestionKind =
  | 'schedule'          // Better time slot / employee for a specific appointment
  | 'resource'          // Resource re-assignment (room, device, vehicle)
  | 'route'             // Route optimization suggestion
  | 'capacity'          // Overload / idle warning
  | 'no_show'           // No-show risk hint
  | 'follow_up'         // Sales follow-up hint
  | 'service'           // Preventive service / grouping hint
  | 'training'          // Course / room capacity hint
  | 'reminder';         // Not-yet-confirmed reminder

export type AiPriority = 'info' | 'low' | 'medium' | 'high' | 'critical';
export type AiStatus = 'open' | 'accepted' | 'dismissed' | 'expired';

export interface AiEvidence {
  /** Human-readable data point used for reasoning */
  label: string;
  /** Optional numeric value */
  value?: string | number;
  /** Source table / mock name */
  source?: string;
}

export interface AiSuggestion {
  id: string;
  kind: AiSuggestionKind;
  priority: AiPriority;
  status: AiStatus;
  /** Short headline shown in cards */
  title: string;
  /** Explanation why the suggestion was made */
  reason: string;
  /** Expected benefit in natural language */
  benefit: string;
  /** Confidence 0..1 – derived from data completeness, not from any external ML */
  confidence: number;
  /** Data points that led to the suggestion – shown in "Details" */
  evidence: AiEvidence[];
  /** Related entity references */
  refs?: {
    appointmentId?: string;
    employeeId?: string;
    resourceId?: string;
    customerId?: string;
    departmentId?: string;
  };
  /** Suggested action payload – only applied after user confirmation */
  action?: {
    type: 'reassign_employee' | 'move_time' | 'swap_resource' | 'reorder_route' | 'create_followup' | 'send_reminder' | 'noop';
    payload?: Record<string, unknown>;
  };
  createdAt: string;
  actedAt?: string;
  actedBy?: string;
  outcome?: string;
}

export interface AiSettings {
  enabled: boolean;
  kinds: Record<AiSuggestionKind, boolean>;
  minPriority: AiPriority;
  utilizationWarnAt: number;       // percent
  utilizationCriticalAt: number;   // percent
  noShowWarnAt: number;            // score 0..100
  forecastHorizonDays: number;
  language: 'de' | 'en';
  refreshIntervalMinutes: number;
  externalProvider: 'none' | 'openai' | 'azure' | 'local';
  shareSensitiveDataExternally: boolean;
}

export const DEFAULT_AI_SETTINGS: AiSettings = {
  enabled: true,
  kinds: {
    schedule: true, resource: true, route: true, capacity: true,
    no_show: true, follow_up: true, service: true, training: true, reminder: true,
  },
  minPriority: 'low',
  utilizationWarnAt: 80,
  utilizationCriticalAt: 95,
  noShowWarnAt: 60,
  forecastHorizonDays: 30,
  language: 'de',
  refreshIntervalMinutes: 15,
  externalProvider: 'none',
  shareSensitiveDataExternally: false,
};

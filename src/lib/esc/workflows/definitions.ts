// Declarative workflow definitions. Each maps an ESC event to a set of
// side-effects that other modules can implement independently. The engine
// runs them via the event bus – no direct coupling to CRM / Service etc.

import type { EscEventName } from '@/lib/esc/events/bus';

export type WorkflowActionKind =
  | 'crm.updateStatus' | 'crm.createTask' | 'crm.createTimelineEntry'
  | 'service.createOrder' | 'service.assignTechnician' | 'service.reserveDevice'
  | 'service.reserveVehicle' | 'service.reserveTool' | 'service.generateReport'
  | 'training.createParticipants' | 'training.generateBadges'
  | 'training.generateAttendance' | 'training.prepareCertificate'
  | 'delivery.bookLogistics' | 'delivery.createDeliveryNote'
  | 'mail.sendConfirmation' | 'mail.sendReschedule' | 'mail.sendCancellation'
  | 'mail.sendFeedback' | 'mail.sendCertificate'
  | 'notify.internal' | 'audit.write' | 'dashboard.refresh'
  | 'document.generate' | 'webhook.dispatch';

export interface WorkflowAction {
  kind: WorkflowActionKind;
  config?: Record<string, unknown>;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  trigger: EscEventName;
  matchKind?: string;             // appointment kind filter (contains match)
  matchDepartment?: string;       // department slug filter
  actions: WorkflowAction[];
  enabled: boolean;
}

export const DEFAULT_WORKFLOWS: WorkflowDefinition[] = [
  {
    id: 'sales-confirmed',
    name: 'Sales-Termin bestätigt',
    trigger: 'event.confirmed',
    matchKind: 'sales',
    enabled: true,
    actions: [
      { kind: 'crm.updateStatus', config: { status: 'sales-termin-bestaetigt' } },
      { kind: 'crm.createTask', config: { title: 'Angebot vorbereiten' } },
      { kind: 'mail.sendConfirmation' },
      { kind: 'notify.internal', config: { channel: 'sales' } },
      { kind: 'audit.write' },
      { kind: 'dashboard.refresh' },
    ],
  },
  {
    id: 'service-scheduled',
    name: 'Serviceeinsatz eingeplant',
    trigger: 'event.created',
    matchKind: 'service',
    enabled: true,
    actions: [
      { kind: 'service.createOrder' },
      { kind: 'service.assignTechnician' },
      { kind: 'service.reserveDevice' },
      { kind: 'service.reserveVehicle' },
      { kind: 'service.reserveTool' },
      { kind: 'notify.internal', config: { channel: 'service' } },
    ],
  },
  {
    id: 'service-completed',
    name: 'Service abgeschlossen',
    trigger: 'service.finished',
    enabled: true,
    actions: [
      { kind: 'service.generateReport' },
      { kind: 'document.generate', config: { template: 'servicebericht' } },
      { kind: 'mail.sendFeedback' },
      { kind: 'audit.write' },
    ],
  },
  {
    id: 'training-completed',
    name: 'Schulung abgeschlossen',
    trigger: 'training.completed',
    enabled: true,
    actions: [
      { kind: 'training.generateAttendance' },
      { kind: 'training.prepareCertificate' },
      { kind: 'mail.sendCertificate' },
      { kind: 'document.generate', config: { template: 'zertifikat' } },
    ],
  },
  {
    id: 'delivery-planned',
    name: 'Lieferung geplant',
    trigger: 'event.created',
    matchKind: 'lieferung',
    enabled: true,
    actions: [
      { kind: 'delivery.bookLogistics' },
      { kind: 'delivery.createDeliveryNote' },
      { kind: 'notify.internal', config: { channel: 'logistik' } },
    ],
  },
  {
    id: 'appointment-rescheduled',
    name: 'Termin verschoben',
    trigger: 'event.rescheduled',
    enabled: true,
    actions: [{ kind: 'mail.sendReschedule' }, { kind: 'audit.write' }],
  },
  {
    id: 'appointment-cancelled',
    name: 'Termin abgesagt',
    trigger: 'event.cancelled',
    enabled: true,
    actions: [{ kind: 'mail.sendCancellation' }, { kind: 'audit.write' }],
  },
];

export function findWorkflowsFor(event: EscEventName, kind?: string | null, department?: string | null) {
  return DEFAULT_WORKFLOWS.filter((w) => {
    if (!w.enabled || w.trigger !== event) return false;
    if (w.matchKind && !(kind || '').toLowerCase().includes(w.matchKind)) return false;
    if (w.matchDepartment && w.matchDepartment !== department) return false;
    return true;
  });
}

// Enterprise Communication Hub (ECH) – Types (Prompt 8)
// Central types for all outbound communication channels.
// The hub is additive: it never modifies existing modules or DB tables.

export type EchChannel =
  | 'email'
  | 'calendar_invite'
  | 'sms'
  | 'whatsapp'
  | 'push'
  | 'teams'
  | 'zoom'
  | 'google_meet'
  | 'webhook';

export type EchLanguage = 'de' | 'en' | 'tr' | 'ar' | 'ru' | 'vi' | 'fr' | 'es';

export type EchDeliveryStatus =
  | 'queued'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'clicked'
  | 'bounced'
  | 'failed'
  | 'answered';

export interface EchTemplate {
  id: string;
  name: string;                 // internal admin name
  slug: string;                 // e.g. "appointment_confirmed"
  channel: EchChannel;
  language: EchLanguage;
  subject?: string;             // for email / push title
  body: string;                 // supports {{placeholders}}
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EchReminderRule {
  id: string;
  label: string;
  /** Minutes before start; negative = after end */
  offsetMinutes: number;
  channels: EchChannel[];
  active: boolean;
}

export interface EchCommRule {
  id: string;
  /** Termin-/Departmentart, e.g. "service", "delivery", "training" */
  kind: string;
  steps: {
    when: 'on_create' | 'before' | 'after';
    offsetMinutes?: number;
    channel: EchChannel;
    templateSlug: string;
  }[];
  active: boolean;
}

export interface EchMessage {
  id: string;
  channel: EchChannel;
  templateSlug?: string;
  language: EchLanguage;
  recipient: string;            // email / phone / user-id / channel-id
  subject?: string;
  body: string;
  status: EchDeliveryStatus;
  error?: string;
  refs?: {
    appointmentId?: string;
    customerId?: string;
    employeeId?: string;
    meetingUrl?: string;
  };
  createdAt: string;
  sentAt?: string;
  openedAt?: string;
  clickedAt?: string;
  answeredAt?: string;
  retryCount: number;
}

export interface EchFeedToken {
  id: string;
  label: string;
  scope: 'employee' | 'department' | 'resource' | 'training' | 'service' | 'delivery' | 'all';
  scopeId?: string;
  token: string;                // opaque secret
  createdAt: string;
  active: boolean;
}

export type EchIntegrationId =
  | 'google_workspace'
  | 'microsoft_365'
  | 'exchange'
  | 'apple_calendar'
  | 'caldav'
  | 'teams'
  | 'zoom'
  | 'google_meet'
  | 'whatsapp'
  | 'sms_twilio'
  | 'sms_gatewayapi'
  | 'web_push';

export interface EchIntegration {
  id: EchIntegrationId;
  name: string;
  category: 'calendar' | 'meeting' | 'messaging' | 'push';
  status: 'disabled' | 'prepared' | 'connected';
  mode?: 'read' | 'read_write';
  note?: string;
}

export interface EchSettings {
  defaultLanguage: EchLanguage;
  fromEmail: string;
  fromName: string;
  smsSenderId?: string;
  autoSendCalendarInvite: boolean;
  autoRequestFeedback: boolean;
  conflictResolution: 'manual' | 'auto_prefer_local' | 'auto_prefer_remote';
  reminderRules: EchReminderRule[];
  commRules: EchCommRule[];
  activeLanguages: EchLanguage[];
}

export const ECH_LANGUAGES: { id: EchLanguage; label: string }[] = [
  { id: 'de', label: 'Deutsch' },
  { id: 'en', label: 'English' },
  { id: 'tr', label: 'Türkçe' },
  { id: 'ar', label: 'العربية' },
  { id: 'ru', label: 'Русский' },
  { id: 'vi', label: 'Tiếng Việt' },
  { id: 'fr', label: 'Français' },
  { id: 'es', label: 'Español' },
];

export const ECH_PLACEHOLDERS = [
  'customer_name', 'appointment_date', 'appointment_time',
  'employee_name', 'department', 'company', 'location',
  'calendar_link', 'confirmation_link', 'cancel_link',
  'reschedule_link', 'qr_code', 'meeting_url', 'meeting_password',
];

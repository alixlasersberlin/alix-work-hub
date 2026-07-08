// ECH · Local store (Prompt 8)
// LocalStorage-backed to avoid touching shared DB schema (per Prompt-8 rules).
// A future backend migration can swap this for Supabase/queue without UI changes.

import type {
  EchTemplate, EchMessage, EchFeedToken, EchIntegration, EchSettings,
  EchLanguage, EchIntegrationId,
} from './types';

const K = {
  templates: 'esc.ech.templates.v1',
  messages: 'esc.ech.messages.v1',
  feeds: 'esc.ech.feeds.v1',
  integrations: 'esc.ech.integrations.v1',
  settings: 'esc.ech.settings.v1',
} as const;

const listeners = new Set<() => void>();
export function subscribeEch(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
function notify() { listeners.forEach((l) => l()); }

function read<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}
function write<T>(key: string, value: T) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  notify();
}

// ---- Templates ----------------------------------------------------------
const SEED_TEMPLATES: EchTemplate[] = [
  {
    id: 't-conf-de', slug: 'appointment_confirmed', name: 'Terminbestätigung', channel: 'email', language: 'de',
    subject: 'Ihr Termin am {{appointment_date}} ist bestätigt',
    body: 'Hallo {{customer_name}},\n\nIhr Termin bei {{company}} am {{appointment_date}} um {{appointment_time}} ist bestätigt.\nAnsprechpartner: {{employee_name}} ({{department}}).\n\nKalender: {{calendar_link}}\nÄndern: {{reschedule_link}} · Absagen: {{cancel_link}}',
    active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 't-remind-de', slug: 'appointment_reminder', name: 'Terminerinnerung', channel: 'email', language: 'de',
    subject: 'Erinnerung: Ihr Termin am {{appointment_date}}',
    body: 'Hallo {{customer_name}},\n\ndies ist eine Erinnerung an Ihren Termin am {{appointment_date}} um {{appointment_time}}.\n{{meeting_url}}',
    active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 't-reschedule-de', slug: 'appointment_rescheduled', name: 'Terminverschiebung', channel: 'email', language: 'de',
    subject: 'Ihr Termin wurde verschoben',
    body: 'Hallo {{customer_name}},\n\nIhr Termin wurde auf {{appointment_date}} um {{appointment_time}} verschoben.',
    active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 't-cancel-de', slug: 'appointment_cancelled', name: 'Terminabsage', channel: 'email', language: 'de',
    subject: 'Ihr Termin wurde abgesagt',
    body: 'Hallo {{customer_name}},\n\nleider wurde Ihr Termin am {{appointment_date}} abgesagt.',
    active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 't-sms-remind-de', slug: 'appointment_reminder', name: 'SMS-Erinnerung', channel: 'sms', language: 'de',
    body: 'Erinnerung: Termin bei {{company}} am {{appointment_date}} {{appointment_time}}.',
    active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 't-feedback-de', slug: 'appointment_feedback', name: 'Feedback-Anfrage', channel: 'email', language: 'de',
    subject: 'Wie war Ihr Termin bei {{company}}?',
    body: 'Hallo {{customer_name}},\n\nwir freuen uns über Ihr Feedback zu Ihrem Termin am {{appointment_date}}.',
    active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 't-conf-en', slug: 'appointment_confirmed', name: 'Appointment confirmed', channel: 'email', language: 'en',
    subject: 'Your appointment on {{appointment_date}} is confirmed',
    body: 'Hi {{customer_name}},\n\nYour appointment with {{company}} on {{appointment_date}} at {{appointment_time}} is confirmed.',
    active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
];

export function getTemplates(): EchTemplate[] { return read(K.templates, SEED_TEMPLATES); }
export function saveTemplates(next: EchTemplate[]) { write(K.templates, next); }
export function upsertTemplate(t: EchTemplate) {
  const all = getTemplates();
  const idx = all.findIndex((x) => x.id === t.id);
  const now = new Date().toISOString();
  if (idx < 0) all.push({ ...t, createdAt: now, updatedAt: now });
  else all[idx] = { ...t, updatedAt: now };
  saveTemplates(all);
}
export function deleteTemplate(id: string) { saveTemplates(getTemplates().filter((t) => t.id !== id)); }

// ---- Messages -----------------------------------------------------------
export function getMessages(): EchMessage[] { return read(K.messages, []); }
export function appendMessage(m: EchMessage) {
  const next = [m, ...getMessages()].slice(0, 500);
  write(K.messages, next);
}
export function patchMessage(id: string, patch: Partial<EchMessage>) {
  const all = getMessages();
  const idx = all.findIndex((m) => m.id === id);
  if (idx < 0) return;
  all[idx] = { ...all[idx], ...patch };
  write(K.messages, all);
}

// ---- Calendar feed tokens ----------------------------------------------
export function getFeeds(): EchFeedToken[] { return read(K.feeds, []); }
export function saveFeeds(next: EchFeedToken[]) { write(K.feeds, next); }
export function createFeed(input: Omit<EchFeedToken, 'id' | 'token' | 'createdAt' | 'active'>): EchFeedToken {
  const feed: EchFeedToken = {
    ...input,
    id: crypto.randomUUID(),
    token: crypto.randomUUID().replace(/-/g, ''),
    createdAt: new Date().toISOString(),
    active: true,
  };
  saveFeeds([feed, ...getFeeds()]);
  return feed;
}
export function revokeFeed(id: string) { saveFeeds(getFeeds().filter((f) => f.id !== id)); }

// ---- Integrations -------------------------------------------------------
const SEED_INTEGRATIONS: EchIntegration[] = [
  { id: 'google_workspace', name: 'Google Workspace', category: 'calendar', status: 'prepared' },
  { id: 'microsoft_365',    name: 'Microsoft 365',    category: 'calendar', status: 'prepared' },
  { id: 'exchange',         name: 'Microsoft Exchange', category: 'calendar', status: 'prepared' },
  { id: 'apple_calendar',   name: 'Apple Calendar',   category: 'calendar', status: 'prepared', note: 'via ICS Feed / CalDAV' },
  { id: 'caldav',           name: 'CalDAV',           category: 'calendar', status: 'prepared' },
  { id: 'teams',            name: 'Microsoft Teams',  category: 'meeting',  status: 'prepared' },
  { id: 'zoom',             name: 'Zoom',             category: 'meeting',  status: 'prepared' },
  { id: 'google_meet',      name: 'Google Meet',      category: 'meeting',  status: 'prepared' },
  { id: 'whatsapp',         name: 'WhatsApp Business',category: 'messaging',status: 'prepared' },
  { id: 'sms_twilio',       name: 'Twilio SMS',       category: 'messaging',status: 'prepared' },
  { id: 'sms_gatewayapi',   name: 'GatewayAPI SMS',   category: 'messaging',status: 'prepared' },
  { id: 'web_push',         name: 'Web Push',         category: 'push',     status: 'prepared' },
];
export function getIntegrations(): EchIntegration[] {
  const stored = read<EchIntegration[]>(K.integrations, SEED_INTEGRATIONS);
  // ensure any new seed entries exist
  const map = new Map(stored.map((i) => [i.id, i]));
  for (const seed of SEED_INTEGRATIONS) if (!map.has(seed.id)) map.set(seed.id, seed);
  return Array.from(map.values());
}
export function setIntegrationStatus(id: EchIntegrationId, patch: Partial<EchIntegration>) {
  const all = getIntegrations().map((i) => (i.id === id ? { ...i, ...patch } : i));
  write(K.integrations, all);
}

// ---- Settings -----------------------------------------------------------
export const DEFAULT_SETTINGS: EchSettings = {
  defaultLanguage: 'de',
  fromEmail: 'noreply@alixworks.de',
  fromName: 'AlixWorks',
  smsSenderId: 'AlixWorks',
  autoSendCalendarInvite: true,
  autoRequestFeedback: true,
  conflictResolution: 'manual',
  reminderRules: [
    { id: 'r-24h', label: '24h vorher',  offsetMinutes: 24 * 60, channels: ['email'], active: true },
    { id: 'r-2h',  label: '2h vorher',   offsetMinutes: 120,     channels: ['sms', 'push'], active: true },
    { id: 'r-30m', label: '30 Min vorher', offsetMinutes: 30,    channels: ['push'], active: true },
    { id: 'r-post', label: 'Nach Termin', offsetMinutes: -60,    channels: ['email'], active: true },
  ],
  commRules: [
    { id: 'c-service',  kind: 'service',  steps: [
      { when: 'on_create', channel: 'email', templateSlug: 'appointment_confirmed' },
      { when: 'before', offsetMinutes: 24 * 60, channel: 'sms', templateSlug: 'appointment_reminder' },
      { when: 'after', offsetMinutes: 60, channel: 'email', templateSlug: 'appointment_feedback' },
    ], active: true },
    { id: 'c-delivery', kind: 'delivery', steps: [
      { when: 'on_create', channel: 'email', templateSlug: 'appointment_confirmed' },
      { when: 'before', offsetMinutes: 120, channel: 'sms', templateSlug: 'appointment_reminder' },
    ], active: true },
    { id: 'c-training', kind: 'training', steps: [
      { when: 'on_create', channel: 'email', templateSlug: 'appointment_confirmed' },
    ], active: true },
  ],
  activeLanguages: ['de', 'en'],
};

export function getSettings(): EchSettings {
  return { ...DEFAULT_SETTINGS, ...read<Partial<EchSettings>>(K.settings, {}) };
}
export function saveSettings(next: EchSettings) { write(K.settings, next); }

export function resolveTemplate(slug: string, channel: EchTemplate['channel'], language: EchLanguage): EchTemplate | undefined {
  const all = getTemplates();
  return all.find((t) => t.slug === slug && t.channel === channel && t.language === language && t.active)
      ?? all.find((t) => t.slug === slug && t.channel === channel && t.language === 'de' && t.active)
      ?? all.find((t) => t.slug === slug && t.channel === channel && t.active);
}

// Mock data for Prompt 1. Replaced in Prompt 2 by real Supabase-backed hooks.
import type { EscAppointment, EscDepartment, EscEmployee, EscResource } from './types';

export const MOCK_DEPARTMENTS: EscDepartment[] = [
  { id: 'sales',     name: 'Sales',            color: '#3b82f6', icon: 'TrendingUp',     active: true, publicBookable: true,  defaultDurationMinutes: 30, responsibleEmployeeIds: ['e1'], internalVisible: true,  externallyBookable: true,  description: 'Verkauf & Beratung' },
  { id: 'service',   name: 'Service',          color: '#10b981', icon: 'Wrench',         active: true, publicBookable: true,  defaultDurationMinutes: 60, responsibleEmployeeIds: ['e2'], internalVisible: true,  externallyBookable: true,  description: 'Serviceeinsätze & Reparatur' },
  { id: 'delivery',  name: 'Lieferung',        color: '#f97316', icon: 'Truck',          active: true, publicBookable: false, defaultDurationMinutes: 90, responsibleEmployeeIds: ['e3'], internalVisible: true,  externallyBookable: false, description: 'Auslieferungen & Einweisungen' },
  { id: 'media',     name: 'Mediapaket',       color: '#ec4899', icon: 'Megaphone',      active: true, publicBookable: true,  defaultDurationMinutes: 45, responsibleEmployeeIds: ['e4'], internalVisible: true,  externallyBookable: true,  description: 'Mediapaket-Termine' },
  { id: 'training',  name: 'Schulung',         color: '#8b5cf6', icon: 'GraduationCap',  active: true, publicBookable: true,  defaultDurationMinutes: 120, responsibleEmployeeIds: ['e5'], internalVisible: true, externallyBookable: true,  description: 'Allgemeine Schulungen' },
  { id: 'nisv-virt', name: 'NiSV Virtuell',    color: '#06b6d4', icon: 'MonitorPlay',    active: true, publicBookable: true,  defaultDurationMinutes: 60, responsibleEmployeeIds: ['e5'], internalVisible: true,  externallyBookable: true,  description: 'NiSV virtuelle Schulungen' },
  { id: 'nisv-pres', name: 'NiSV Präsenz',     color: '#0ea5e9', icon: 'Users',          active: true, publicBookable: true,  defaultDurationMinutes: 240, responsibleEmployeeIds: ['e5'], internalVisible: true, externallyBookable: true,  description: 'NiSV Präsenzschulungen' },
  { id: 'marketing', name: 'Marketing',        color: '#f43f5e', icon: 'Sparkles',       active: true, publicBookable: false, defaultDurationMinutes: 60, responsibleEmployeeIds: [],     internalVisible: true,  externallyBookable: false, description: 'Marketing-Termine' },
  { id: 'tech',      name: 'Technik',          color: '#22c55e', icon: 'Cog',            active: true, publicBookable: false, defaultDurationMinutes: 60, responsibleEmployeeIds: [],     internalVisible: true,  externallyBookable: false, description: 'Technik-Termine' },
  { id: 'finance',   name: 'Buchhaltung',      color: '#eab308', icon: 'Banknote',       active: true, publicBookable: false, defaultDurationMinutes: 30, responsibleEmployeeIds: [],     internalVisible: true,  externallyBookable: false, description: 'Buchhaltung' },
  { id: 'admin',     name: 'Administration',   color: '#94a3b8', icon: 'Settings',       active: true, publicBookable: false, defaultDurationMinutes: 30, responsibleEmployeeIds: [], internalVisible: true,  externallyBookable: false, description: 'Interne Administration' },
  { id: 'exec',      name: 'Geschäftsleitung', color: '#f59e0b', icon: 'Crown',          active: true, publicBookable: false, defaultDurationMinutes: 60, responsibleEmployeeIds: [],     internalVisible: true,  externallyBookable: false, description: 'Geschäftsleitungstermine' },
];

export const MOCK_EMPLOYEES: EscEmployee[] = [
  { id: 'e1', name: 'Natalia P.',      email: 'natalia.p@alix-operation.de', role: 'Vertrieb',        departmentIds: ['sales'],              active: true, publicBookable: true,  location: 'DE',  color: 'hsl(var(--primary))' },
  { id: 'e2', name: 'René D.',          email: 'rde@alix-lasers.com',         role: 'Service',         departmentIds: ['service', 'tech'],    active: true, publicBookable: true,  location: 'DE',  color: 'hsl(var(--accent))' },
  { id: 'e3', name: 'Team Lieferung',  email: 'logistik@alix-lasers.com',    role: 'Tourenplanung',   departmentIds: ['delivery'],           active: true, publicBookable: false, location: 'DE',  color: 'hsl(var(--secondary))' },
  { id: 'e4', name: 'Marketing Team',  email: 'marketing@alix-lasers.com',   role: 'Marketing',       departmentIds: ['media', 'marketing'], active: true, publicBookable: true,  location: 'DE',  color: 'hsl(var(--primary))' },
  { id: 'e5', name: 'Schulungsteam',   email: 'schulung@alix-lasers.com',    role: 'Schulung',        departmentIds: ['training', 'nisv-virt', 'nisv-pres'], active: true, publicBookable: true, location: 'DE', color: 'hsl(var(--accent))' },
];

export const MOCK_RESOURCES: EscResource[] = [
  { id: 'r1', name: 'Schulungsraum 1',  type: 'room',    location: 'Stuttgart', capacity: 12, active: true },
  { id: 'r2', name: 'Schulungsraum 2',  type: 'room',    location: 'Wien',      capacity: 8,  active: true },
  { id: 'r3', name: 'Demo-Gerät Pro',   type: 'device',                              active: true },
  { id: 'r4', name: 'Servicewagen 1',   type: 'vehicle', location: 'DE',              active: true },
];

// A few sample appointments across the current week
function iso(offsetDays: number, hour: number, minute = 0, durationMin = 60): { start: string; end: string } {
  const s = new Date();
  s.setDate(s.getDate() + offsetDays);
  s.setHours(hour, minute, 0, 0);
  const e = new Date(s.getTime() + durationMin * 60_000);
  return { start: s.toISOString(), end: e.toISOString() };
}

const now = new Date().toISOString();
const t = (o: number, h: number, m = 0, d = 60) => iso(o, h, m, d);

export const MOCK_APPOINTMENTS: EscAppointment[] = [
  { id: 'a1',  title: 'Sales-Demo Praxis Müller', ...(() => { const x = t(0, 10); return { startAt: x.start, endAt: x.end }; })(), departmentId: 'sales', employeeIds: ['e1'], customerName: 'Praxis Müller', customerEmail: 'muster@praxis-mueller.de', status: 'bestaetigt', priority: 'normal', confirmationRequired: true, createdAt: now, updatedAt: now },
  { id: 'a2',  title: 'Serviceeinsatz Klinik Nord', ...(() => { const x = t(0, 14, 0, 120); return { startAt: x.start, endAt: x.end }; })(), departmentId: 'service', employeeIds: ['e2'], customerName: 'Klinik Nord', status: 'geplant', priority: 'high', confirmationRequired: false, createdAt: now, updatedAt: now },
  { id: 'a3',  title: 'Lieferung Dr. Schmidt', ...(() => { const x = t(1, 9, 30, 90); return { startAt: x.start, endAt: x.end }; })(), departmentId: 'delivery', employeeIds: ['e3'], customerName: 'Dr. Schmidt', address: 'Berlin', status: 'bestaetigung_offen', priority: 'normal', confirmationRequired: true, createdAt: now, updatedAt: now },
  { id: 'a4',  title: 'NiSV Virtuell Modul 1', ...(() => { const x = t(2, 18, 0, 60); return { startAt: x.start, endAt: x.end }; })(), departmentId: 'nisv-virt', employeeIds: ['e5'], resourceId: 'r1', status: 'angefragt', priority: 'normal', confirmationRequired: true, createdAt: now, updatedAt: now },
  { id: 'a5',  title: 'Mediapaket Aufnahme', ...(() => { const x = t(3, 11, 0, 45); return { startAt: x.start, endAt: x.end }; })(), departmentId: 'media', employeeIds: ['e4'], status: 'bestaetigt', priority: 'normal', confirmationRequired: false, createdAt: now, updatedAt: now },
  { id: 'a6',  title: 'GL Wochenmeeting', ...(() => { const x = t(4, 9, 0, 60); return { startAt: x.start, endAt: x.end }; })(), departmentId: 'exec', employeeIds: [], status: 'geplant', priority: 'normal', confirmationRequired: false, createdAt: now, updatedAt: now },
];

// Enterprise Scheduling Center – Type definitions
// Kept framework-agnostic so Prompt 2 can swap the data layer to Supabase without UI changes.

export type EscStatus =
  | 'geplant'
  | 'angefragt'
  | 'bestaetigung_offen'
  | 'bestaetigt'
  | 'abgelehnt'
  | 'verschoben'
  | 'storniert'
  | 'abgeschlossen'
  | 'nicht_erschienen';

export type EscPriority = 'low' | 'normal' | 'high' | 'urgent';

export type EscView =
  | 'day'
  | 'week'
  | 'month'
  | 'agenda'
  | 'department'
  | 'employee'
  | 'resource';

export interface EscDepartment {
  id: string;
  name: string;
  color: string;              // semantic token OR css color
  icon: string;               // lucide icon name
  description?: string;
  active: boolean;
  publicBookable: boolean;
  defaultDurationMinutes: number;
  defaultEmailTemplate?: string;
  responsibleEmployeeIds: string[];
  internalVisible: boolean;
  externallyBookable: boolean;
  sortOrder?: number;
}

export interface EscEmployee {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  departmentIds: string[];
  location?: string;
  workingHours?: { from: string; to: string; weekdays: number[] };
  color?: string;
  qualifications?: string[];
  active: boolean;
  publicBookable: boolean;
}

export interface EscResource {
  id: string;
  name: string;
  type: 'room' | 'device' | 'vehicle' | 'other';
  location?: string;
  capacity?: number;
  active: boolean;
}

export interface EscAppointment {
  id: string;
  title: string;
  description?: string;
  startAt: string;             // ISO
  endAt: string;               // ISO
  departmentId: string;
  kind?: string;               // Terminart
  employeeIds: string[];
  customerName?: string;
  customerContact?: string;
  customerEmail?: string;
  customerPhone?: string;
  address?: string;
  location?: string;
  room?: string;
  deviceId?: string;
  resourceId?: string;
  status: EscStatus;
  priority: EscPriority;
  internalNote?: string;
  externalNote?: string;
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly';
  reminderMinutes?: number;
  attachments?: { name: string; url: string }[];
  confirmationRequired: boolean;
  confirmationToken?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

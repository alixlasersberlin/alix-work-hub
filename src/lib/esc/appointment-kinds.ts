export interface EscAppointmentKind {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon?: string;
  defaultDurationMinutes: number;
  active: boolean;
  publicBookable: boolean;
  departmentIds: string[]; // leer = alle Abteilungen
}

export const MOCK_APPOINTMENT_KINDS: EscAppointmentKind[] = [
  { id: 'k-beratung',       name: 'Beratung',         color: '#3b82f6', icon: 'MessageSquare', defaultDurationMinutes: 60, active: true, publicBookable: true,  departmentIds: [] },
  { id: 'k-online-demo',    name: 'Online Demo',      color: '#10b981', icon: 'Monitor',       defaultDurationMinutes: 60, active: true, publicBookable: true,  departmentIds: [] },
  { id: 'k-vorfuehrung',    name: 'Vorführung',       color: '#a855f7', icon: 'Presentation',  defaultDurationMinutes: 60, active: true, publicBookable: true,  departmentIds: [] },
  { id: 'k-einweisung',     name: 'Geräteeinweisung', color: '#f59e0b', icon: 'Wrench',        defaultDurationMinutes: 60, active: true, publicBookable: true,  departmentIds: [] },
  { id: 'k-produktschulung',name: 'Produktschulung',  color: '#ec4899', icon: 'GraduationCap', defaultDurationMinutes: 60, active: true, publicBookable: true,  departmentIds: [] },
  { id: 'k-schulung-vip',   name: 'Schulung VIP',     color: '#22c55e', icon: 'Crown',         defaultDurationMinutes: 120, active: true, publicBookable: false, departmentIds: [] },
  { id: 'k-service',        name: 'Service',          color: '#64748b', icon: 'Wrench',        defaultDurationMinutes: 60, active: true, publicBookable: false, departmentIds: [] },
  { id: 'k-reparatur',      name: 'Reparatur',        color: '#ef4444', icon: 'Hammer',        defaultDurationMinutes: 60, active: true, publicBookable: false, departmentIds: [] },
  { id: 'k-auslieferung',   name: 'Auslieferung',     color: '#f97316', icon: 'Truck',         defaultDurationMinutes: 120, active: true, publicBookable: false, departmentIds: [] },
  { id: 'k-umzug',          name: 'Umzug',            color: '#0ea5e9', icon: 'Package',       defaultDurationMinutes: 240, active: true, publicBookable: false, departmentIds: [] },
  { id: 'k-werkstatt',      name: 'Werkstatt',        color: '#84cc16', icon: 'Wrench',        defaultDurationMinutes: 90, active: true, publicBookable: false, departmentIds: [] },
];


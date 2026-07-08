// Mock data for the enterprise resource management scaffold.
// Real data will be persisted in Prompt-8 tables (rm_* namespace).

import type {
  RmLocation, RmQualification, RmEmployeeExt, RmVehicle, RmRoom,
  RmDemoDevice, RmAbsence, RmMaintenanceTask,
} from './types';

export const RM_LOCATIONS: RmLocation[] = [
  { id: 'berlin', name: 'Berlin',  timezone: 'Europe/Berlin', country: 'DE' },
  { id: 'wien',   name: 'Wien',    timezone: 'Europe/Vienna', country: 'AT' },
  { id: 'dubai',  name: 'Dubai',   timezone: 'Asia/Dubai',    country: 'AE' },
  { id: 'miami',  name: 'Miami',   timezone: 'America/New_York', country: 'US' },
  { id: 'riga',   name: 'Riga',    timezone: 'Europe/Riga',   country: 'LV' },
];

export const RM_QUALIFICATIONS: RmQualification[] = [
  { id: 'q-nisv', name: 'NiSV Dozent', category: 'nisv' },
  { id: 'q-laser', name: 'Lasertrainer', category: 'safety' },
  { id: 'q-tech', name: 'Servicetechniker', category: 'service' },
  { id: 'q-elektronik', name: 'Elektronik', category: 'service' },
  { id: 'q-mp', name: 'Medizinprodukte', category: 'iso' },
  { id: 'q-iso', name: 'ISO 13485', category: 'iso' },
  { id: 'q-mdr', name: 'MDR', category: 'iso' },
  { id: 'q-vertrieb', name: 'Vertrieb', category: 'sales' },
  { id: 'q-marketing', name: 'Marketing', category: 'other' },
  { id: 'q-außendienst', name: 'Außendienst', category: 'sales' },
  { id: 'q-admin', name: 'Administrator', category: 'other' },
];

export const RM_EMPLOYEES: RmEmployeeExt[] = [
  {
    id: 'e-anna', name: 'Anna Weber', role: 'Servicetechnikerin',
    locationId: 'berlin', qualifications: ['q-tech', 'q-elektronik', 'q-mp'],
    shifts: [1,2,3,4,5].map((w) => ({ weekday: w, from: '08:00', to: '17:00' })),
    color: '#4f46e5', driverLicense: ['B'], languages: ['de', 'en'],
    maxAppointmentsPerDay: 4, maxTravelMinutes: 240, maxWorkMinutes: 540, active: true,
  },
  {
    id: 'e-tobias', name: 'Tobias Meyer', role: 'Sales',
    locationId: 'berlin', qualifications: ['q-vertrieb', 'q-nisv'],
    shifts: [1,2,3,4,5].map((w) => ({ weekday: w, from: '09:00', to: '18:00' })),
    color: '#0ea5e9', languages: ['de', 'en'], active: true,
  },
  {
    id: 'e-lena', name: 'Lena Hofer', role: 'Trainerin',
    locationId: 'wien', qualifications: ['q-nisv', 'q-laser'],
    shifts: [1,2,3,4,5].map((w) => ({ weekday: w, from: '08:30', to: '17:30' })),
    color: '#22c55e', languages: ['de', 'en'], active: true,
  },
  {
    id: 'e-jamal', name: 'Jamal Al-Farsi', role: 'Sales International',
    locationId: 'dubai', qualifications: ['q-vertrieb'],
    shifts: [0,1,2,3,4].map((w) => ({ weekday: w, from: '09:00', to: '18:00' })),
    color: '#f59e0b', languages: ['ar', 'en'], active: true,
  },
];

export const RM_VEHICLES: RmVehicle[] = [
  { id: 'v-01', plate: 'B-AW 100', brand: 'VW', model: 'Transporter', year: 2023, mileageKm: 42000, tuvUntil: '2027-04-01', nextServiceAt: '2026-09-01', locationId: 'berlin', color: '#0ea5e9', status: 'available', gpsEnabled: true },
  { id: 'v-02', plate: 'W-AX 210', brand: 'MB',  model: 'Sprinter',    year: 2022, mileageKm: 87000, tuvUntil: '2026-11-01', locationId: 'wien',   color: '#f97316', status: 'available' },
  { id: 'v-03', plate: 'B-AW 300', brand: 'Tesla', model: 'Model Y',  year: 2024, mileageKm: 15000, locationId: 'berlin', color: '#a855f7', status: 'maintenance' },
];

export const RM_ROOMS: RmRoom[] = [
  { id: 'r-schulung-1', name: 'Schulungsraum 1', locationId: 'berlin', capacity: 16, amenities: ['beamer', 'whiteboard', 'laser', 'internet'], status: 'available' },
  { id: 'r-schulung-2', name: 'Schulungsraum 2', locationId: 'berlin', capacity: 10, amenities: ['tv', 'ems', 'internet'], status: 'available' },
  { id: 'r-konf-1',     name: 'Konferenz Berlin', locationId: 'berlin', capacity: 24, amenities: ['beamer', 'tv', 'internet', 'telefon'], status: 'available' },
  { id: 'r-showroom-w', name: 'Showroom Wien',    locationId: 'wien',   capacity: 40, amenities: ['laser', 'ems', 'internet'], accessible: true, status: 'available' },
];

export const RM_DEMO_DEVICES: RmDemoDevice[] = [
  { id: 'd-blueice-1', name: 'BlueIce #1', model: 'BlueIce', locationId: 'berlin', status: 'available' },
  { id: 'd-shark-1',   name: 'SHARK #1',   model: 'SHARK',   locationId: 'berlin', status: 'reserved' },
  { id: 'd-aesthera-1', name: 'AESTHERA PRO #1', model: 'AESTHERA PRO', locationId: 'wien', status: 'with_customer' },
  { id: 'd-hifu-1',    name: 'HIFU #1',    model: 'HIFU',    locationId: 'berlin', status: 'showroom' },
  { id: 'd-ems-1',     name: 'EMS #1',     model: 'EMS',     locationId: 'wien',   status: 'fair' },
  { id: 'd-hydra-1',   name: 'Hydra #1',   model: 'Hydra',   locationId: 'berlin', status: 'service' },
];

export const RM_ABSENCES: RmAbsence[] = [];

export const RM_MAINTENANCE: RmMaintenanceTask[] = [
  { id: 'm-v03', resourceId: 'v-03', resourceKind: 'vehicle', dueAt: new Date().toISOString(), title: 'Fahrzeug 03 – Werkstattcheck', severity: 'due' },
  { id: 'm-hifu', resourceId: 'd-hifu-1', resourceKind: 'demo_device', dueAt: new Date(Date.now() + 7 * 864e5).toISOString(), title: 'HIFU #1 – Kalibrierung', severity: 'info' },
];

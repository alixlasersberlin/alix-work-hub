// Enterprise resource management types for ESC.
// Additive – existing ESC types remain unchanged.

export type RmResourceKind =
  | 'employee' | 'vehicle' | 'laser' | 'demo_device' | 'training_room'
  | 'meeting_room' | 'conference_room' | 'showroom' | 'storage'
  | 'equipment' | 'fair_material' | 'presentation_tech' | 'spare_device'
  | 'custom';

export const RM_KIND_LABELS: Record<RmResourceKind, string> = {
  employee: 'Mitarbeiter', vehicle: 'Fahrzeug', laser: 'Lasersystem',
  demo_device: 'Vorführgerät', training_room: 'Schulungsraum',
  meeting_room: 'Besprechungsraum', conference_room: 'Konferenzraum',
  showroom: 'Showroom', storage: 'Lagerplatz', equipment: 'Equipment',
  fair_material: 'Messematerial', presentation_tech: 'Präsentationstechnik',
  spare_device: 'Ersatzgerät', custom: 'Sonstige',
};

export interface RmLocation {
  id: string;
  name: string;
  timezone: string;
  country?: string;
  holidays?: string[];
}

export interface RmQualification {
  id: string;
  name: string;
  category?: 'nisv' | 'service' | 'sales' | 'iso' | 'safety' | 'other';
  expiresAt?: string;
}

export interface RmShift { weekday: number; from: string; to: string; }

export interface RmEmployeeExt {
  id: string;
  name: string;
  role?: string;
  departments?: string[];
  locationId?: string;
  qualifications: string[];
  shifts: RmShift[];
  color?: string;
  driverLicense?: string[];
  languages?: string[];
  maxAppointmentsPerDay?: number;
  maxTravelMinutes?: number;
  maxWorkMinutes?: number;
  substituteId?: string;
  active: boolean;
}

export interface RmVehicle {
  id: string;
  plate: string;
  brand?: string;
  model?: string;
  year?: number;
  mileageKm?: number;
  fuelCard?: string;
  insurance?: string;
  tuvUntil?: string;
  nextServiceAt?: string;
  driverId?: string;
  locationId?: string;
  color?: string;
  status: 'available' | 'assigned' | 'maintenance' | 'unavailable';
  gpsEnabled?: boolean;
}

export interface RmRoom {
  id: string;
  name: string;
  locationId?: string;
  capacity?: number;
  amenities: string[];       // z. B. beamer, tv, laser, ems, whiteboard
  accessible?: boolean;
  status: 'available' | 'blocked' | 'maintenance';
}

export interface RmDemoDevice {
  id: string;
  name: string;
  model: string;
  serialNumber?: string;
  locationId?: string;
  status: 'available' | 'reserved' | 'in_transit' | 'with_customer'
        | 'service' | 'fair' | 'showroom';
}

export interface RmSpareDeviceLoan {
  id: string;
  spareDeviceId: string;
  originalDeviceId?: string;
  customerId?: string;
  technicianId?: string;
  from: string;
  to?: string;
  note?: string;
}

export type RmAbsenceKind =
  | 'vacation' | 'sick' | 'training' | 'homeoffice'
  | 'business_trip' | 'fair' | 'holiday' | 'part_time' | 'blocked';

export interface RmAbsence {
  id: string;
  resourceId: string;         // employee | vehicle | room
  kind: RmAbsenceKind;
  from: string;
  to: string;
  note?: string;
  approvedBy?: string;
}

export interface RmMaintenanceTask {
  id: string;
  resourceId: string;
  resourceKind: RmResourceKind;
  dueAt: string;
  title: string;
  severity: 'info' | 'due' | 'overdue';
}

export interface RmConflict {
  code:
    | 'busy' | 'off_hours' | 'absence' | 'qualification_missing'
    | 'location_mismatch' | 'over_capacity' | 'maintenance_due'
    | 'travel_budget_exceeded';
  message: string;
  severity: 'info' | 'warning' | 'error';
}

export interface RmAssignmentInput {
  employeeIds?: string[];
  vehicleId?: string;
  roomId?: string;
  demoDeviceId?: string;
  from: string;
  to: string;
  requiredQualifications?: string[];
  locationId?: string;
}

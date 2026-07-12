// Resource management store – now backed by Supabase (systemweit geteilt, Realtime).
import { useCallback } from 'react';
import {
  RM_EMPLOYEES, RM_VEHICLES, RM_ROOMS, RM_DEMO_DEVICES,
  RM_ABSENCES, RM_MAINTENANCE, RM_LOCATIONS, RM_QUALIFICATIONS,
} from '@/lib/esc/resources/mock';
import type {
  RmEmployeeExt, RmVehicle, RmRoom, RmDemoDevice,
  RmAbsence, RmMaintenanceTask, RmLocation, RmQualification,
} from '@/lib/esc/resources/types';
import { useEscStore } from '@/lib/esc/store/kvStore';

export function useResourceMgmt() {
  const employeesS   = useEscStore<RmEmployeeExt>({ table: 'esc_store_rm_employees',    getId: (x) => x.id, seed: RM_EMPLOYEES });
  const vehiclesS    = useEscStore<RmVehicle>({    table: 'esc_store_rm_vehicles',     getId: (x) => x.id, seed: RM_VEHICLES });
  const roomsS       = useEscStore<RmRoom>({       table: 'esc_store_rm_rooms',        getId: (x) => x.id, seed: RM_ROOMS });
  const demoDevicesS = useEscStore<RmDemoDevice>({ table: 'esc_store_rm_demo_devices', getId: (x) => x.id, seed: RM_DEMO_DEVICES });
  const absencesS    = useEscStore<RmAbsence>({    table: 'esc_store_rm_absences',     getId: (x) => x.id, seed: RM_ABSENCES });
  const maintenanceS = useEscStore<RmMaintenanceTask>({ table: 'esc_store_rm_maintenance', getId: (x) => x.id, seed: RM_MAINTENANCE });
  const locationsS   = useEscStore<RmLocation>({   table: 'esc_store_rm_locations',    getId: (x) => x.id, seed: RM_LOCATIONS });
  const qualsS       = useEscStore<RmQualification>({ table: 'esc_store_rm_qualifications', getId: (x) => x.id, seed: RM_QUALIFICATIONS });

  const upsertEmployee   = useCallback((e: RmEmployeeExt)      => { void employeesS.upsert(e); }, [employeesS]);
  const removeEmployee   = useCallback((id: string)            => { void employeesS.remove(id); }, [employeesS]);
  const upsertVehicle    = useCallback((v: RmVehicle)          => { void vehiclesS.upsert(v); }, [vehiclesS]);
  const removeVehicle    = useCallback((id: string)            => { void vehiclesS.remove(id); }, [vehiclesS]);
  const upsertRoom       = useCallback((r: RmRoom)             => { void roomsS.upsert(r); }, [roomsS]);
  const removeRoom       = useCallback((id: string)            => { void roomsS.remove(id); }, [roomsS]);
  const upsertDemoDevice = useCallback((d: RmDemoDevice)       => { void demoDevicesS.upsert(d); }, [demoDevicesS]);
  const removeDemoDevice = useCallback((id: string)            => { void demoDevicesS.remove(id); }, [demoDevicesS]);
  const upsertAbsence    = useCallback((a: RmAbsence)          => { void absencesS.upsert(a); }, [absencesS]);
  const removeAbsence    = useCallback((id: string)            => { void absencesS.remove(id); }, [absencesS]);
  const upsertLocation   = useCallback((l: RmLocation)         => { void locationsS.upsert(l); }, [locationsS]);
  const removeLocation   = useCallback((id: string)            => { void locationsS.remove(id); }, [locationsS]);

  return {
    employees: employeesS.items,
    vehicles: vehiclesS.items,
    rooms: roomsS.items,
    demoDevices: demoDevicesS.items,
    absences: absencesS.items,
    maintenance: maintenanceS.items,
    locations: locationsS.items.length ? locationsS.items : RM_LOCATIONS,
    qualifications: qualsS.items.length ? qualsS.items : RM_QUALIFICATIONS,
    upsertEmployee, removeEmployee,
    upsertVehicle, removeVehicle,
    upsertRoom, removeRoom,
    upsertDemoDevice, removeDemoDevice,
    upsertAbsence, removeAbsence,
    upsertLocation, removeLocation,
  };
}

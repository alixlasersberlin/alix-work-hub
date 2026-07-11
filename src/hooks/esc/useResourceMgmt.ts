// In-memory store for the resource management scaffold.
// Later replaces with Supabase-backed hooks; API stays stable.

import { useCallback, useEffect, useState } from 'react';
import {
  RM_EMPLOYEES, RM_VEHICLES, RM_ROOMS, RM_DEMO_DEVICES,
  RM_ABSENCES, RM_MAINTENANCE, RM_LOCATIONS, RM_QUALIFICATIONS,
} from '@/lib/esc/resources/mock';
import type {
  RmEmployeeExt, RmVehicle, RmRoom, RmDemoDevice,
  RmAbsence, RmMaintenanceTask,
} from '@/lib/esc/resources/types';

interface RmState {
  employees: RmEmployeeExt[];
  vehicles: RmVehicle[];
  rooms: RmRoom[];
  demoDevices: RmDemoDevice[];
  absences: RmAbsence[];
  maintenance: RmMaintenanceTask[];
}

let store: RmState = {
  employees: [...RM_EMPLOYEES],
  vehicles: [...RM_VEHICLES],
  rooms: [...RM_ROOMS],
  demoDevices: [...RM_DEMO_DEVICES],
  absences: [...RM_ABSENCES],
  maintenance: [...RM_MAINTENANCE],
};
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

const upsert = <T extends { id: string }>(arr: T[], item: T): T[] => {
  const i = arr.findIndex((x) => x.id === item.id);
  if (i === -1) return [...arr, item];
  const copy = [...arr];
  copy[i] = item;
  return copy;
};

export function useResourceMgmt() {
  const [state, setState] = useState<RmState>(store);
  useEffect(() => {
    const l = () => setState({ ...store });
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  const upsertAbsence = useCallback((a: RmAbsence) => {
    store = { ...store, absences: upsert(store.absences, a) };
    notify();
  }, []);
  const removeAbsence = useCallback((id: string) => {
    store = { ...store, absences: store.absences.filter((x) => x.id !== id) };
    notify();
  }, []);

  const upsertEmployee = useCallback((e: RmEmployeeExt) => {
    store = { ...store, employees: upsert(store.employees, e) }; notify();
  }, []);
  const removeEmployee = useCallback((id: string) => {
    store = { ...store, employees: store.employees.filter((x) => x.id !== id) }; notify();
  }, []);

  const upsertVehicle = useCallback((v: RmVehicle) => {
    store = { ...store, vehicles: upsert(store.vehicles, v) }; notify();
  }, []);
  const removeVehicle = useCallback((id: string) => {
    store = { ...store, vehicles: store.vehicles.filter((x) => x.id !== id) }; notify();
  }, []);

  const upsertRoom = useCallback((r: RmRoom) => {
    store = { ...store, rooms: upsert(store.rooms, r) }; notify();
  }, []);
  const removeRoom = useCallback((id: string) => {
    store = { ...store, rooms: store.rooms.filter((x) => x.id !== id) }; notify();
  }, []);

  const upsertDemoDevice = useCallback((d: RmDemoDevice) => {
    store = { ...store, demoDevices: upsert(store.demoDevices, d) }; notify();
  }, []);
  const removeDemoDevice = useCallback((id: string) => {
    store = { ...store, demoDevices: store.demoDevices.filter((x) => x.id !== id) }; notify();
  }, []);

  return {
    ...state,
    locations: RM_LOCATIONS,
    qualifications: RM_QUALIFICATIONS,
    upsertAbsence, removeAbsence,
    upsertEmployee, removeEmployee,
    upsertVehicle, removeVehicle,
    upsertRoom, removeRoom,
    upsertDemoDevice, removeDemoDevice,
  };
}

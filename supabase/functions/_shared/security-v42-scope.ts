import { z } from 'npm:zod@3';
export const DeliveryRouteBody = z.object({ tour_id: z.string().uuid(), optimize: z.boolean().optional(), start_address: z.string().trim().min(1).max(1000).optional() });
export const CalendarSyncBody = z.object({ user_id: z.string().uuid().optional() });
export const DELIVERY_ROUTE_ROLES = ['Super Admin', 'Admin', 'Tourenplanung', 'Order', 'Auftragsverwaltung', 'SACHBEARBEITUNG'];
export function ownCalendarScope(callerId: string, requestedId?: string): boolean {
  return requestedId === undefined || requestedId === callerId;
}
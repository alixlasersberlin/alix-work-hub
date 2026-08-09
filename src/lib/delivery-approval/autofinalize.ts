import { supabase } from '@/integrations/supabase/client';
import { archiveApprovalPdf, mailApprovalPdf } from './archive';
import { fetchApproval, fetchEvents, isReleased, type DeliveryApproval } from './api';

const db = supabase as any;

/** Empfänger des automatischen Protokollversands (Buchhaltung / Leitung). */
export const AUTO_PROTOCOL_RECIPIENTS = ['k.trinh@alix-operation.de', 'jh@alix-operation.de'];

async function orderInfo(orderId: string) {
  const { data } = await db
    .from('orders')
    .select('order_number, customer_id, customer_name')
    .eq('id', orderId)
    .maybeSingle();
  return {
    orderNumber: data?.order_number ?? null,
    customerId: data?.customer_id ?? null,
    customerName: data?.customer_name ?? null,
  };
}

/** Fahrer benachrichtigen, wenn eine Freigabe während einer laufenden Tour nachträglich erteilt wird. */
async function notifyDrivers(orderId: string, orderNumber: string | null) {
  try {
    const { data: appts } = await db
      .from('delivery_appointments')
      .select('tour_id')
      .eq('order_id', orderId);
    const tourIds = [...new Set(((appts ?? []) as any[]).map((a) => a.tour_id).filter(Boolean))];
    if (!tourIds.length) return;
    const { data: tours } = await db
      .from('delivery_tours')
      .select('id, driver_id, codriver_id, status')
      .in('id', tourIds);
    const driverIds = [...new Set(((tours ?? []) as any[])
      .flatMap((t) => [t.driver_id, t.codriver_id])
      .filter(Boolean))];
    if (!driverIds.length) return;
    const { data: drivers } = await db.from('drivers').select('user_id').in('id', driverIds);
    const userIds = [...new Set(((drivers ?? []) as any[]).map((d) => d.user_id).filter(Boolean))];
    if (!userIds.length) return;
    await db.from('app_notifications').insert(userIds.map((uid) => ({
      user_id: uid,
      category: 'operations',
      title: 'Auslieferung freigegeben',
      message: `Auftrag ${orderNumber ?? orderId.slice(0, 8)} ist jetzt freigegeben – Übergabe möglich.`,
      priority: 'high',
      action_url: '/m',
    })));
  } catch { /* optional */ }
}

/**
 * Vollautomatik bei Erreichen des Status „freigegeben":
 * Protokoll in AlixDocs archivieren, per E-Mail versenden und Fahrer informieren.
 * Läuft idempotent – bereits protokollierte Schritte werden übersprungen.
 */
export async function autoFinalizeRelease(orderIdOrApproval: string | DeliveryApproval): Promise<void> {
  try {
    const approval = typeof orderIdOrApproval === 'string'
      ? await fetchApproval(orderIdOrApproval)
      : orderIdOrApproval;
    if (!approval || !isReleased(approval)) return;

    const events = await fetchEvents(approval.order_id);
    const done = new Set(events.map((e) => e.stage));
    const info = await orderInfo(approval.order_id);
    const params = {
      approval,
      events,
      orderNumber: info.orderNumber,
      customerId: info.customerId,
      customerName: info.customerName,
    };

    if (!done.has('archive')) {
      try { await archiveApprovalPdf(params); } catch { /* Archivierung optional */ }
    }
    if (!done.has('mail')) {
      try {
        await mailApprovalPdf({
          ...params,
          to: AUTO_PROTOCOL_RECIPIENTS,
          note: 'Automatischer Versand nach vollständiger Freigabe.',
        });
      } catch { /* Versand optional */ }
    }
    await notifyDrivers(approval.order_id, info.orderNumber);
  } catch { /* nie den UI-Flow blockieren */ }
}

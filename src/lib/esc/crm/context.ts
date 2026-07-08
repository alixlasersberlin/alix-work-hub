import { supabase } from '@/integrations/supabase/client';
import type {
  CrmCustomerContext, CrmDevice, CrmOffer, CrmInvoice, CrmTicket,
  CrmServiceEvent, CrmTraining, CrmDocument, CrmTimelineEntry, CrmCustomerSummary,
} from './types';
import { getCustomerSummary } from './search';

export async function loadCustomerContext(customerId: string): Promise<CrmCustomerContext | null> {
  const customer = await getCustomerSummary(customerId);
  if (!customer) return null;

  const [devices, offers, invoices, tickets, services, trainings, documents] = await Promise.all([
    loadDevices(customer),
    loadOffers(customerId),
    loadInvoices(customerId),
    loadTickets(customer),
    loadServices(customerId),
    loadTrainings(customerId),
    loadDocuments(customerId),
  ]);

  const timeline: CrmTimelineEntry[] = [
    ...offers.map((o) => ({ id: `o-${o.id}`, at: o.createdAt || '', kind: 'Angebot', title: o.number || 'Angebot', meta: o.status || null })),
    ...invoices.map((i) => ({ id: `i-${i.id}`, at: i.dueDate || '', kind: 'Rechnung', title: i.number || 'Rechnung', meta: i.status || null })),
    ...tickets.map((t) => ({ id: `t-${t.id}`, at: t.createdAt || '', kind: 'Ticket', title: t.subject || t.number || 'Ticket', meta: t.status || null })),
    ...services.map((s) => ({ id: `s-${s.id}`, at: s.at, kind: 'Service', title: s.title, meta: s.status || null })),
    ...trainings.map((tr) => ({ id: `tr-${tr.id}`, at: tr.at || '', kind: 'Schulung', title: tr.title, meta: tr.status || null })),
  ].filter((e) => e.at).sort((a, b) => (a.at < b.at ? 1 : -1));

  return { customer, devices, offers, invoices, tickets, services, trainings, documents, timeline };
}

async function loadDevices(customer: CrmCustomerSummary): Promise<CrmDevice[]> {
  // lager_devices has no customer_id — match by email / name
  const filters: string[] = [];
  if (customer.email) filters.push(`customer_email.ilike.${customer.email}`);
  if (customer.companyName) filters.push(`customer_name.ilike.%${customer.companyName}%`);
  if (!filters.length) return [];
  const { data } = await supabase
    .from('lager_devices')
    .select('id, model_name, serial_number, device_status, last_service_date, next_service_date, commissioning_date')
    .or(filters.join(','))
    .limit(50);
  return (data || []).map((d: any) => ({
    id: d.id,
    model: d.model_name,
    serialNumber: d.serial_number,
    status: d.device_status,
    warrantyUntil: null,
    installedAt: d.commissioning_date,
    lastServiceAt: d.last_service_date,
    nextServiceAt: d.next_service_date,
  }));
}

async function loadOffers(customerId: string): Promise<CrmOffer[]> {
  const { data } = await supabase
    .from('offers')
    .select('id, offer_number, status, total_gross, created_at')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(30);
  return (data || []).map((o: any) => ({
    id: o.id, number: o.offer_number, status: o.status,
    total: o.total_gross, currency: 'EUR', createdAt: o.created_at,
  }));
}

async function loadInvoices(customerId: string): Promise<CrmInvoice[]> {
  const { data } = await supabase
    .from('zoho_invoices')
    .select('id, invoice_number, status, total, currency, due_date')
    .eq('customer_id', customerId)
    .order('due_date', { ascending: false })
    .limit(30);
  return (data || []).map((i: any) => ({
    id: i.id, number: i.invoice_number, status: i.status,
    total: i.total, currency: i.currency, dueDate: i.due_date,
    paid: (i.status || '').toLowerCase() === 'paid',
  }));
}

async function loadTickets(customer: CrmCustomerSummary): Promise<CrmTicket[]> {
  // tickets has no customer_id — match by email or company_name
  const filters: string[] = [];
  if (customer.email) filters.push(`customer_email.ilike.${customer.email}`);
  if (customer.companyName) filters.push(`company_name.ilike.%${customer.companyName}%`);
  if (!filters.length) return [];
  const { data } = await supabase
    .from('tickets')
    .select('id, ticket_number, subject, status, priority, created_at')
    .or(filters.join(','))
    .order('created_at', { ascending: false })
    .limit(30);
  return (data || []).map((t: any) => ({
    id: t.id, number: t.ticket_number, subject: t.subject,
    status: t.status, priority: t.priority, createdAt: t.created_at,
  }));
}

async function loadServices(customerId: string): Promise<CrmServiceEvent[]> {
  const { data } = await supabase
    .from('repair_orders')
    .select('id, order_number, repair_status, created_at')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(30);
  return (data || []).map((r: any) => ({
    id: r.id,
    kind: 'reparatur',
    title: r.order_number || 'Reparatur',
    at: r.created_at,
    status: r.repair_status,
  }));
}

async function loadTrainings(customerId: string): Promise<CrmTraining[]> {
  const { data } = await supabase
    .from('academy_bookings')
    .select('id, academy_session_id, booking_status, created_at')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(30);
  return (data || []).map((b: any) => ({
    id: b.id,
    title: `Schulung ${(b.academy_session_id || '').slice(0, 6)}`.trim(),
    status: b.booking_status,
    at: b.created_at,
    nisv: false,
  }));
}

async function loadDocuments(customerId: string): Promise<CrmDocument[]> {
  const { data } = await supabase
    .from('customer_portal_document_downloads')
    .select('id, document_name, document_type, downloaded_at')
    .eq('customer_id', customerId)
    .order('downloaded_at', { ascending: false })
    .limit(30);
  return (data || []).map((d: any) => ({
    id: d.id, name: d.document_name || 'Dokument',
    kind: d.document_type, createdAt: d.downloaded_at,
  }));
}

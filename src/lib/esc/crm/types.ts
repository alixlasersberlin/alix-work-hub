// ESC CRM integration types (read-only projections over existing modules)
export interface CrmCustomerSummary {
  id: string;
  customerNumber?: string | null;
  companyName: string;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  country?: string | null;
  group?: string | null;
  salesRep?: string | null;
  sourceSystem?: string | null;
}

export interface CrmDevice {
  id: string;
  model?: string | null;
  serialNumber?: string | null;
  status?: string | null;
  warrantyUntil?: string | null;
  installedAt?: string | null;
  lastServiceAt?: string | null;
  nextServiceAt?: string | null;
}

export interface CrmOffer {
  id: string;
  number?: string | null;
  status?: string | null;
  total?: number | null;
  currency?: string | null;
  createdAt?: string | null;
}

export interface CrmInvoice {
  id: string;
  number?: string | null;
  status?: string | null;
  total?: number | null;
  currency?: string | null;
  dueDate?: string | null;
  paid?: boolean | null;
}

export interface CrmTicket {
  id: string;
  number?: string | null;
  subject?: string | null;
  status?: string | null;
  priority?: string | null;
  createdAt?: string | null;
}

export interface CrmServiceEvent {
  id: string;
  kind: 'installation' | 'wartung' | 'reparatur' | 'einweisung' | 'vorfuehrung' | 'service';
  title: string;
  at: string;
  status?: string | null;
}

export interface CrmTraining {
  id: string;
  title: string;
  status?: string | null;
  at?: string | null;
  certificateUrl?: string | null;
  nisv?: boolean;
}

export interface CrmDocument {
  id: string;
  name: string;
  kind?: string | null;
  url?: string | null;
  createdAt?: string | null;
}

export interface CrmTimelineEntry {
  id: string;
  at: string;
  kind: string;
  title: string;
  meta?: string | null;
}

export interface CrmSearchHit {
  customerId: string;
  companyName: string;
  customerNumber?: string | null;
  matched: string;
  matchField: 'name' | 'number' | 'email' | 'phone' | 'serial' | 'offer' | 'other';
}

export interface CrmCustomerContext {
  customer: CrmCustomerSummary;
  devices: CrmDevice[];
  offers: CrmOffer[];
  invoices: CrmInvoice[];
  tickets: CrmTicket[];
  services: CrmServiceEvent[];
  trainings: CrmTraining[];
  documents: CrmDocument[];
  timeline: CrmTimelineEntry[];
}

export interface DuplicateCandidate {
  customerId: string;
  companyName: string;
  reason: 'name' | 'phone' | 'email' | 'number';
  score: number;
}

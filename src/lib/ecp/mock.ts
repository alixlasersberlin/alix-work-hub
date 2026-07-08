// Mock/portal data — reads should later come from AlixWorks APIs.
export const mockAppointments = [
  { id: 'a1', when: '2026-07-10 09:00', title: 'Wartung Laser MedX', status: 'bestätigt' },
  { id: 'a2', when: '2026-07-14 11:30', title: 'Schulung Basics', status: 'offen' },
  { id: 'a3', when: '2026-06-22 15:00', title: 'Vor-Ort-Service', status: 'vergangen' },
];

export const mockDevices = [
  { id: 'd1', model: 'AlixLaser Pro X', serial: 'LX-2024-0817', location: 'Praxis München', warrantyUntil: '2027-05-30', lastService: '2026-04-11', nextService: '2026-10-11', firmware: '3.2.1', status: 'aktiv' },
  { id: 'd2', model: 'AlixCool MedX', serial: 'CX-2023-4411', location: 'Klinik Nord', warrantyUntil: '2026-12-01', lastService: '2026-05-02', nextService: '2026-11-02', firmware: '2.4.0', status: 'aktiv' },
];

export const mockTickets = [
  { id: 't1', subject: 'Fehler E-12 nach Neustart', status: 'In Bearbeitung', updated: '2026-07-05', assignee: 'Service Team' },
  { id: 't2', subject: 'Ersatzteil Handstück', status: 'Wartend', updated: '2026-07-02', assignee: 'Vertrieb' },
];

export const mockInvoices = [
  { id: 'inv-2026-0142', total: '1.240,00 €', due: '2026-07-30', status: 'offen' },
  { id: 'inv-2026-0121', total: '860,00 €', due: '2026-06-15', status: 'bezahlt' },
];

export const mockQuotes = [
  { id: 'q-2026-071', total: '18.400,00 €', valid: '2026-08-15', status: 'offen' },
  { id: 'q-2026-060', total: '4.900,00 €', valid: '2026-07-01', status: 'abgelaufen' },
];

export const mockTrainings = [
  { id: 's1', title: 'NiSV Grundlagen', date: '2026-07-20', status: 'gebucht' },
  { id: 's2', title: 'Laseranwendung Fortgeschritten', date: '2026-05-05', status: 'abgeschlossen', certificate: true },
];

export const mockDocuments = [
  { id: 'do1', name: 'Serviceberichte 2026-Q2.pdf', type: 'Servicebericht', updated: '2026-07-01' },
  { id: 'do2', name: 'CE-Konformitätserklärung.pdf', type: 'CE', updated: '2025-11-10' },
  { id: 'do3', name: 'Bedienungsanleitung Pro X.pdf', type: 'Anleitung', updated: '2024-08-01' },
];

export const mockMessages = [
  { id: 'm1', from: 'Service', subject: 'Terminbestätigung', date: '2026-07-07', unread: true },
  { id: 'm2', from: 'Sales', subject: 'Ihr Angebot Q-071', date: '2026-07-04', unread: false },
];

export const mockDownloads = [
  { id: 'dl1', name: 'Produktbild Pro X (2000px)', size: '4.2 MB' },
  { id: 'dl2', name: 'Firmware 3.2.1', size: '18 MB' },
  { id: 'dl3', name: 'Marketing-Broschüre 2026', size: '9.1 MB' },
];

export const mockLocations = [
  { id: 'l1', name: 'Hauptsitz München', address: 'Landsberger Str. 12', devices: 4 },
  { id: 'l2', name: 'Filiale Berlin', address: 'Friedrichstr. 88', devices: 2 },
];

export const mockContacts = [
  { id: 'c1', name: 'Dr. Berger', role: 'Geschäftsführung', email: 'berger@example.com' },
  { id: 'c2', name: 'Anna Weber', role: 'Studioleitung', email: 'weber@example.com' },
];

export const mockAdminKpis = {
  activeCustomers: 132,
  activeDealers: 24,
  activeServicePartners: 9,
  openTickets: 17,
  serviceRequests: 8,
  logins7d: 384,
  downloads7d: 128,
};

export function providerSender(address: string): string {
  const normalized = address.toLowerCase().trim();
  const allowed = normalized.endsWith('@alixwork.de') || normalized === 'service@alix-lasers.com';
  return `Alix Lasers ® <${allowed ? normalized : 'noreply@alixwork.de'}>`;
}

export const ORDER_SERVICE_ROLES = ['Vertrieb', 'Order', 'Technik', 'Kundenservice', 'Reparaturannahme'];
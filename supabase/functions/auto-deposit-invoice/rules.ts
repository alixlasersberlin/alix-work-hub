export const ACCOUNTING_CC = 'buchhaltung@alix-operation.de';
export const DELAY_MS = 2 * 60 * 60 * 1000;

export function invoiceDueAt(finalizedAt: string): string {
  return new Date(new Date(finalizedAt).getTime() + DELAY_MS).toISOString();
}

export function invoiceEmail(customerEmail: string, invoiceNumber: string, orderNumber: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) throw new Error('Kunde hat keine gültige E-Mail-Adresse');
  return {
    to: [customerEmail],
    cc: customerEmail.toLowerCase() === ACCOUNTING_CC ? [] : [ACCOUNTING_CC],
    subject: `Anzahlungsrechnung ${invoiceNumber} – Auftrag ${orderNumber}`,
  };
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
export function depositInvoiceSubject(invoiceNumber: string): string {
  return `Herzlich willkommen bei ALIX – Ihre Anzahlungsrechnung ${invoiceNumber}`;
}

export function depositInvoiceBody(invoiceNumber: string, orderNumber: string, amount: string, dueDate?: string): string {
  return [
    'Sehr geehrte Damen und Herren,',
    '',
    'herzlich willkommen bei ALIX! Wir freuen uns, Sie als Kunden begrüßen zu dürfen, und bedanken uns herzlich für Ihr Vertrauen. Schön, dass Sie sich für uns entschieden haben – wir freuen uns auf die Zusammenarbeit mit Ihnen.',
    '',
    `Im Anhang erhalten Sie Ihre Anzahlungsrechnung ${invoiceNumber} zu Ihrem Auftrag ${orderNumber}.`,
    '',
    `Rechnungsbetrag: ${amount}`,
    ...(dueDate ? [`Fällig am: ${dueDate}`] : []),
    '',
    `Bitte überweisen Sie den Rechnungsbetrag auf die in der Rechnung angegebene Bankverbindung und geben Sie als Verwendungszweck die Rechnungsnummer ${invoiceNumber} an.`,
    '',
    'Bei Fragen zu Ihrer Rechnung oder Ihrem Auftrag sind wir gerne für Sie da.',
    '',
    'Mit herzlichen Grüßen',
    'Ihr ALIX-Team',
    'Alix Lasers Finance',
  ].join('\n');
}
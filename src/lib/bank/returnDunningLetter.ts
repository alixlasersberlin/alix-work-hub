/**
 * Mahnschreiben-Vorlage für Rücklastschriften.
 *
 * Der Text wird als Vorlage mit Platzhaltern in app_settings gespeichert
 * (Key: bank_return_dunning_letter) und beim Erzeugen des PDFs automatisch
 * mit den Daten der Rücklastschrift befüllt.
 */
import jsPDF from 'jspdf';
import { supabase } from '@/integrations/supabase/client';
import { buildReturnDunning } from './returnDebit';

const LETTER_KEY = 'bank_return_dunning_letter';

export interface ReturnDunningLetter {
  senderName: string;
  senderAddress: string;
  subject: string;
  body: string;
  footer: string;
}

export const DEFAULT_RETURN_DUNNING_LETTER: ReturnDunningLetter = {
  senderName: 'Alix Lasers GmbH',
  senderAddress: 'Alix Lasers GmbH · Buchhaltung\nE-Mail: buchhaltung@alix-lasers.com',
  subject: 'Zahlungserinnerung nach Rücklastschrift – Rechnung {{rechnung}}',
  body: `Sehr geehrte Damen und Herren,
{{kunde}},

die Abbuchung zu Rechnung {{rechnung}} über {{betrag}} wurde am {{datum}} von Ihrem Kreditinstitut zurückgegeben.

Grund der Rückgabe: {{grund}} ({{code}})

Dadurch sind folgende Beträge offen:

Rechnungsbetrag: {{betrag}}
Rücklastschriftgebühr: {{gebuehr}}
Gesamtforderung: {{gesamt}}

Bitte überweisen Sie den Gesamtbetrag von {{gesamt}} bis spätestens {{zahlbar_bis}} auf folgendes Konto:

IBAN: {{iban}}
BIC: {{bic}}
Bank: {{bank}}
Verwendungszweck: {{rechnung}}

WICHTIGER HINWEIS: Sollte der Zahlungseingang bis zum {{zahlbar_bis}} nicht erfolgen, werden wir die von Alix Lasers erbrachten Leistungen ab dem {{sperrdatum}} sperren. Dies umfasst insbesondere die Nutzung und den Support der überlassenen Geräte sowie weitere Lieferungen.

Sollte sich Ihre Zahlung mit diesem Schreiben überschnitten haben, betrachten Sie es bitte als gegenstandslos.

Mit freundlichen Grüßen
{{absender}}`,
  footer: 'Dieses Schreiben wurde maschinell erstellt und ist ohne Unterschrift gültig.',
};

export const RETURN_DUNNING_PLACEHOLDERS: { key: string; label: string }[] = [
  { key: '{{kunde}}', label: 'Kundenname' },
  { key: '{{rechnung}}', label: 'Rechnungsnummer(n)' },
  { key: '{{betrag}}', label: 'Rücklastschriftbetrag' },
  { key: '{{gebuehr}}', label: 'Gebühren' },
  { key: '{{gesamt}}', label: 'Gesamtforderung' },
  { key: '{{datum}}', label: 'Datum der Rücklastschrift' },
  { key: '{{grund}}', label: 'Rückgabegrund' },
  { key: '{{code}}', label: 'SEPA-Rückgabecode' },
  { key: '{{zahlbar_bis}}', label: 'Zahlungsfrist' },
  { key: '{{sperrdatum}}', label: 'Datum der Leistungssperre' },
  { key: '{{iban}}', label: 'IBAN (Bankkonto)' },
  { key: '{{bic}}', label: 'BIC' },
  { key: '{{bank}}', label: 'Bankname' },
  { key: '{{absender}}', label: 'Absender' },
  { key: '{{heute}}', label: 'Heutiges Datum' },
];

export async function loadReturnDunningLetter(): Promise<ReturnDunningLetter> {
  const { data } = await supabase.from('app_settings').select('value').eq('key', LETTER_KEY).maybeSingle();
  return { ...DEFAULT_RETURN_DUNNING_LETTER, ...((data?.value as any) ?? {}) };
}

export async function saveReturnDunningLetter(letter: ReturnDunningLetter) {
  const { error } = await (supabase.from('app_settings') as any).upsert(
    { key: LETTER_KEY, value: letter as any }, { onConflict: 'key' },
  );
  if (error) throw error;
}

export function fillPlaceholders(text: string, vars: Record<string, string>) {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_m, k) => vars[String(k).toLowerCase()] ?? '');
}

const money = (n: number, currency = 'EUR') =>
  Number(n || 0).toLocaleString('de-DE', { style: 'currency', currency });

/** Sammelt alle Platzhalterwerte einer Rücklastschrift. */
export async function buildReturnDunningVars(rd: any, payDays = 7): Promise<Record<string, string>> {
  const info = await buildReturnDunning(rd, payDays);
  const letter = await loadReturnDunningLetter();

  let bank: any = null;
  if (rd.bank_account_id) {
    const { data } = await supabase.from('bank_accounts' as any)
      .select('iban, bic, bank_name').eq('id', rd.bank_account_id).maybeSingle();
    bank = data;
  }

  const invoices = [rd.invoice_number, ...info.items.map(i => i.invoice_number)]
    .filter(Boolean).filter((v, i, a) => a.indexOf(v) === i) as string[];

  return {
    kunde: info.customerName || '',
    rechnung: invoices.join(', ') || '–',
    betrag: money(info.amount, info.currency),
    gebuehr: money(info.fee, info.currency),
    gesamt: money(info.total, info.currency),
    datum: rd.booking_date ? new Date(rd.booking_date).toLocaleDateString('de-DE') : '–',
    grund: rd.return_reason || '–',
    code: rd.return_code || '–',
    zahlbar_bis: info.payUntil,
    sperrdatum: info.blockDate,
    iban: bank?.iban || '–',
    bic: bank?.bic || '–',
    bank: bank?.bank_name || '–',
    absender: letter.senderName,
    heute: new Date().toLocaleDateString('de-DE'),
  };
}

/** Erzeugt das Mahnschreiben als PDF (jsPDF) und gibt es als Blob zurück. */
export function renderReturnDunningPdf(letter: ReturnDunningLetter, vars: Record<string, string>): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const L = 20, R = 190, W = R - L;
  let y = 20;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
  doc.text(fillPlaceholders(letter.senderName, vars), L, y);
  y += 6;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(110);
  for (const line of fillPlaceholders(letter.senderAddress, vars).split('\n')) {
    doc.text(line, L, y); y += 4;
  }
  doc.setTextColor(0);

  // Empfänger
  y += 8;
  doc.setFontSize(11);
  doc.text(vars.kunde || '', L, y);

  // Datum rechts
  doc.setFontSize(10);
  doc.text(vars.heute || '', R, y, { align: 'right' });

  // Betreff
  y += 16;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
  for (const line of doc.splitTextToSize(fillPlaceholders(letter.subject, vars), W)) {
    doc.text(line, L, y); y += 6;
  }

  // Body
  y += 4;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5);
  const body = fillPlaceholders(letter.body, vars);
  for (const raw of body.split('\n')) {
    if (!raw.trim()) { y += 4; continue; }
    const bold = /^WICHTIGER HINWEIS/i.test(raw.trim());
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    if (bold) doc.setTextColor(185, 28, 28);
    for (const line of doc.splitTextToSize(raw, W)) {
      if (y > 272) { doc.addPage(); y = 20; }
      doc.text(line, L, y); y += 5.2;
    }
    doc.setTextColor(0);
  }

  // Footer
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(130);
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.text(fillPlaceholders(letter.footer, vars), L, 287);
    doc.text(`Seite ${p} / ${pages}`, R, 287, { align: 'right' });
  }

  return doc.output('blob');
}

/** Baut das Mahnschreiben zu einer Rücklastschrift und öffnet/lädt es als PDF. */
export async function downloadReturnDunningPdf(rd: any, payDays = 7) {
  const [letter, vars] = await Promise.all([loadReturnDunningLetter(), buildReturnDunningVars(rd, payDays)]);
  const blob = renderReturnDunningPdf(letter, vars);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Mahnung_Ruecklastschrift_${(vars.rechnung || 'ohne-Rechnung').replace(/[^\w.-]+/g, '_')}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return vars;
}

/** Vorschau mit Beispieldaten (für den Vorlagen-Editor). */
export function previewReturnDunningPdf(letter: ReturnDunningLetter) {
  const vars: Record<string, string> = {
    kunde: 'Musterpraxis Dr. Beispiel GmbH',
    rechnung: 'INV-10960',
    betrag: money(1190), gebuehr: money(12.5), gesamt: money(1202.5),
    datum: new Date().toLocaleDateString('de-DE'),
    grund: 'Kontodeckung nicht ausreichend', code: 'AM04',
    zahlbar_bis: new Date(Date.now() + 7 * 864e5).toLocaleDateString('de-DE'),
    sperrdatum: new Date(Date.now() + 8 * 864e5).toLocaleDateString('de-DE'),
    iban: 'DE12 3456 7890 1234 5678 00', bic: 'GENODEF1XXX', bank: 'Muster Bank AG',
    absender: letter.senderName, heute: new Date().toLocaleDateString('de-DE'),
  };
  const url = URL.createObjectURL(renderReturnDunningPdf(letter, vars));
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

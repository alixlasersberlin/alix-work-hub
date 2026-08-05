/**
 * DATEV-Export für Bankbuchungen (Format EXTF 700, "Buchungsstapel").
 * Erzeugt eine CSV-Datei, die im DATEV-Rechnungswesen importiert werden kann.
 */

export interface DatevOptions {
  beraterNr: string;
  mandantenNr: string;
  wjBeginn: string;      // YYYY-MM-DD
  sachkontenlaenge: number;
  bezeichnung: string;
  /** Sachkonto der Bank (Soll bei Eingang) */
  bankKonto: string;
  /** Gegenkonto, falls keine Zuordnung vorhanden ist */
  interimskonto: string;
  from: string;
  to: string;
}

export const DATEV_DEFAULTS: DatevOptions = {
  beraterNr: '1000',
  mandantenNr: '1',
  wjBeginn: `${new Date().getFullYear()}-01-01`,
  sachkontenlaenge: 4,
  bezeichnung: 'Bankbuchungen',
  bankKonto: '1200',
  interimskonto: '1590',
  from: `${new Date().getFullYear()}-01-01`,
  to: new Date().toISOString().slice(0, 10),
};

const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const num = (n: number) => Math.abs(Number(n || 0)).toFixed(2).replace('.', ',');
const ddmm = (d?: string | null) => {
  if (!d) return '';
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, '0')}${String(dt.getMonth() + 1).padStart(2, '0')}`;
};
const yyyymmdd = (d: string) => d.replace(/-/g, '');
const clean = (s: unknown, max = 60) => String(s ?? '').replace(/[\r\n";]/g, ' ').trim().slice(0, max);

export interface DatevRow {
  booking_date: string | null;
  amount: number;
  currency?: string | null;
  transaction_type?: string | null;
  purpose?: string | null;
  booking_text?: string | null;
  sender_receiver_name?: string | null;
  bank_reference?: string | null;
  /** Zugeordnetes Gegenkonto (z. B. Debitorennummer), sonst Interimskonto */
  counter_account?: string | null;
  invoice_number?: string | null;
}

/** Baut den kompletten EXTF-CSV-Inhalt (inkl. Header- und Feldzeile). */
export function buildDatevExtf(rows: DatevRow[], o: DatevOptions): string {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const header = [
    q('EXTF'), 700, 21, q('Buchungsstapel'), 13, `${stamp}000`, '', 'RE', '', '',
    o.beraterNr, o.mandantenNr, yyyymmdd(o.wjBeginn), o.sachkontenlaenge,
    yyyymmdd(o.from), yyyymmdd(o.to), q(clean(o.bezeichnung, 30)), q(''), 1, 0, '', q('EUR'),
    '', '', '', '', '', '', '', '', '', '',
  ].join(';');

  const fields = [
    'Umsatz (ohne Soll/Haben-Kz)', 'Soll/Haben-Kennzeichen', 'WKZ Umsatz', 'Kurs',
    'Basis-Umsatz', 'WKZ Basis-Umsatz', 'Konto', 'Gegenkonto (ohne BU-Schlüssel)',
    'BU-Schlüssel', 'Belegdatum', 'Belegfeld 1', 'Belegfeld 2', 'Skonto', 'Buchungstext',
  ].map(q).join(';');

  const lines = rows.map((r) => {
    const isIn = Number(r.amount) >= 0;
    const konto = o.bankKonto;
    const gegen = clean(r.counter_account || o.interimskonto, 9);
    const text = clean(
      r.purpose || r.booking_text || r.sender_receiver_name || 'Bankbuchung', 60,
    );
    return [
      num(r.amount),
      q(isIn ? 'S' : 'H'),
      q(r.currency || 'EUR'),
      '', '', '',
      q(konto),
      q(gegen),
      '',
      ddmm(r.booking_date),
      q(clean(r.invoice_number || r.bank_reference, 36)),
      q(''),
      '',
      q(text),
    ].join(';');
  });

  return [header, fields, ...lines].join('\r\n') + '\r\n';
}

export function downloadDatevCsv(content: string, filename: string) {
  // DATEV erwartet Windows-1252/ANSI – UTF-8 mit BOM wird ebenfalls akzeptiert.
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

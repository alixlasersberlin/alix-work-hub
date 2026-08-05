import * as XLSX from 'xlsx';
import type { BankFileFormat, ColumnMapping, ParsedTx, ParseResult } from './types';

/* ------------------------------------------------------------------ utils */

export function parseAmount(v: any): number {
  if (typeof v === 'number') return v;
  if (v == null) return NaN;
  let s = String(v).trim().replace(/\s|'|\u00a0/g, '');
  if (!s) return NaN;
  let neg = /^\(.*\)$/.test(s) || s.startsWith('-') || /-$/.test(s);
  s = s.replace(/[()]/g, '').replace(/^-|-$/g, '');
  s = s.replace(/[A-Za-z€$₣]/g, '');
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  const n = Number(s);
  if (!isFinite(n)) return NaN;
  return neg ? -Math.abs(n) : n;
}

export function parseDate(v: any): string | null {
  if (!v && v !== 0) return null;
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/);
  if (m) {
    let y = Number(m[3]);
    if (y < 100) y += y > 70 ? 1900 : 2000;
    return `${y}-${String(Number(m[2])).padStart(2, '0')}-${String(Number(m[1])).padStart(2, '0')}`;
  }
  m = s.match(/^(\d{2})(\d{2})(\d{2})$/); // YYMMDD (MT940)
  if (m) return `20${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

const EMPTY: Omit<ParsedTx, 'amount' | 'transaction_type' | 'raw_data'> = {
  booking_date: null, value_date: null, currency: 'EUR',
  sender_receiver_name: null, sender_receiver_iban: null, bic: null,
  booking_text: null, purpose: null, bank_reference: null,
  end_to_end_reference: null, mandate_reference: null, customer_reference: null,
};

function mk(partial: Partial<ParsedTx> & { amount: number }): ParsedTx {
  const amount = partial.amount;
  const tx: ParsedTx = {
    ...EMPTY,
    ...partial,
    amount,
    transaction_type: amount < 0 ? 'ausgang' : 'eingang',
    raw_data: partial.raw_data ?? {},
  };
  tx.invalid = !isFinite(tx.amount) || tx.amount === 0 || !tx.booking_date;
  return tx;
}

export async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function duplicateHash(tx: ParsedTx, accountId: string): Promise<string> {
  const key = [
    accountId, tx.booking_date, tx.value_date, tx.amount.toFixed(2), tx.currency,
    (tx.sender_receiver_name || '').toLowerCase().replace(/\s+/g, ''),
    (tx.sender_receiver_iban || '').toUpperCase().replace(/\s+/g, ''),
    (tx.purpose || '').toLowerCase().replace(/\s+/g, '').slice(0, 120),
    tx.bank_reference || '', tx.end_to_end_reference || '',
  ].join('|');
  return sha256(key);
}

export const RETURN_DEBIT_WORDS = [
  'rücklastschrift', 'ruecklastschrift', 'lastschrift zurück', 'lastschrift zurueck',
  'lastschrift nicht eingelöst', 'lastschrift nicht eingeloest', 'nicht eingelöst', 'nicht eingeloest',
  'rückgabe lastschrift', 'rueckgabe lastschrift', 'sepa-rückgabe', 'sepa-rueckgabe',
  'sepa rückgabe', 'sepa rueckgabe', 'retoure lastschrift',
  'chargeback', 'storno', 'rückbuchung', 'rueckbuchung', 'rückgabe', 'ruecklauf', 'widerspruch',
  'kontodeckung nicht ausreichend', 'keine kontodeckung', 'konto erloschen', 'konto gesperrt',
];

/** SEPA-Rückgabecodes, die eine Rücklastschrift kennzeichnen */
export const RETURN_DEBIT_CODES = ['AC01', 'AC04', 'AC06', 'AM04', 'MD01', 'MD06', 'MS02', 'SL01'];

export function isReturnDebit(tx: ParsedTx): boolean {
  const raw = `${tx.booking_text ?? ''} ${tx.purpose ?? ''} ${JSON.stringify(tx.raw_data ?? {})}`;
  const hay = raw.toLowerCase();
  if (RETURN_DEBIT_WORDS.some(w => hay.includes(w))) return true;
  const up = raw.toUpperCase();
  return RETURN_DEBIT_CODES.some(c => new RegExp(`(^|[^A-Z0-9])${c}([^A-Z0-9]|$)`).test(up));
}

/* ------------------------------------------------------- format detection */

export function detectFormat(filename: string, head: string): BankFileFormat {
  const ext = filename.toLowerCase().split('.').pop() || '';
  const h = head.slice(0, 4000);
  if (ext === 'pdf' || h.startsWith('%PDF')) return 'pdf';
  if (ext === 'xlsx') return 'xlsx';
  if (ext === 'xls') return 'xls';
  if (/<Document[\s>]/i.test(h) || /camt\.05/i.test(h)) {
    if (/camt\.054/i.test(h) || /<BkToCstmrDbtCdtNtfctn/i.test(h)) return 'camt054';
    if (/camt\.052/i.test(h) || /<BkToCstmrAcctRpt/i.test(h)) return 'camt052';
    if (/camt\.053/i.test(h) || /<BkToCstmrStmt/i.test(h)) return 'camt053';
    return 'xml';
  }
  if (/^\s*:20:/m.test(h) || /:61:/.test(h)) return /:34F:|942/.test(h) ? 'mt942' : 'mt940';
  if (/<OFX>|OFXHEADER/i.test(h)) return 'ofx';
  if (/^!Type:/im.test(h)) return 'qif';
  if (/"EXTF"|"DTVF"/.test(h)) return 'datev';
  if (ext === 'csv') return 'csv';
  if (ext === 'txt') return 'txt';
  if (ext === 'xml') return 'xml';
  return 'unbekannt';
}

/* ---------------------------------------------------------------- CSV/XLS */

function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === sep && !inQ) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out.map(s => s.trim());
}

export function parseDelimited(text: string): { headers: string[]; rows: Record<string, any>[] } {
  const raw = text.split(/\r?\n/).filter(l => l.trim().length);
  if (!raw.length) return { headers: [], rows: [] };
  // Header-Zeile finden (DATEV/Bank-Exporte haben Vorspann)
  const sepOf = (l: string) => [';', ',', '\t', '|'].sort((a, b) => l.split(b).length - l.split(a).length)[0];
  let headerIdx = 0, sep = sepOf(raw[0]);
  for (let i = 0; i < Math.min(raw.length, 15); i++) {
    const s = sepOf(raw[i]);
    if (splitCsvLine(raw[i], s).length >= 4) { headerIdx = i; sep = s; break; }
  }
  const headers = splitCsvLine(raw[headerIdx], sep).map((h, i) => h.replace(/^"|"$/g, '') || `Spalte ${i + 1}`);
  const rows = raw.slice(headerIdx + 1).map(line => {
    const cells = splitCsvLine(line, sep);
    const r: Record<string, any> = {};
    headers.forEach((h, i) => { r[h] = (cells[i] ?? '').replace(/^"|"$/g, ''); });
    return r;
  }).filter(r => Object.values(r).some(v => String(v).trim().length));
  return { headers, rows };
}

export function parseSpreadsheet(buf: ArrayBuffer): { headers: string[]; rows: Record<string, any>[] } {
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const arr = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: false, defval: '' });
  const headerIdx = arr.findIndex(r => r.filter(c => String(c).trim()).length >= 3);
  if (headerIdx < 0) return { headers: [], rows: [] };
  const headers = (arr[headerIdx] as any[]).map((h, i) => String(h).trim() || `Spalte ${i + 1}`);
  const rows = arr.slice(headerIdx + 1).map(r => {
    const o: Record<string, any> = {};
    headers.forEach((h, i) => { o[h] = (r as any[])[i] ?? ''; });
    return o;
  }).filter(r => Object.values(r).some(v => String(v).trim().length));
  return { headers, rows };
}

const GUESS: Record<string, RegExp> = {
  booking_date: /^(buchung|buchungstag|buchungsdatum|datum|date|booking)/i,
  value_date: /(valuta|wertstellung|value)/i,
  amount: /^(betrag|umsatz|amount|soll\/haben betrag)/i,
  currency: /(währung|waehrung|currency|ccy)/i,
  purpose: /(verwendungszweck|zweck|reference text|remittance|description)/i,
  booking_text: /(buchungstext|umsatzart|text|typ)/i,
  sender_receiver_name: /(auftraggeber|empfänger|empfaenger|beguenstigter|begünstigter|name|zahlungspflichtiger|payer|payee)/i,
  sender_receiver_iban: /(iban|kontonummer)/i,
  bic: /(bic|swift)/i,
  bank_reference: /(bankreferenz|referenz|reference)/i,
  end_to_end_reference: /(end.?to.?end|e2e)/i,
  mandate_reference: /(mandat)/i,
  customer_reference: /(kundenreferenz|customer)/i,
  debit_credit: /(soll.?haben|s\/h|cdtdbt|debit)/i,
};

export function guessMapping(headers: string[]): ColumnMapping {
  const m: ColumnMapping = {};
  for (const [key, re] of Object.entries(GUESS)) {
    const hit = headers.find(h => re.test(h));
    if (hit && !Object.values(m).includes(hit)) (m as any)[key] = hit;
  }
  return m;
}

export function applyMapping(rows: Record<string, any>[], mapping: ColumnMapping, defaultCurrency = 'EUR'): ParsedTx[] {
  const g = (r: Record<string, any>, k: keyof ColumnMapping) => {
    const col = mapping[k];
    if (!col) return null;
    const v = r[col];
    return v === '' || v == null ? null : String(v).trim();
  };
  return rows.map(r => {
    let amount = parseAmount(g(r, 'amount'));
    const dc = (g(r, 'debit_credit') || '').toUpperCase();
    if (dc && isFinite(amount)) {
      if (/^(S|D|DBIT|SOLL|DEBIT|-)/.test(dc)) amount = -Math.abs(amount);
      if (/^(H|C|CRDT|HABEN|CREDIT|\+)/.test(dc)) amount = Math.abs(amount);
    }
    const invoiceHint = g(r, 'invoice_number');
    return mk({
      amount,
      booking_date: parseDate(g(r, 'booking_date')),
      value_date: parseDate(g(r, 'value_date')) ?? parseDate(g(r, 'booking_date')),
      currency: (g(r, 'currency') || defaultCurrency).toUpperCase().slice(0, 3),
      purpose: [g(r, 'purpose'), invoiceHint].filter(Boolean).join(' ') || null,
      booking_text: g(r, 'booking_text'),
      sender_receiver_name: g(r, 'sender_receiver_name'),
      sender_receiver_iban: g(r, 'sender_receiver_iban')?.replace(/\s+/g, '') ?? null,
      bic: g(r, 'bic'),
      bank_reference: g(r, 'bank_reference'),
      end_to_end_reference: g(r, 'end_to_end_reference'),
      mandate_reference: g(r, 'mandate_reference'),
      customer_reference: g(r, 'customer_reference'),
      raw_data: r,
    });
  });
}

/* ------------------------------------------------------------------ MT940 */

export function parseMt940(text: string): ParsedTx[] {
  const out: ParsedTx[] = [];
  const lines = text.replace(/\r/g, '').split('\n');
  let cur: ParsedTx | null = null;
  let currency = 'EUR';
  const ccy = text.match(/:60[FM]:[CD]\d{6}([A-Z]{3})/);
  if (ccy) currency = ccy[1];
  const flush = () => { if (cur) { cur.invalid = !cur.booking_date || !isFinite(cur.amount); out.push(cur); cur = null; } };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith(':61:')) {
      flush();
      const body = l.slice(4);
      const m = body.match(/^(\d{6})(\d{4})?(R?[CD])([A-Z])?([\d.,]+)N?([A-Z0-9]{3})?(\S*)/);
      if (!m) continue;
      const valueDate = parseDate(m[1]);
      const bookMmdd = m[2];
      const isCredit = m[3].endsWith('C');
      const amt = parseAmount(m[5]);
      const bookingDate = bookMmdd && valueDate
        ? `${valueDate.slice(0, 4)}-${bookMmdd.slice(0, 2)}-${bookMmdd.slice(2, 4)}`
        : valueDate;
      cur = mk({
        amount: isCredit ? Math.abs(amt) : -Math.abs(amt),
        booking_date: bookingDate, value_date: valueDate, currency,
        bank_reference: m[7] || null, raw_data: { line: l },
      });
    } else if (l.startsWith(':86:') && cur) {
      let info = l.slice(4);
      while (i + 1 < lines.length && !/^:\d{2}[A-Z]?:/.test(lines[i + 1])) { info += lines[++i]; }
      const sub = (code: string) => info.match(new RegExp(`\\?${code}([^?]*)`))?.[1]?.trim() || null;
      const purposeParts = ['20', '21', '22', '23', '24', '25', '26', '27', '28', '29'].map(sub).filter(Boolean);
      cur.booking_text = sub('00') || cur.booking_text;
      cur.sender_receiver_name = [sub('32'), sub('33')].filter(Boolean).join(' ') || cur.sender_receiver_name;
      cur.sender_receiver_iban = sub('31') || cur.sender_receiver_iban;
      cur.bic = sub('30') || cur.bic;
      cur.purpose = purposeParts.length ? purposeParts.join(' ') : info.replace(/\?\d{2}/g, ' ').trim();
      const e2e = cur.purpose?.match(/EREF\+(\S+)/); if (e2e) cur.end_to_end_reference = e2e[1];
      const mref = cur.purpose?.match(/MREF\+(\S+)/); if (mref) cur.mandate_reference = mref[1];
      cur.raw_data = { ...cur.raw_data, info };
    }
  }
  flush();
  return out;
}

/* -------------------------------------------------------------- CAMT / XML */

function xtag(x: string, name: string): string | null {
  const m = x.match(new RegExp(`<(?:\\w+:)?${name}[^>]*>([\\s\\S]*?)</(?:\\w+:)?${name}>`, 'i'));
  return m ? m[1].trim() : null;
}
function xall(x: string, name: string): string[] {
  return x.match(new RegExp(`<(?:\\w+:)?${name}[^>]*>[\\s\\S]*?</(?:\\w+:)?${name}>`, 'gi')) ?? [];
}

export function parseCamt(xml: string): ParsedTx[] {
  const out: ParsedTx[] = [];
  const defCcy = xml.match(/Ccy="([A-Z]{3})"/)?.[1] || 'EUR';
  for (const ntry of xall(xml, 'Ntry')) {
    const cd = (xtag(ntry, 'CdtDbtInd') || 'CRDT').toUpperCase();
    const bookDate = parseDate(xtag(xtag(ntry, 'BookgDt') || '', 'Dt') || xtag(xtag(ntry, 'BookgDt') || '', 'DtTm'));
    const valDate = parseDate(xtag(xtag(ntry, 'ValDt') || '', 'Dt') || xtag(xtag(ntry, 'ValDt') || '', 'DtTm'));
    const ntryAmtRaw = ntry.match(/<(?:\w+:)?Amt[^>]*Ccy="([A-Z]{3})"[^>]*>([\d.,-]+)</i);
    const ccy = ntryAmtRaw?.[1] || defCcy;
    const details = xall(ntry, 'TxDtls');
    const targets = details.length ? details : [ntry];
    for (const tx of targets) {
      const amtRaw = tx.match(/<(?:\w+:)?Amt[^>]*>([\d.,-]+)</i)?.[1];
      const amt = parseAmount(amtRaw ?? ntryAmtRaw?.[2] ?? '0');
      const rel = xtag(tx, 'RltdPties') || '';
      const party = cd === 'CRDT' ? (xtag(rel, 'Dbtr') || '') : (xtag(rel, 'Cdtr') || '');
      const acct = cd === 'CRDT' ? (xtag(rel, 'DbtrAcct') || '') : (xtag(rel, 'CdtrAcct') || '');
      out.push(mk({
        amount: cd === 'CRDT' ? Math.abs(amt) : -Math.abs(amt),
        booking_date: bookDate, value_date: valDate ?? bookDate, currency: ccy,
        sender_receiver_name: xtag(party, 'Nm'),
        sender_receiver_iban: xtag(acct, 'IBAN'),
        bic: xtag(tx, 'BICFI') || xtag(tx, 'BIC'),
        booking_text: xtag(xtag(ntry, 'BkTxCd') || '', 'Cd') || xtag(ntry, 'AddtlNtryInf'),
        purpose: (xtag(tx, 'RmtInf') || xtag(ntry, 'AddtlNtryInf') || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || null,
        bank_reference: xtag(tx, 'AcctSvcrRef') || xtag(ntry, 'AcctSvcrRef'),
        end_to_end_reference: xtag(tx, 'EndToEndId'),
        mandate_reference: xtag(tx, 'MndtId'),
        raw_data: { xml: tx.slice(0, 4000) },
      }));
    }
  }
  return out;
}

/* --------------------------------------------------------------- OFX / QIF */

export function parseOfx(text: string): ParsedTx[] {
  const body = text.replace(/\r/g, '');
  const ccy = body.match(/<CURDEF>([A-Z]{3})/)?.[1] || 'EUR';
  const blocks = body.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ?? [];
  const val = (b: string, t: string) => b.match(new RegExp(`<${t}>([^<\\n\\r]*)`, 'i'))?.[1]?.trim() || null;
  return blocks.map(b => mk({
    amount: parseAmount(val(b, 'TRNAMT')),
    booking_date: parseDate((val(b, 'DTPOSTED') || '').slice(0, 8)),
    value_date: parseDate((val(b, 'DTAVAIL') || val(b, 'DTPOSTED') || '').slice(0, 8)),
    currency: ccy,
    sender_receiver_name: val(b, 'NAME'),
    booking_text: val(b, 'TRNTYPE'),
    purpose: val(b, 'MEMO'),
    bank_reference: val(b, 'FITID'),
    raw_data: { ofx: b },
  }));
}

export function parseQif(text: string): ParsedTx[] {
  const out: ParsedTx[] = [];
  let cur: Record<string, string> = {};
  for (const line of text.replace(/\r/g, '').split('\n')) {
    if (line.startsWith('!')) continue;
    if (line.startsWith('^')) {
      if (Object.keys(cur).length) {
        out.push(mk({
          amount: parseAmount(cur.T ?? cur.U),
          booking_date: parseDate(cur.D), value_date: parseDate(cur.D), currency: 'EUR',
          sender_receiver_name: cur.P ?? null, purpose: cur.M ?? null,
          bank_reference: cur.N ?? null, raw_data: { ...cur },
        }));
      }
      cur = {};
    } else if (line.length > 1) cur[line[0]] = line.slice(1).trim();
  }
  return out;
}

/* ---------------------------------------------------------------- PDF text */

export async function pdfToText(file: File): Promise<string> {
  const pdfjs: any = await import('pdfjs-dist');
  const workerUrl = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    // Zeilenweise gruppieren nach Y-Position
    const rows = new Map<number, { x: number; s: string }[]>();
    for (const it of content.items as any[]) {
      const y = Math.round(it.transform[5]);
      const key = [...rows.keys()].find(k => Math.abs(k - y) <= 2) ?? y;
      if (!rows.has(key)) rows.set(key, []);
      rows.get(key)!.push({ x: it.transform[4], s: it.str });
    }
    const ordered = [...rows.entries()].sort((a, b) => b[0] - a[0])
      .map(([, items]) => items.sort((a, b) => a.x - b.x).map(i => i.s).join(' ').replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    pages.push(ordered.join('\n'));
  }
  return pages.join('\n');
}

const DATE_RE = /(\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4}|\d{4}-\d{2}-\d{2})/;
const AMT_RE = /(-?\(?\d{1,3}(?:[.'\s]\d{3})*,\d{2}\)?-?|-?\d+\.\d{2}-?)/g;

export function parsePdfText(text: string, currency = 'EUR'): { transactions: ParsedTx[]; warnings: string[] } {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const txs: ParsedTx[] = [];
  const warnings: string[] = [];
  let cur: ParsedTx | null = null;
  for (const line of lines) {
    const dm = line.match(new RegExp(`^${DATE_RE.source}(?:\\s+${DATE_RE.source})?`));
    const amounts = line.match(AMT_RE);
    if (dm && amounts && amounts.length) {
      if (cur) txs.push(cur);
      const amtRaw = amounts[amounts.length - 1];
      let amount = parseAmount(amtRaw);
      const upper = line.toUpperCase();
      if (/\bS\b|SOLL|\bD\b\s*$|-$/.test(amtRaw) || /\bSOLL\b/.test(upper)) amount = -Math.abs(amount);
      const rest = line.replace(dm[0], '').replace(amtRaw, '').trim();
      cur = mk({
        amount,
        booking_date: parseDate(dm[1]),
        value_date: parseDate(dm[2] ?? dm[1]),
        currency,
        booking_text: rest.slice(0, 80) || null,
        purpose: rest || null,
        raw_data: { line },
      });
    } else if (cur) {
      cur.purpose = `${cur.purpose ?? ''} ${line}`.trim().slice(0, 600);
      const iban = line.match(/\b([A-Z]{2}\d{2}[A-Z0-9]{10,30})\b/);
      if (iban && !cur.sender_receiver_iban) cur.sender_receiver_iban = iban[1];
    }
  }
  if (cur) txs.push(cur);
  for (const t of txs) {
    if (!t.sender_receiver_name && t.purpose) {
      const nm = t.purpose.split(/\s{2,}|,/)[0];
      if (nm && nm.length > 3 && nm.length < 60) t.sender_receiver_name = nm.trim();
    }
    const inv = (t.purpose || '').match(/\b(RG|RE|INV|AZ)?[-\s]?(\d{4}[-/]\d{3,6}|\d{5,10})\b/i);
    if (inv) t.raw_data.invoice_hint = inv[0];
  }
  if (!txs.length) warnings.push('Im PDF konnten keine Buchungszeilen eindeutig erkannt werden.');
  return { transactions: txs, warnings };
}

/* -------------------------------------------------------------- Hauptparser */

export async function parseBankFile(file: File, defaultCurrency = 'EUR'): Promise<ParseResult> {
  const isBinary = /\.(xlsx|xls|pdf)$/i.test(file.name);
  const head = isBinary ? '' : (await file.slice(0, 8000).text());
  const format = detectFormat(file.name, head || (file.name.toLowerCase().endsWith('.pdf') ? '%PDF' : ''));
  const warnings: string[] = [];

  if (format === 'pdf') {
    const text = await pdfToText(file);
    const { transactions, warnings: w } = parsePdfText(text, defaultCurrency);
    return {
      format, transactions, needsMapping: false, warnings: [...w],
      requiresReview: true,
    };
  }

  if (format === 'xlsx' || format === 'xls') {
    const { headers, rows } = parseSpreadsheet(await file.arrayBuffer());
    return { format, transactions: [], needsMapping: true, rows, headers, warnings, requiresReview: false };
  }

  const text = await file.text();

  if (format === 'mt940' || format === 'mt942') {
    const transactions = parseMt940(text);
    return { format, transactions, needsMapping: false, warnings, requiresReview: false };
  }
  if (format === 'camt052' || format === 'camt053' || format === 'camt054' || format === 'xml') {
    const transactions = parseCamt(text);
    if (!transactions.length) warnings.push('Keine <Ntry>-Buchungen im XML gefunden.');
    return { format, transactions, needsMapping: false, warnings, requiresReview: !transactions.length };
  }
  if (format === 'ofx') return { format, transactions: parseOfx(text), needsMapping: false, warnings, requiresReview: false };
  if (format === 'qif') return { format, transactions: parseQif(text), needsMapping: false, warnings, requiresReview: false };

  const { headers, rows } = parseDelimited(text);
  if (!headers.length) {
    return { format: 'unbekannt', transactions: [], needsMapping: false, warnings: ['Format konnte nicht erkannt werden.'], requiresReview: true };
  }
  return { format: format === 'unbekannt' ? 'csv' : format, transactions: [], needsMapping: true, rows, headers, warnings, requiresReview: false };
}

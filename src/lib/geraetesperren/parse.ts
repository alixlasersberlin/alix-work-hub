export type RuecklastRow = {
  invoice_number: string | null;
  customer_name: string | null;
  amount: number | null;
  return_date: string | null;
  reason: string | null;
  raw: string;
};

const INV_RE = /\b((?:INV|RE|AZ|AZ-SO|SO|RG)[-\s]?[A-Z0-9]{2,}(?:-[A-Z0-9]+)*)\b/i;
const AMOUNT_RE = /(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+\.\d{2})\s*(?:EUR|€|CHF)?/;
const DATE_RE = /\b(\d{2})[.\/](\d{2})[.\/](\d{4})\b/;

export function parseAmount(s: string | null | undefined): number | null {
  if (!s) return null;
  let t = String(s).replace(/[^\d,.\-]/g, '');
  if (!t) return null;
  if (t.includes(',') && t.includes('.')) t = t.replace(/\./g, '').replace(',', '.');
  else if (t.includes(',')) t = t.replace(',', '.');
  const n = Number(t);
  return Number.isFinite(n) ? Math.abs(n) : null;
}

function isoDate(s: string | null | undefined): string | null {
  if (!s) return null;
  const m = String(s).match(DATE_RE);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const iso = String(s).match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  return iso ? iso[0] : null;
}

/** Parst freien PDF-/Text-Inhalt einer Rücklastschrift-Liste zeilenweise. */
export function parseRuecklastText(text: string): RuecklastRow[] {
  const out: RuecklastRow[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.length < 6) continue;
    const inv = line.match(INV_RE)?.[1] ?? null;
    const amt = parseAmount(line.match(AMOUNT_RE)?.[1] ?? null);
    if (!inv && !amt) continue;
    // Kundenname: längster Wortblock ohne Zahlen
    const nameCand = line
      .replace(INV_RE, ' ')
      .split(/\s{2,}|\s\|\s|;/)
      .map((p) => p.trim())
      .filter((p) => p.length > 3 && /[A-Za-zÄÖÜäöüß]/.test(p) && !/^\d/.test(p))
      .sort((a, b) => b.length - a.length)[0] ?? null;
    out.push({
      invoice_number: inv ? inv.replace(/\s+/g, '-').toUpperCase() : null,
      customer_name: nameCand ? nameCand.replace(/[,;]+$/, '').slice(0, 120) : null,
      amount: amt,
      return_date: isoDate(line),
      reason: /rückl|ruckl|lastschrift|unbezahlt|storno|widerspruch|deckung/i.test(line)
        ? line.slice(0, 160)
        : null,
      raw: line,
    });
  }
  return out;
}

function splitCsvLine(line: string, sep: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q;
    } else if (c === sep && !q) { cells.push(cur); cur = ''; }
    else cur += c;
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

const pick = (row: Record<string, string>, keys: string[]) => {
  for (const k of Object.keys(row)) {
    const kk = k.toLowerCase();
    if (keys.some((n) => kk.includes(n))) {
      const v = row[k];
      if (v) return v;
    }
  }
  return null;
};

/** Parst CSV-Exporte (Bank / DATEV / Zoho) einer Rücklastschrift-Liste. */
export function parseRuecklastCsv(text: string): RuecklastRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const sep = (lines[0].match(/;/g)?.length ?? 0) >= (lines[0].match(/,/g)?.length ?? 0) ? ';' : ',';
  const headers = splitCsvLine(lines[0], sep).map((h) => h.replace(/^"|"$/g, ''));
  const looksLikeHeader = headers.some((h) => /rechn|invoice|betrag|amount|kunde|name|datum|date/i.test(h));
  if (!looksLikeHeader) return parseRuecklastText(text);

  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line, sep);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = (cells[i] ?? '').replace(/^"|"$/g, '')));
    const invRaw = pick(row, ['rechnungsnummer', 'rechnung', 'invoice', 'beleg', 'referenz', 'reference']);
    return {
      invoice_number: invRaw ? String(invRaw).trim().toUpperCase() : (line.match(INV_RE)?.[1]?.toUpperCase() ?? null),
      customer_name: pick(row, ['kunde', 'name', 'customer', 'zahlungspflicht', 'empfänger', 'empfaenger']),
      amount: parseAmount(pick(row, ['betrag', 'amount', 'summe', 'wert'])),
      return_date: isoDate(pick(row, ['datum', 'date', 'buchung', 'valuta'])),
      reason: pick(row, ['grund', 'reason', 'ursache', 'verwendungszweck', 'text']),
      raw: line,
    } as RuecklastRow;
  }).filter((r) => r.invoice_number || r.customer_name || r.amount);
}

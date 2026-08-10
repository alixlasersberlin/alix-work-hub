// ALIXWORK — Manufacturer Management (MFR) Helpers

export const MFR_APPROVAL = ['gesperrt', 'freigegeben', 'bedingt_freigegeben'];
export const MFR_AUDIT_STATUS = ['offen', 'geplant', 'durchgefuehrt', 'bestanden', 'nicht_bestanden', 'ueberfaellig'];
export const MFR_DOC_TYPES = [
  'iso_zertifikat', 'ce_dokument', 'pruefbericht', 'konformitaetserklaerung', 'rohs', 'reach',
  'materialdatenblatt', 'zeichnung', 'datenblatt', 'sicherheitsdatenblatt', 'audit', 'nda',
  'lieferantenvertrag', 'preisliste', 'sonstiges',
];
export const MFR_DOC_STATUS = ['entwurf', 'in_pruefung', 'freigegeben', 'gesperrt', 'abgelaufen'];
export const INCOTERMS = ['EXW', 'FCA', 'FOB', 'CIF', 'CIP', 'CPT', 'DAP', 'DDP'];

const NOISE = /(gmbh|ltd|limited|inc|co|corp|corporation|enterprises|technology|technologies|electronics|international|taiwan|china|germany|europe|\s|\.|,|-|&|\/)/g;

export function normalizeManufacturer(name?: string | null): string {
  return String(name || '').toLowerCase().replace(NOISE, '');
}

/** Levenshtein-basierte Ähnlichkeit 0..1 */
export function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return 1 - dp[m][n] / Math.max(m, n);
}

export interface DuplicateGroup { key: string; rows: any[]; score: number }

/** Gruppiert mögliche Hersteller-Dubletten anhand normalisierter Namen + Ähnlichkeit. */
export function findDuplicateGroups(rows: any[], threshold = 0.82): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const used = new Set<string>();
  for (const r of rows) {
    if (used.has(r.id)) continue;
    const na = r.name_normalized || normalizeManufacturer(r.name);
    const bucket = [r];
    let best = 1;
    for (const o of rows) {
      if (o.id === r.id || used.has(o.id)) continue;
      const nb = o.name_normalized || normalizeManufacturer(o.name);
      const s = na === nb ? 1 : similarity(na, nb);
      if (s >= threshold) { bucket.push(o); best = Math.min(best, s); }
    }
    if (bucket.length > 1) {
      bucket.forEach(b => used.add(b.id));
      groups.push({ key: na, rows: bucket, score: best });
    }
  }
  return groups.sort((a, b) => b.rows.length - a.rows.length);
}

const HEADER_MAP: Record<string, string> = {
  manufacturer: 'manufacturer', hersteller: 'manufacturer', 'manufacturer name': 'manufacturer',
  'manufacturer part number': 'manufacturer_part_number', mpn: 'manufacturer_part_number',
  'hersteller-nr': 'manufacturer_part_number', herstellernummer: 'manufacturer_part_number',
  'part number': 'part_number', teilenummer: 'part_number', artikelnummer: 'part_number', sku: 'part_number',
  'part name': 'part_name', bezeichnung: 'part_name', name: 'part_name', teilename: 'part_name',
  supplier: 'supplier', lieferant: 'supplier',
  'supplier part number': 'supplier_part_number', lieferantennummer: 'supplier_part_number',
  quantity: 'quantity', menge: 'quantity', qty: 'quantity',
  unit: 'unit', einheit: 'unit',
  device: 'device', geraet: 'device', 'gerät': 'device', modell: 'device',
  'original part number': 'original_part_number', 'original-teilenummer': 'original_part_number',
  position: 'position_no', pos: 'position_no', 'bom position': 'position_no',
};

export function mapHeader(h: string): string | null {
  const k = String(h || '').trim().toLowerCase().replace(/[_]+/g, ' ').replace(/\s+/g, ' ');
  return HEADER_MAP[k] || null;
}

export interface BomRow {
  manufacturer?: string; manufacturer_part_number?: string; part_number?: string; part_name?: string;
  supplier?: string; supplier_part_number?: string; quantity?: number; unit?: string; device?: string;
  original_part_number?: string; position_no?: number;
}

export function mapRows(raw: any[]): BomRow[] {
  return raw.map(r => {
    const out: any = {};
    for (const [k, v] of Object.entries(r)) {
      const key = mapHeader(k);
      if (!key) continue;
      out[key] = typeof v === 'string' ? v.trim() : v;
    }
    if (out.quantity !== undefined) out.quantity = Number(String(out.quantity).replace(',', '.')) || null;
    if (out.position_no !== undefined) out.position_no = Number(out.position_no) || null;
    return out as BomRow;
  }).filter(r => r.manufacturer || r.part_number || r.part_name);
}

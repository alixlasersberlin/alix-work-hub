// Lager matching helpers — used by Bestellungen-Liste to check if a production order's
// product is already available in any equipment area (Lager / Unterwegs / Produktion / Warehouse / Hold).

export type LagerDeviceRow = {
  id: string;
  serial_number: string;
  model_name: string;
  notes: string | null;
  reserved_order_id: string | null;
};

export type Department = 'Lagergeräte' | 'Unterwegs' | 'Produktion' | 'Warehouse' | 'Hold';

export type LagerMatch = {
  device: LagerDeviceRow;
  department: Department;
};

const COLOR_SYNONYMS: Record<string, string> = {
  weiss: 'white', weiß: 'white', white: 'white',
  schwarz: 'black', black: 'black',
  blau: 'blue', blue: 'blue',
  gold: 'gold', golden: 'gold',
  silber: 'silver', silver: 'silver',
  grau: 'grey', gray: 'grey', grey: 'grey',
  rot: 'red', red: 'red',
  pink: 'pink', rosa: 'pink',
  grün: 'green', gruen: 'green', green: 'green',
};

function canonicalColors(s: string | null | undefined): Set<string> {
  const out = new Set<string>();
  if (!s) return out;
  const tokens = s.toLowerCase().split(/[^a-zäöüß]+/).filter(Boolean);
  for (const tok of tokens) {
    const c = COLOR_SYNONYMS[tok];
    if (c) out.add(c);
  }
  return out;
}

function getStatus(notes: string | null | undefined): string {
  const m = /\[Status:\s*([^\]]+)\]/.exec(notes ?? '');
  return (m?.[1] ?? 'Bestand').trim();
}

function isLeih(notes: string | null | undefined): boolean {
  return (notes ?? '').includes('[Typ: Leihgerät]') || (notes ?? '').includes('[Leihgerät]');
}

export function deviceDepartment(device: LagerDeviceRow): Department | null {
  const status = getStatus(device.notes);
  if (status === 'Transfer') return 'Unterwegs';
  if (status === 'Produktion') return 'Produktion';
  if (/warehouse/i.test(status)) return 'Warehouse';
  if (status === 'Hold') return 'Hold';
  if (status === 'Bestand' && !isLeih(device.notes)) return 'Lagergeräte';
  return null; // Ausgeliefert, Leihgerät, etc. — excluded
}

function normalize(s: string | null | undefined): string {
  return (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Find first matching unreserved device for the given production order.
 * Matching: device.model_name contains production.modellname AND all production color tokens
 * appear in device (model_name + notes).
 */
export function findLagerMatch(
  modellname: string | null | undefined,
  farbe: string | null | undefined,
  devices: LagerDeviceRow[],
): LagerMatch | null {
  if (!modellname) return null;
  const needle = normalize(modellname);
  if (!needle) return null;
  const wantColors = canonicalColors(farbe);

  for (const d of devices) {
    if (d.reserved_order_id) continue;
    const dep = deviceDepartment(d);
    if (!dep) continue;
    const hay = normalize(d.model_name);
    if (!hay.includes(needle) && !needle.includes(hay)) continue;
    if (wantColors.size > 0) {
      const haveColors = canonicalColors(`${d.model_name} ${d.notes ?? ''}`);
      let ok = true;
      for (const c of wantColors) {
        if (!haveColors.has(c)) { ok = false; break; }
      }
      if (!ok) continue;
    }
    return { device: d, department: dep };
  }
  return null;
}

// Common prefix used to detect ANY previously-written LAGER-CHECK note (hit or miss).
export const LAGER_NOTE_MARKER = '[LAGER-CHECK';
export const LAGER_MISSING_MARKER = '[LAGER-CHECK: NICHT VORHANDEN — muss bestellt werden]';
export function lagerFoundNote(department: Department, serial: string): string {
  return `[LAGER-CHECK: Im Lager gefunden & reserviert — Abteilung ${department}, SN ${serial}]`;
}

/**
 * Remove every existing [LAGER-CHECK ...] marker from an anmerkungen string
 * so we can safely re-append a single, fresh marker without duplicating.
 */
export function stripLagerMarkers(anmerkungen: string | null | undefined): string {
  if (!anmerkungen) return '';
  return anmerkungen
    .replace(/\s*\[LAGER-CHECK[^\]]*\]\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

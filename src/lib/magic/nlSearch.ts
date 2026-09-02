// MAGIC STATUS · Natürlichsprachliche Suche (deterministisch, ohne externen KI-Call)
// Übersetzt Sätze wie "Alle Aufträge ohne Seriennummer" in echte Datenbank-Filter.
import { supabase } from '@/integrations/supabase/client';
import { MAGIC_STATUSES } from './statuses';

export interface MagicNlRow {
  id: string;
  order_number: string;
  source_system: string | null;
  magic_status: string | null;
  order_status: string | null;
  total_amount: number | null;
  currency: string | null;
  customers?: { company_name?: string | null; contact_name?: string | null } | null;
}

export interface MagicNlQuery {
  /** erkannte Absicht, wird dem Nutzer angezeigt */
  intent: string;
  /** Klartext-Erklärung, welche Filter angewandt wurden */
  explanation: string;
  run: () => Promise<MagicNlRow[]>;
}

const SELECT =
  'id, order_number, source_system, magic_status, order_status, total_amount, currency, customers(company_name, contact_name)';

const norm = (s: string) =>
  s.toLowerCase().replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss');

const base = () =>
  supabase.from('orders').select(SELECT).order('created_at', { ascending: false }).limit(200);

const rows = async (p: any): Promise<MagicNlRow[]> => ((await p).data ?? []) as MagicNlRow[];

function daysAgoIso(d: number) {
  const dt = new Date();
  dt.setDate(dt.getDate() - d);
  dt.setHours(0, 0, 0, 0);
  return dt.toISOString();
}

/**
 * Erkennt eine natürlichsprachliche Abfrage. Gibt `null` zurück, wenn der Text
 * eher eine normale Stichwortsuche (Nummer, Name) ist.
 */
export function parseMagicQuery(input: string): MagicNlQuery | null {
  const raw = input.trim();
  if (raw.length < 6) return null;
  const q = norm(raw);
  // Nummern-/Kennungssuche bleibt bei der klassischen Suche
  if (/^[a-z]{0,4}[-_]?\d{3,}/i.test(raw) || !/\s/.test(raw)) return null;

  const wantsOrders = /(auftrag|auftrage|bestellung|order|ab-)/.test(q);
  const negated = /(ohne|fehlt|fehlende|kein|keine|nicht)/.test(q);

  // Zeitraum
  let since: string | null = null;
  let sinceLabel = '';
  if (/(heute)/.test(q)) { since = daysAgoIso(0); sinceLabel = 'seit heute'; }
  else if (/(gestern)/.test(q)) { since = daysAgoIso(1); sinceLabel = 'seit gestern'; }
  else if (/(diese woche|letzte woche|7 tage|woche)/.test(q)) { since = daysAgoIso(7); sinceLabel = 'letzte 7 Tage'; }
  else if (/(monat|30 tage)/.test(q)) { since = daysAgoIso(30); sinceLabel = 'letzte 30 Tage'; }

  const applyTime = (query: any) => (since ? query.gte('created_at', since) : query);
  const timeNote = since ? ` · ${sinceLabel}` : '';

  // 1) Seriennummer fehlt
  if (/(seriennummer|serien-nr|sn\b|serial)/.test(q) && negated) {
    return {
      intent: 'Aufträge ohne Seriennummer',
      explanation: `Lieferantenbestellungen ohne gepflegte Seriennummer${timeNote}.`,
      run: async () => {
        const { data } = await supabase
          .from('production_orders')
          .select('order_id')
          .or('seriennummer.is.null,seriennummer.eq.')
          .not('order_id', 'is', null)
          .limit(300);
        const ids = Array.from(new Set((data ?? []).map((p: any) => p.order_id))).slice(0, 200);
        if (!ids.length) return [];
        return rows(applyTime(base().in('id', ids)));
      },
    };
  }

  // 2) Offene Zahlungen
  if (/(zahlung|bezahlt|offene rechnung|offen.*betrag|forderung|anzahlung)/.test(q)) {
    const deposit = /(anzahlung)/.test(q);
    return {
      intent: deposit ? 'Aufträge mit offener Anzahlung' : 'Aufträge mit offener Zahlung',
      explanation: `Offener Betrag größer 0${timeNote}.`,
      run: () => rows(applyTime(base().gt('finance_open_amount', 0))),
    };
  }

  // 3) Überfällig
  if (/(uberfallig|verspatet|verzug|zu spat)/.test(q)) {
    return {
      intent: 'Überfällige Aufträge',
      explanation: 'Geplanter Versandtermin liegt in der Vergangenheit.',
      run: () => rows(base().lt('expected_shipment_date', new Date().toISOString())),
    };
  }

  // 4) Blockiert
  if (/(blockiert|gesperrt|problem|stornier)/.test(q)) {
    return {
      intent: 'Blockierte Aufträge',
      explanation: 'Magic Status = gesperrt.',
      run: () => rows(applyTime(base().eq('magic_status', 'gesperrt'))),
    };
  }

  // 5) Statusbezogene Abfrage („welche Aufträge sind in Produktion?")
  const status = MAGIC_STATUSES.find((s) => {
    const label = norm(s.label);
    return q.includes(label) || (label.length > 5 && q.includes(label.split(' ')[0]));
  });
  if (status) {
    return {
      intent: `Aufträge im Status „${status.label}"`,
      explanation: `Magic Status = ${status.key}${timeNote}.`,
      run: () => rows(applyTime(base().eq('magic_status', status.key))),
    };
  }

  // 6) Noch ohne Magic Status
  if (wantsOrders && negated && /(status)/.test(q)) {
    return {
      intent: 'Aufträge ohne Magic Status',
      explanation: `Noch nie über Magic Status gesteuert${timeNote}.`,
      run: () => rows(applyTime(base().is('magic_status', null))),
    };
  }

  // 7) Allgemeine Auftragsliste mit Zeitraum
  if (wantsOrders && since) {
    return {
      intent: `Aufträge ${sinceLabel}`,
      explanation: `Alle Aufträge ${sinceLabel}.`,
      run: () => rows(applyTime(base())),
    };
  }

  return null;
}

export const MAGIC_NL_EXAMPLES = [
  'Alle Aufträge ohne Seriennummer',
  'Welche Aufträge sind in Produktion?',
  'Aufträge mit offener Zahlung diese Woche',
  'Überfällige Aufträge',
  'Blockierte Aufträge',
];

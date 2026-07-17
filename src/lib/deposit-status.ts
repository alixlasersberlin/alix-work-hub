/**
 * Anzahlungs-Status Helper.
 *
 * Ein Auftrag hat eine "TeilZahlung" wenn:
 *  - bereits ein Betrag auf die Anzahlung geleistet wurde
 *  - aber der Gesamt-Soll-Betrag (deposit_amount + Summe aller weiteren
 *    Anzahlungen) noch nicht komplett bezahlt ist.
 *
 * Wird u. a. für die orange Ausrufezeichen-Kennzeichnung in
 *  - Auftragsliste (`Orders.tsx`, `OrdersAt.tsx`)
 *  - Auftragsdetail (`OrderDetail.tsx`)
 *  - Bestellungen-Dashboard (`BestellungenDashboard.tsx`)
 * verwendet.
 */

export type AdditionalDepositRow = {
  amount: number | string | null;
  geleistet: boolean | null;
};

export type OrderDepositInput = {
  deposit_amount?: number | string | null;
  deposit_additional?: number | string | null;
  deposit_ok?: boolean | null;
  raw_data?: any;
};

export interface DepositStatus {
  /** Vereinbarter Gesamt-Anzahlungsbetrag (Haupt + weitere) */
  expected: number;
  /** Bereits geleisteter Betrag */
  paid: number;
  /** Noch offener Betrag */
  open: number;
  /** Vollständig bezahlt */
  isPaid: boolean;
  /** Teilzahlung geleistet, aber noch Rest offen */
  isPartial: boolean;
}

function n(v: unknown): number {
  const x = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : Number(v);
  return Number.isFinite(x) ? x : 0;
}

export function computeDepositStatus(
  order: OrderDepositInput | null | undefined,
  additional: AdditionalDepositRow[] | null | undefined = [],
): DepositStatus {
  const main = n(order?.deposit_amount);
  const addRows = additional ?? [];
  const addTotal = addRows.reduce((s, r) => s + n(r.amount), 0);
  const addPaid = addRows.reduce((s, r) => s + (r.geleistet ? n(r.amount) : 0), 0);

  // Falls keine detaillierten Zeilen vorhanden sind, aber `deposit_additional`
  // als Summe gesetzt ist, als offener Zusatzbetrag interpretieren.
  const legacyAdditional = addRows.length === 0 ? n(order?.deposit_additional) : 0;

  // Vereinbarte Anzahlung aus dem Angebot (raw_data.payment.down).
  // Ist diese höher als der aktuell erfasste Soll-Betrag, gilt die Differenz als offen.
  const offerDown = n(order?.raw_data?.payment?.down);

  const depositOk = !!order?.deposit_ok;
  const bookedExpected = main + addTotal + legacyAdditional;
  const expected = Math.max(bookedExpected, offerDown);
  const paid = (depositOk ? main : 0) + addPaid;
  const open = Math.max(0, expected - paid);

  return {
    expected,
    paid,
    open,
    isPaid: expected > 0 && open <= 0.005,
    isPartial: paid > 0.005 && open > 0.005,
  };
}

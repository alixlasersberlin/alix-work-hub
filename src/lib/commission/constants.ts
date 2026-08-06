export type CommissionStatus =
  | 'not_calculated' | 'preliminary' | 'condition_open' | 'effective' | 'blocked'
  | 'in_review' | 'pending_approval' | 'approved' | 'payout_scheduled' | 'paid'
  | 'partially_paid' | 'corrected' | 'cancelled' | 'reclaimed' | 'closed';

export const STATUS_LABELS: Record<CommissionStatus, string> = {
  not_calculated: 'nicht berechnet',
  preliminary: 'vorläufig berechnet',
  condition_open: 'Voraussetzung offen',
  effective: 'wirksam',
  blocked: 'gesperrt',
  in_review: 'zur Prüfung',
  pending_approval: 'zur Freigabe',
  approved: 'freigegeben',
  payout_scheduled: 'zur Auszahlung vorgemerkt',
  paid: 'ausgezahlt',
  partially_paid: 'teilweise ausgezahlt',
  corrected: 'korrigiert',
  cancelled: 'storniert',
  reclaimed: 'zurückgefordert',
  closed: 'abgeschlossen',
};

/** Farbklassen laut Spezifikation: grau / gelb / grün / rot / blau */
export const STATUS_CLASSES: Record<CommissionStatus, string> = {
  not_calculated: 'text-slate-300 border-slate-500/30 bg-slate-500/10',
  preliminary: 'text-slate-300 border-slate-500/30 bg-slate-500/10',
  condition_open: 'text-amber-300 border-amber-500/30 bg-amber-500/10',
  effective: 'text-amber-300 border-amber-500/30 bg-amber-500/10',
  in_review: 'text-amber-300 border-amber-500/30 bg-amber-500/10',
  pending_approval: 'text-amber-300 border-amber-500/30 bg-amber-500/10',
  blocked: 'text-rose-300 border-rose-500/30 bg-rose-500/10',
  cancelled: 'text-rose-300 border-rose-500/30 bg-rose-500/10',
  reclaimed: 'text-rose-300 border-rose-500/30 bg-rose-500/10',
  approved: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10',
  paid: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10',
  partially_paid: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10',
  closed: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10',
  corrected: 'text-sky-300 border-sky-500/30 bg-sky-500/10',
  payout_scheduled: 'text-sky-300 border-sky-500/30 bg-sky-500/10',
};

export const EMPLOYEE_ROLES: { value: string; label: string }[] = [
  { value: 'verkaeufer', label: 'Verkäufer' },
  { value: 'verkaufsberater', label: 'Verkaufsberater' },
  { value: 'vertriebsmitarbeiter', label: 'Vertriebsmitarbeiter' },
  { value: 'teamleiter_vertrieb', label: 'Teamleiter Vertrieb' },
  { value: 'vermittler', label: 'Vermittler' },
  { value: 'aussendienst', label: 'Außendienstmitarbeiter' },
  { value: 'empfehlungsgeber', label: 'Empfehlungsgeber' },
  { value: 'account_manager', label: 'Account Manager' },
  { value: 'vertriebsleiter', label: 'Vertriebsleiter' },
  { value: 'filialleiter', label: 'Filialleiter' },
  { value: 'kooperationspartner', label: 'Kooperationspartner' },
  { value: 'handelsvertreter', label: 'freier Handelsvertreter' },
  { value: 'weiterer_beteiligter', label: 'weiterer Beteiligter' },
];

export const COMMISSION_TYPES = [
  { value: 'percent', label: 'Prozentuale Provision' },
  { value: 'fixed_per_device', label: 'Festbetrag pro Gerät' },
  { value: 'tiered', label: 'Staffelprovision' },
  { value: 'combined', label: 'Festbetrag + Prozent' },
  { value: 'team', label: 'Teamprovision' },
  { value: 'special', label: 'Sonderprovision' },
];

export const BASIS_OPTIONS = [
  { value: 'net', label: 'Nettoverkaufspreis' },
  { value: 'gross', label: 'Bruttoverkaufspreis' },
  { value: 'net_after_discount', label: 'Netto nach Rabatt' },
  { value: 'gross_after_discount', label: 'Brutto nach Rabatt' },
  { value: 'margin', label: 'Deckungsbeitrag' },
  { value: 'paid_amount', label: 'Eingegangener Zahlungsbetrag' },
  { value: 'paid_installment', label: 'Bezahlte Rate' },
  { value: 'custom', label: 'Individueller Provisionswert' },
];

export const EFFECTIVE_EVENTS = [
  { value: 'order_created', label: 'bei Auftragserstellung' },
  { value: 'order_confirmed', label: 'bei Auftragsbestätigung' },
  { value: 'withdrawal_expired', label: 'nach Ablauf der Widerrufsfrist' },
  { value: 'deposit_received', label: 'nach Eingang der Anzahlung' },
  { value: 'fully_paid', label: 'nach vollständigem Zahlungseingang' },
  { value: 'delivered', label: 'nach Lieferung' },
  { value: 'handover_confirmed', label: 'nach bestätigter Übergabe' },
  { value: 'commissioned', label: 'nach Inbetriebnahme' },
  { value: 'custom_deadline', label: 'nach Ablauf einer Frist' },
  { value: 'installment_received', label: 'nach Eingang einer Rate' },
  { value: 'financing_approved', label: 'nach Finanzierungsfreigabe' },
  { value: 'admin_release', label: 'nach Freigabe durch Admin' },
  { value: 'custom', label: 'individueller Zeitpunkt' },
];

export const PAYOUT_TIMINGS = [
  { value: 'immediate', label: 'sofort nach Wirksamkeit' },
  { value: 'next_payroll', label: 'mit der nächsten Gehaltsabrechnung' },
  { value: 'month_end', label: 'zum Monatsende' },
  { value: 'first_of_next_month', label: 'zum 1. des Folgemonats' },
  { value: 'fifteenth_of_next_month', label: 'zum 15. des Folgemonats' },
  { value: 'after_full_payment', label: 'nach vollständigem Zahlungseingang' },
  { value: 'after_first_installment', label: 'nach Eingang der ersten Rate' },
  { value: 'after_specific_installment', label: 'nach Eingang einer bestimmten Rate' },
  { value: 'pro_rata_installments', label: 'anteilig mit jeder Kundenrate' },
  { value: 'after_handover', label: 'nach Übergabe des Gerätes' },
  { value: 'after_withdrawal_period', label: 'nach Ablauf der Widerrufsfrist' },
  { value: 'after_retention_period', label: 'nach Ablauf einer Rückbehaltsfrist' },
  { value: 'manual_release', label: 'nach manueller Freigabe' },
  { value: 'custom_date', label: 'individueller Auszahlungstermin' },
];

export const INSTALLMENT_MODES = [
  { value: 'full_after_first_installment', label: 'Volle Provision nach erster Rate' },
  { value: 'full_after_full_payment', label: 'Volle Provision nach vollständiger Zahlung' },
  { value: 'pro_rata', label: 'Anteilig je Zahlungseingang' },
  { value: 'custom_schedule', label: 'Individuelle Ratenregel' },
];

export const RECLAIM_RULES = [
  { value: 'full_on_cancellation', label: 'Vollständige Rückforderung bei Stornierung' },
  { value: 'pro_rata', label: 'Anteilige Rückforderung' },
  { value: 'cancel_unpaid', label: 'Nur nicht ausgezahlte Provision stornieren' },
  { value: 'block_until_clarified', label: 'Bis zur Klärung sperren' },
  { value: 'no_reclaim_after_period', label: 'Keine Rückforderung nach Frist' },
  { value: 'manual', label: 'Manuelle Prüfung erforderlich' },
];

export const PAYMENT_METHODS = [
  { value: 'payroll', label: 'mit Gehaltsabrechnung' },
  { value: 'bank_transfer', label: 'separate Banküberweisung' },
  { value: 'credit_note', label: 'Gutschrift' },
  { value: 'cash', label: 'Barauszahlung' },
  { value: 'offset', label: 'Verrechnung' },
  { value: 'other', label: 'andere Zahlungsart' },
];

export const TAX_TREATMENTS = [
  { value: 'employee', label: 'Angestelltenprovision' },
  { value: 'agent', label: 'Provision freier Handelsvertreter' },
  { value: 'referral', label: 'Vermittlungsprovision' },
  { value: 'team_bonus', label: 'Teamprämie' },
  { value: 'bonus', label: 'Bonus' },
  { value: 'other_variable', label: 'sonstige variable Vergütung' },
];

export const REVERSAL_REASONS = [
  { value: 'kundenwiderruf', label: 'Kundenwiderruf' },
  { value: 'storno', label: 'Stornierung' },
  { value: 'ruecktritt', label: 'Rücktritt' },
  { value: 'finanzierung_abgelehnt', label: 'Finanzierung abgelehnt' },
  { value: 'zahlungsausfall', label: 'Zahlungsausfall' },
  { value: 'ruecklastschrift', label: 'Rücklastschrift' },
  { value: 'geraet_zurueck', label: 'Gerät zurückgenommen' },
  { value: 'rueckabwicklung', label: 'Auftrag rückabgewickelt' },
  { value: 'betrugsverdacht', label: 'Betrugsverdacht' },
  { value: 'preisnachlass', label: 'nachträglicher Preisnachlass' },
  { value: 'provisionsfehler', label: 'Provisionsfehler' },
  { value: 'sonstiges', label: 'sonstiger Grund' },
];

export function fmtMoney(n: number | null | undefined, c = 'EUR') {
  if (n == null) return '–';
  try { return new Intl.NumberFormat('de-DE', { style: 'currency', currency: c || 'EUR' }).format(n); }
  catch { return `${Number(n).toFixed(2)} ${c}`; }
}
export function fmtDate(d: string | null | undefined) {
  if (!d) return '–';
  try { return new Date(d).toLocaleDateString('de-DE'); } catch { return d; }
}
export function fmtPercent(n: number | null | undefined) {
  if (n == null) return '–';
  return `${Number(n).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
}

export type BankFileFormat =
  | 'csv' | 'txt' | 'xls' | 'xlsx' | 'pdf'
  | 'mt940' | 'mt942'
  | 'camt052' | 'camt053' | 'camt054' | 'xml'
  | 'ofx' | 'qif' | 'datev' | 'unbekannt';

export interface ParsedTx {
  booking_date: string | null;
  value_date: string | null;
  amount: number;
  currency: string;
  transaction_type: 'eingang' | 'ausgang';
  sender_receiver_name: string | null;
  sender_receiver_iban: string | null;
  bic: string | null;
  booking_text: string | null;
  purpose: string | null;
  bank_reference: string | null;
  end_to_end_reference: string | null;
  mandate_reference: string | null;
  customer_reference: string | null;
  raw_data: Record<string, any>;
  /** true, wenn Zeile unvollständig ist (Datum oder Betrag fehlt) */
  invalid?: boolean;
}

export interface ParseResult {
  format: BankFileFormat;
  transactions: ParsedTx[];
  needsMapping: boolean;
  /** Rohzeilen für den Zuordnungsassistenten (CSV/TXT/XLSX) */
  rows?: Record<string, any>[];
  headers?: string[];
  warnings: string[];
  requiresReview: boolean;
}

export const MAPPING_FIELDS = [
  { key: 'booking_date', label: 'Buchungsdatum' },
  { key: 'value_date', label: 'Wertstellungsdatum' },
  { key: 'amount', label: 'Betrag' },
  { key: 'currency', label: 'Währung' },
  { key: 'purpose', label: 'Verwendungszweck' },
  { key: 'booking_text', label: 'Buchungstext' },
  { key: 'sender_receiver_name', label: 'Kundenname (Auftraggeber / Empfänger)' },
  { key: 'sender_receiver_iban', label: 'IBAN' },
  { key: 'bic', label: 'BIC' },
  { key: 'bank_reference', label: 'Bankreferenz' },
  { key: 'end_to_end_reference', label: 'End-to-End-Referenz' },
  { key: 'mandate_reference', label: 'Mandatsreferenz' },
  { key: 'customer_reference', label: 'Kundenreferenz' },
  { key: 'invoice_number', label: 'Rechnungsnummer' },
  { key: 'transaction_kind', label: 'Buchungsart' },
  { key: 'debit_credit', label: 'Soll / Haben' },
] as const;

export type MappingKey = typeof MAPPING_FIELDS[number]['key'];
export type ColumnMapping = Partial<Record<MappingKey, string>>;

export const TX_STATUS_LABELS: Record<string, string> = {
  offen: 'Offen',
  vorschlag: 'Zuordnung prüfen',
  sicher: 'Übereinstimmung gefunden',
  verbucht: 'Verbucht',
  zurueckgestellt: 'Zurückgestellt',
  ignoriert: 'Ignoriert',
  dublette: 'Mögliche Dublette',
};

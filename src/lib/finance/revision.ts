export const REVISION_ROLES = ['Admin', 'Super Admin'];
export const revisionCategories: Record<string, string> = {
  unbooked: 'Unverbuchte Eingänge', duplicate: 'Doppelte Zuordnungen',
  return: 'Rücklastschrift / bezahlt', paid_target: 'Bereits bezahltes Ziel',
};
export const revisionStatuses: Record<string, string> = {
  open: 'Offen', in_progress: 'In Bearbeitung', clarification: 'Klärung erforderlich', reviewed: 'Geprüft',
};
export interface RevisionCase {
  case_key: string; category: string; transaction_id: string; invoice_id: string | null;
  booking_date: string | null; currency: string; tenant_id: string | null;
  customer_name: string | null; invoice_number: string | null; amount: number; reason: string;
  review_status: string; review_note: string | null;
  history: { status: string; note: string; at: string; user_id: string }[];
}
export function validRevisionReview(status: string, note: string): boolean {
  return Object.prototype.hasOwnProperty.call(revisionStatuses, status) && note.trim().length >= 5 && note.length <= 4000;
}
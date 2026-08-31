export type ComplianceTaskStatus =
  | 'ready'
  | 'in_progress'
  | 'deferred'
  | 'waiting_supplier'
  | 'in_review'
  | 'rejected'
  | 'done';

export interface ComplianceTask {
  id: string;
  project_id: string;
  task_no: number | null;
  title: string;
  purpose: string | null;
  category: string | null;
  ref_codes: string[] | null;
  mandatory: boolean;
  status: ComplianceTaskStatus;
  priority: string;
  progress: number;
  assignee_id: string | null;
  co_assignee_ids?: string[] | null;
  reviewer_id: string | null;
  due_date: string | null;
  defer_reason: string | null;
  defer_comment: string | null;
  defer_until: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  review_comment: string | null;
  completed_at: string | null;
  last_saved_at: string | null;
}

export interface ComplianceTaskStep {
  id: string;
  task_id: string;
  step_no: number;
  label: string;
  hint: string | null;
  input_type: string;
  required: boolean;
  value: string | null;
  file_url: string | null;
  done: boolean;
}

export const TASK_STATUS_LABEL: Record<string, string> = {
  ready: 'BEREIT',
  in_progress: 'IN BEARBEITUNG',
  deferred: 'ZURÜCKGESTELLT',
  waiting_supplier: 'WARTET AUF LIEFERANT',
  in_review: 'ZUR PRÜFUNG',
  rejected: 'ABGELEHNT',
  done: 'ABGESCHLOSSEN',
};

export const TASK_STATUS_CLASS: Record<string, string> = {
  ready: 'bg-slate-500/15 text-slate-400',
  in_progress: 'bg-amber-500/15 text-amber-500',
  deferred: 'bg-purple-500/15 text-purple-400',
  waiting_supplier: 'bg-blue-500/15 text-blue-400',
  in_review: 'bg-cyan-500/15 text-cyan-400',
  rejected: 'bg-red-500/15 text-red-500',
  done: 'bg-emerald-500/15 text-emerald-500',
};

export const DEFER_REASONS = [
  'Information fehlt',
  'Lieferant antwortet noch',
  'Entwickler muss liefern',
  'Testgerät fehlt',
  'Prüfung erforderlich',
  'Andere Aufgabe erforderlich',
  'Sonstiges',
];

const isOverdue = (t: ComplianceTask) => !!t.due_date && new Date(t.due_date) < new Date();
const deferDue = (t: ComplianceTask) => !!t.defer_until && new Date(t.defer_until) <= new Date();

/**
 * Priorität: 1 Rejected · 2 Critical Blocker · 3 In Progress ·
 * 4 nächster Ready · 5 Overdue · 6 fällige Wiedervorlage.
 */
export function pickNextTask(tasks: ComplianceTask[]): ComplianceTask | null {
  const open = tasks.filter((t) => t.status !== 'done');
  const rank = (t: ComplianceTask) => {
    if (t.status === 'rejected') return 1;
    if (t.priority === 'critical' && t.status !== 'in_review') return 2;
    if (t.status === 'in_progress') return 3;
    if (t.status === 'ready' && !isOverdue(t)) return 4;
    if (isOverdue(t)) return 5;
    if (t.status === 'deferred' && deferDue(t)) return 6;
    return 9;
  };
  const sorted = [...open].sort((a, b) => {
    const d = rank(a) - rank(b);
    if (d !== 0) return d;
    const da = a.due_date || '9999-12-31';
    const db = b.due_date || '9999-12-31';
    if (da !== db) return da.localeCompare(db);
    return (a.task_no ?? 9999) - (b.task_no ?? 9999);
  });
  const best = sorted[0];
  return best && rank(best) < 9 ? best : (sorted[0] ?? null);
}

/** Fortschritt zählt nur echte Abschlüsse (Pflichtaufgaben). */
export function mandatoryProgress(tasks: ComplianceTask[]) {
  const mandatory = tasks.filter((t) => t.mandatory);
  const done = mandatory.filter((t) => t.status === 'done').length;
  const pct = mandatory.length ? (done / mandatory.length) * 100 : 0;
  return { total: mandatory.length, done, pct: Math.round(pct * 10) / 10 };
}

// Bedingungslogik für Umfragen: Fragen ein-/ausblenden, überspringen, vorzeitig beenden.

export type LogicRule = {
  id: string;
  source_question_id: string | null;
  operator: string;
  compare_value: any;
  action: string;
  target_question_id: string | null;
  position?: number;
  status?: string;
};

export const LOGIC_OPERATORS: { value: string; label: string; needsValue: boolean }[] = [
  { value: 'eq', label: 'ist gleich', needsValue: true },
  { value: 'ne', label: 'ist nicht gleich', needsValue: true },
  { value: 'gt', label: 'ist größer als', needsValue: true },
  { value: 'gte', label: 'ist größer/gleich', needsValue: true },
  { value: 'lt', label: 'ist kleiner als', needsValue: true },
  { value: 'lte', label: 'ist kleiner/gleich', needsValue: true },
  { value: 'contains', label: 'enthält', needsValue: true },
  { value: 'answered', label: 'wurde beantwortet', needsValue: false },
  { value: 'not_answered', label: 'wurde nicht beantwortet', needsValue: false },
];

export const LOGIC_ACTIONS: { value: string; label: string; needsTarget: boolean }[] = [
  { value: 'show', label: 'Frage nur dann zeigen', needsTarget: true },
  { value: 'hide', label: 'Frage ausblenden', needsTarget: true },
  { value: 'jump', label: 'Zu Frage springen (dazwischen überspringen)', needsTarget: true },
  { value: 'end', label: 'Umfrage vorzeitig beenden', needsTarget: false },
];

function toNum(v: any): number | null {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function asText(v: any): string {
  if (Array.isArray(v)) return v.map(x => String(x)).join('|').toLowerCase();
  if (typeof v === 'boolean') return v ? 'ja' : 'nein';
  return String(v ?? '').toLowerCase();
}

function isEmpty(v: any) {
  if (Array.isArray(v)) return v.length === 0;
  return v === undefined || v === null || v === '';
}

export function evaluateCondition(rule: LogicRule, answers: Record<string, any>): boolean {
  const v = rule.source_question_id ? answers[rule.source_question_id] : undefined;
  const cmpRaw = rule.compare_value && typeof rule.compare_value === 'object' && 'value' in rule.compare_value
    ? (rule.compare_value as any).value
    : rule.compare_value;

  switch (rule.operator) {
    case 'answered': return !isEmpty(v);
    case 'not_answered': return isEmpty(v);
    case 'eq': {
      if (Array.isArray(v)) return v.map(asText).includes(asText(cmpRaw));
      return asText(v) === asText(cmpRaw);
    }
    case 'ne': {
      if (Array.isArray(v)) return !v.map(asText).includes(asText(cmpRaw));
      return asText(v) !== asText(cmpRaw);
    }
    case 'contains': return asText(v).includes(asText(cmpRaw));
    default: {
      const a = toNum(v), b = toNum(cmpRaw);
      if (a === null || b === null) return false;
      if (rule.operator === 'gt') return a > b;
      if (rule.operator === 'gte') return a >= b;
      if (rule.operator === 'lt') return a < b;
      if (rule.operator === 'lte') return a <= b;
      return false;
    }
  }
}

/**
 * Ermittelt anhand der Regeln, welche Fragen aktuell sichtbar sind
 * und ob die Umfrage vorzeitig beendet werden soll.
 */
export function applyLogic(
  questions: { id: string }[],
  rules: LogicRule[],
  answers: Record<string, any>,
): { visibleIds: Set<string>; endAfter: string | null } {
  const active = (rules ?? []).filter(r => (r.status ?? 'aktiv') === 'aktiv' && r.source_question_id);
  const visible = new Set(questions.map(q => q.id));
  const order = questions.map(q => q.id);
  let endAfter: string | null = null;

  // "show"-Regeln: Zielfrage nur zeigen, wenn mindestens eine Bedingung erfüllt ist
  const showTargets = new Map<string, boolean>();
  for (const r of active) {
    const ok = evaluateCondition(r, answers);
    if (r.action === 'show' && r.target_question_id) {
      showTargets.set(r.target_question_id, (showTargets.get(r.target_question_id) ?? false) || ok);
    }
    if (r.action === 'hide' && r.target_question_id && ok) visible.delete(r.target_question_id);
    if (r.action === 'end' && ok && r.source_question_id) {
      const idx = order.indexOf(r.source_question_id);
      if (idx >= 0 && (endAfter === null || idx < order.indexOf(endAfter))) endAfter = r.source_question_id;
    }
    if (r.action === 'jump' && ok && r.target_question_id && r.source_question_id) {
      const from = order.indexOf(r.source_question_id);
      const to = order.indexOf(r.target_question_id);
      if (from >= 0 && to > from) order.slice(from + 1, to).forEach(qid => visible.delete(qid));
    }
  }
  for (const [qid, ok] of showTargets) if (!ok) visible.delete(qid);

  if (endAfter) {
    const idx = order.indexOf(endAfter);
    order.slice(idx + 1).forEach(qid => visible.delete(qid));
  }

  return { visibleIds: visible, endAfter };
}

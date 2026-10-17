export type Stage = { key: string; percent: number; event: string; first_monthly_installments?: number };
export type Evidence = { deposit_received: boolean; first_three_paid: boolean };

export function stagesFor(rule: Record<string, any>): Stage[] {
  if (rule.installment_mode !== 'custom_schedule' || !Array.isArray(rule.installment_schedule)) return [];
  return rule.installment_schedule.filter((s: Stage) =>
    typeof s.key === 'string' && Number.isFinite(s.percent) && s.percent > 0 &&
    (s.event === 'deposit_received' || (s.event === 'delivered' && s.first_monthly_installments === 3)));
}

export function stageEffective(stage: Stage, order: Record<string, any>, evidence: Evidence): boolean {
  const status = String(order.order_status ?? '').toLowerCase();
  if (['void', 'storniert', 'cancelled'].includes(status)) return false;
  if (stage.event === 'deposit_received') return evidence.deposit_received;
  return ['geliefert', 'delivered'].includes(status) && evidence.first_three_paid;
}

export function stageAmount(net: number, stage: Stage, share = 100): number {
  return Math.round((net * stage.percent / 100 * share / 100 + Number.EPSILON) * 100) / 100;
}
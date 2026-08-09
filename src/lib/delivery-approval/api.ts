import { supabase } from '@/integrations/supabase/client';
import {
  STAGES, stageDef, SLA_HOURS,
  type ApprovalStage, type StageStatus, type OverallStatus,
} from './config';

export interface DeliveryApproval {
  id: string;
  order_id: string;
  warehouse_status: StageStatus;
  warehouse_checks: Record<string, boolean>;
  warehouse_comment: string | null;
  warehouse_by_name: string | null;
  warehouse_at: string | null;
  warehouse_signature: string | null;
  accounting_status: StageStatus;
  accounting_checks: Record<string, boolean>;
  accounting_comment: string | null;
  accounting_by_name: string | null;
  accounting_at: string | null;
  accounting_signature: string | null;
  dispatch_status: StageStatus;
  dispatch_checks: Record<string, boolean>;
  dispatch_comment: string | null;
  dispatch_by_name: string | null;
  dispatch_at: string | null;
  dispatch_signature: string | null;
  overall_status: OverallStatus;
  released_at: string | null;
  unlock_reason: string | null;
  unlocked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApprovalEvent {
  id: string;
  order_id: string;
  stage: string;
  old_status: string | null;
  new_status: string | null;
  user_name: string | null;
  comment: string | null;
  ip_address: string | null;
  created_at: string;
}

const db = supabase as any;

export function stageStatus(a: DeliveryApproval | null, s: ApprovalStage): StageStatus {
  if (!a) return 'open';
  return (a as any)[`${s}_status`] ?? 'open';
}

export function stageChecks(a: DeliveryApproval | null, s: ApprovalStage): Record<string, boolean> {
  if (!a) return {};
  return ((a as any)[`${s}_checks`] ?? {}) as Record<string, boolean>;
}

/** Fehlende Freigaben in Reihenfolge */
export function missingStages(a: DeliveryApproval | null): string[] {
  return STAGES.filter((s) => stageStatus(a, s.stage) !== 'approved').map((s) => s.title);
}

export function isReleased(a: DeliveryApproval | null): boolean {
  return !!a && ['released', 'delivered', 'completed'].includes(a.overall_status);
}

/** Vorherige Stufe muss abgeschlossen sein */
export function isStageUnlocked(a: DeliveryApproval | null, s: ApprovalStage): boolean {
  const def = stageDef(s);
  const previous = STAGES.filter((x) => x.order < def.order);
  return previous.every((p) => stageStatus(a, p.stage) === 'approved');
}

export async function fetchApproval(orderId: string): Promise<DeliveryApproval | null> {
  const { data } = await db.from('delivery_approvals').select('*').eq('order_id', orderId).maybeSingle();
  return (data as DeliveryApproval) ?? null;
}

export async function ensureApproval(orderId: string): Promise<DeliveryApproval> {
  const existing = await fetchApproval(orderId);
  if (existing) return existing;
  const { data, error } = await db
    .from('delivery_approvals')
    .insert({ order_id: orderId })
    .select('*')
    .single();
  if (error) throw error;
  return data as DeliveryApproval;
}

export async function fetchEvents(orderId: string): Promise<ApprovalEvent[]> {
  const { data } = await db
    .from('delivery_approval_events')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false });
  return (data ?? []) as ApprovalEvent[];
}

async function clientIp(): Promise<string | null> {
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const j = await res.json();
    return j?.ip ?? null;
  } catch {
    return null;
  }
}

async function logEvent(params: {
  approvalId: string; orderId: string; stage: string;
  oldStatus?: string | null; newStatus?: string | null;
  userId?: string | null; userName?: string | null;
  comment?: string | null; ip?: string | null; signature?: string | null;
}) {
  await db.from('delivery_approval_events').insert({
    approval_id: params.approvalId,
    order_id: params.orderId,
    stage: params.stage,
    old_status: params.oldStatus ?? null,
    new_status: params.newStatus ?? null,
    user_id: params.userId ?? null,
    user_name: params.userName ?? null,
    comment: params.comment ?? null,
    ip_address: params.ip ?? null,
    signature: params.signature ?? null,
  });
}

async function notifyRoles(roles: string[], payload: { title: string; message: string; url: string }) {
  try {
    const { data: roleRows } = await db.from('roles').select('id, name').in('name', roles);
    const roleIds = ((roleRows ?? []) as any[]).map((r) => r.id);
    if (!roleIds.length) return;
    const { data } = await db.from('user_roles').select('user_id').in('role_id', roleIds);
    const ids = [...new Set(((data ?? []) as any[]).map((r) => r.user_id))].filter(Boolean);
    if (!ids.length) return;
    await db.from('app_notifications').insert(
      ids.map((id) => ({
        user_id: id,
        category: 'operations',
        title: payload.title,
        message: payload.message,
        priority: 'high',
        action_url: payload.url,
      })),
    );
  } catch { /* Benachrichtigung ist optional */ }
}

/** Zwischenspeichern der Prüfpunkte (setzt Stufe auf „in Bearbeitung") */
export async function saveChecks(
  approval: DeliveryApproval,
  stage: ApprovalStage,
  checks: Record<string, boolean>,
  comment: string,
) {
  const current = stageStatus(approval, stage);
  const next = current === 'approved' ? 'approved' : (Object.values(checks).some(Boolean) ? 'in_progress' : 'open');
  const { error } = await db
    .from('delivery_approvals')
    .update({
      [`${stage}_checks`]: checks,
      [`${stage}_comment`]: comment || null,
      [`${stage}_status`]: next,
    })
    .eq('id', approval.id);
  if (error) throw error;
}

export function missingRequiredChecks(stage: ApprovalStage, checks: Record<string, boolean>): string[] {
  return stageDef(stage).checks.filter((c) => c.required && !checks[c.key]).map((c) => c.label);
}

/** Endgültige Freigabe einer Stufe */
export async function approveStage(params: {
  approval: DeliveryApproval;
  stage: ApprovalStage;
  checks: Record<string, boolean>;
  comment: string;
  signature: string | null;
  userId: string | null;
  userName: string;
  orderNumber?: string | null;
}) {
  const { approval, stage, checks, comment, signature, userId, userName } = params;

  if (!isStageUnlocked(approval, stage)) {
    throw new Error('Die vorherige Freigabestufe ist noch nicht abgeschlossen.');
  }
  const missing = missingRequiredChecks(stage, checks);
  if (missing.length) {
    throw new Error(`Pflichtprüfpunkte fehlen:\n• ${missing.join('\n• ')}`);
  }
  if (!signature) throw new Error('Digitale Unterschrift ist erforderlich.');

  const ip = await clientIp();
  const old = stageStatus(approval, stage);

  const { data, error } = await db
    .from('delivery_approvals')
    .update({
      [`${stage}_checks`]: checks,
      [`${stage}_comment`]: comment || null,
      [`${stage}_status`]: 'approved',
      [`${stage}_by`]: userId,
      [`${stage}_by_name`]: userName,
      [`${stage}_at`]: new Date().toISOString(),
      [`${stage}_ip`]: ip,
      [`${stage}_signature`]: signature,
    })
    .eq('id', approval.id)
    .select('*')
    .single();
  if (error) throw error;

  await logEvent({
    approvalId: approval.id, orderId: approval.order_id, stage,
    oldStatus: old, newStatus: 'approved',
    userId, userName, comment, ip, signature,
  });

  const updated = data as DeliveryApproval;
  const ref = params.orderNumber ? `Auftrag ${params.orderNumber}` : 'Auftrag';
  const url = `/orders/${approval.order_id}?tab=freigaben`;

  if (updated.overall_status === 'released') {
    await notifyRoles(['Admin', 'Super Admin', 'Order'], {
      title: 'Auftrag vollständig freigegeben',
      message: `${ref} ist zur Auslieferung freigegeben.`,
      url,
    });
  } else {
    const nextStage = STAGES.find((s) => stageStatus(updated, s.stage) !== 'approved');
    if (nextStage) {
      await notifyRoles(nextStage.roles, {
        title: `Freigabe ${nextStage.title} erforderlich`,
        message: `${ref} wartet auf Ihre Freigabe (${nextStage.title}).`,
        url,
      });
    }
  }
  return updated;
}

/** Super-Admin-Entsperrung */
export async function unlockApproval(approval: DeliveryApproval, reason: string, userId: string | null, userName: string) {
  const ip = await clientIp();
  const { error } = await db
    .from('delivery_approvals')
    .update({
      warehouse_status: 'approved',
      accounting_status: 'approved',
      dispatch_status: 'approved',
      unlocked_by: userId,
      unlocked_at: new Date().toISOString(),
      unlock_reason: reason,
    })
    .eq('id', approval.id);
  if (error) throw error;
  await logEvent({
    approvalId: approval.id, orderId: approval.order_id, stage: 'override',
    oldStatus: approval.overall_status, newStatus: 'released',
    userId, userName, comment: `Super-Admin-Entsperrung: ${reason}`, ip,
  });
}

/** SLA-Bewertung einer offenen Stufe */
export function slaLevel(since: string | null | undefined): 'ok' | 'reminder' | 'lead' | 'operations' {
  if (!since) return 'ok';
  const hours = (Date.now() - new Date(since).getTime()) / 36e5;
  if (hours >= SLA_HOURS.operations) return 'operations';
  if (hours >= SLA_HOURS.lead) return 'lead';
  if (hours >= SLA_HOURS.reminder) return 'reminder';
  return 'ok';
}

/** Sammelgenehmigung einer Stufe für mehrere Aufträge (z. B. Buchhaltung für 20 Aufträge). */
export async function bulkApproveStage(params: {
  approvals: DeliveryApproval[];
  stage: ApprovalStage;
  comment: string;
  signature: string;
  userId: string | null;
  userName: string;
}): Promise<{ ok: number; skipped: string[] }> {
  const { approvals, stage, comment, signature, userId, userName } = params;
  if (!signature) throw new Error('Digitale Unterschrift ist erforderlich.');
  const ip = await clientIp();
  const checks: Record<string, boolean> = {};
  for (const c of stageDef(stage).checks) checks[c.key] = true;

  let ok = 0;
  const skipped: string[] = [];
  for (const a of approvals) {
    if (stageStatus(a, stage) === 'approved') continue;
    if (!isStageUnlocked(a, stage)) { skipped.push(a.order_id); continue; }
    const old = stageStatus(a, stage);
    const { error } = await db
      .from('delivery_approvals')
      .update({
        [`${stage}_checks`]: checks,
        [`${stage}_comment`]: comment || 'Sammelfreigabe',
        [`${stage}_status`]: 'approved',
        [`${stage}_by`]: userId,
        [`${stage}_by_name`]: userName,
        [`${stage}_at`]: new Date().toISOString(),
        [`${stage}_ip`]: ip,
        [`${stage}_signature`]: signature,
      })
      .eq('id', a.id);
    if (error) { skipped.push(a.order_id); continue; }
    await logEvent({
      approvalId: a.id, orderId: a.order_id, stage,
      oldStatus: old, newStatus: 'approved',
      userId, userName, comment: `Sammelfreigabe${comment ? `: ${comment}` : ''}`, ip, signature,
    });
    ok++;
  }
  return { ok, skipped };
}

export interface EscalationStat { stage: string; level: number; count: number }

/** Eskalations-Statistik (wie oft Stufe 1/2/3 erreicht wurde – pro Abteilung). */
export async function fetchEscalationStats(): Promise<EscalationStat[]> {
  const { data } = await db
    .from('delivery_approval_events')
    .select('stage, comment')
    .like('comment', 'escalation:%')
    .limit(5000);
  const map = new Map<string, EscalationStat>();
  for (const e of (data ?? []) as any[]) {
    const m = /^escalation:([a-z_]+):L(\d)$/.exec(e.comment ?? '');
    if (!m) continue;
    const key = `${m[1]}:${m[2]}`;
    const cur = map.get(key) ?? { stage: m[1], level: Number(m[2]), count: 0 };
    cur.count++;
    map.set(key, cur);
  }
  return Array.from(map.values()).sort((a, b) => a.stage.localeCompare(b.stage) || a.level - b.level);
}

/**
 * Harte Sperre: prüft, ob ein Auftrag ausgeliefert werden darf.
 * Super Admin darf mit Begründung übersteuern (revisionssicher protokolliert).
 */
export async function assertOrderReleased(params: {
  orderId: string;
  isSuperAdmin?: boolean;
  overrideReason?: string | null;
  userId?: string | null;
  userName?: string | null;
  context?: string;
}): Promise<{ allowed: boolean; missing: string[] }> {
  const approval = await fetchApproval(params.orderId);
  if (isReleased(approval)) return { allowed: true, missing: [] };
  const missing = missingStages(approval);

  if (params.isSuperAdmin && (params.overrideReason ?? '').trim().length >= 5 && approval) {
    await logEvent({
      approvalId: approval.id,
      orderId: params.orderId,
      stage: 'override',
      oldStatus: approval.overall_status,
      newStatus: approval.overall_status,
      userId: params.userId ?? null,
      userName: params.userName ?? 'Super Admin',
      comment: `Sperre übersteuert (${params.context ?? 'Auslieferung'}): ${params.overrideReason}`,
      ip: await clientIp(),
    });
    return { allowed: true, missing };
  }
  return { allowed: false, missing };
}

/** Freigabestatus mehrerer Aufträge (für Ampeln in Übersichtslisten). */
export async function fetchReleaseStatusMap(orderIds: string[]): Promise<Record<string, OverallStatus>> {
  const ids = [...new Set(orderIds.filter(Boolean))];
  const out: Record<string, OverallStatus> = {};
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await db
      .from('delivery_approvals')
      .select('order_id, overall_status')
      .in('order_id', ids.slice(i, i + 200));
    for (const r of (data ?? []) as any[]) out[r.order_id] = r.overall_status;
  }
  return out;
}

export interface EscalationMonth { month: string; l1: number; l2: number; l3: number }

/** Eskalationen als Zeitreihe pro Monat. */
export async function fetchEscalationSeries(): Promise<EscalationMonth[]> {
  const { data } = await db
    .from('delivery_approval_events')
    .select('comment, created_at')
    .like('comment', 'escalation:%')
    .order('created_at', { ascending: true })
    .limit(5000);
  const map = new Map<string, EscalationMonth>();
  for (const e of (data ?? []) as any[]) {
    const m = /^escalation:([a-z_]+):L(\d)$/.exec(e.comment ?? '');
    if (!m) continue;
    const month = String(e.created_at).slice(0, 7);
    const cur = map.get(month) ?? { month, l1: 0, l2: 0, l3: 0 };
    (cur as any)[`l${m[2]}`]++;
    map.set(month, cur);
  }
  return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
}

/** Massen-Anforderung: Freigabeprozess für mehrere Aufträge gleichzeitig starten. */
export async function bulkStartApprovals(orderIds: string[], userName: string): Promise<number> {
  const ids = [...new Set(orderIds.filter(Boolean))];
  if (!ids.length) return 0;
  const { data: existing } = await db.from('delivery_approvals').select('order_id').in('order_id', ids);
  const have = new Set(((existing ?? []) as any[]).map((r) => r.order_id));
  const missing = ids.filter((id) => !have.has(id));
  if (!missing.length) return 0;
  const { data, error } = await db
    .from('delivery_approvals')
    .insert(missing.map((order_id) => ({ order_id })))
    .select('id, order_id');
  if (error) throw error;
  const created = (data ?? []) as any[];
  if (created.length) {
    await db.from('delivery_approval_events').insert(created.map((a) => ({
      approval_id: a.id,
      order_id: a.order_id,
      stage: 'request',
      new_status: 'open',
      user_name: userName,
      comment: 'Freigabeprozess per Massen-Anforderung gestartet',
    })));
    const first = STAGES[0];
    await notifyRoles(first.roles, {
      title: `Freigabe ${first.title} erforderlich`,
      message: `${created.length} Aufträge warten auf Ihre Freigabe (${first.title}).`,
      url: '/operations/auslieferungsfreigabe',
    });
  }
  return created.length;
}


export interface StageDuration { stage: ApprovalStage; title: string; avgHours: number; count: number }

/** Durchlaufzeiten je Freigabestufe (Ø Stunden bis zur Genehmigung). */
export async function fetchStageDurations(): Promise<StageDuration[]> {
  const { data } = await db
    .from('delivery_approvals')
    .select('created_at, warehouse_at, accounting_at, dispatch_at')
    .limit(5000);
  const rows = (data ?? []) as any[];
  const order: ApprovalStage[] = ['warehouse', 'accounting', 'dispatch'];
  return order.map((stage, idx) => {
    let sum = 0;
    let count = 0;
    for (const r of rows) {
      const at = r[`${stage}_at`];
      if (!at) continue;
      const startRaw = idx === 0 ? r.created_at : r[`${order[idx - 1]}_at`];
      if (!startRaw) continue;
      const h = (new Date(at).getTime() - new Date(startRaw).getTime()) / 36e5;
      if (h < 0) continue;
      sum += h;
      count++;
    }
    return { stage, title: stageDef(stage).title, avgHours: count ? sum / count : 0, count };
  });
}

export interface StageDurationMonth {
  month: string;
  warehouse: number | null;
  accounting: number | null;
  dispatch: number | null;
  total: number | null;
  count: number;
}

/** Zeittrend: Ø Stunden bis Freigabe je Stufe, gruppiert nach Monat der Genehmigung. */
export async function fetchStageDurationTrend(months = 12): Promise<StageDurationMonth[]> {
  const since = new Date();
  since.setMonth(since.getMonth() - (months - 1), 1);
  since.setHours(0, 0, 0, 0);
  const { data } = await db
    .from('delivery_approvals')
    .select('created_at, warehouse_at, accounting_at, dispatch_at')
    .gte('created_at', new Date(since.getTime() - 1000 * 60 * 60 * 24 * 120).toISOString())
    .limit(5000);
  const rows = (data ?? []) as any[];
  const order: ApprovalStage[] = ['warehouse', 'accounting', 'dispatch'];
  const acc = new Map<string, { sum: Record<string, number>; n: Record<string, number>; totalSum: number; totalN: number }>();

  for (const r of rows) {
    order.forEach((stage, idx) => {
      const at = r[`${stage}_at`];
      if (!at) return;
      const startRaw = idx === 0 ? r.created_at : r[`${order[idx - 1]}_at`];
      if (!startRaw) return;
      const h = (new Date(at).getTime() - new Date(startRaw).getTime()) / 36e5;
      if (h < 0) return;
      const month = String(at).slice(0, 7);
      if (new Date(`${month}-01T00:00:00Z`).getTime() < since.getTime()) return;
      const cur = acc.get(month) ?? { sum: {}, n: {}, totalSum: 0, totalN: 0 };
      cur.sum[stage] = (cur.sum[stage] ?? 0) + h;
      cur.n[stage] = (cur.n[stage] ?? 0) + 1;
      acc.set(month, cur);
    });
    // Gesamtdurchlauf: Anlage bis letzte Freigabe
    if (r.dispatch_at && r.created_at) {
      const h = (new Date(r.dispatch_at).getTime() - new Date(r.created_at).getTime()) / 36e5;
      const month = String(r.dispatch_at).slice(0, 7);
      if (h >= 0 && new Date(`${month}-01T00:00:00Z`).getTime() >= since.getTime()) {
        const cur = acc.get(month) ?? { sum: {}, n: {}, totalSum: 0, totalN: 0 };
        cur.totalSum += h;
        cur.totalN += 1;
        acc.set(month, cur);
      }
    }
  }

  const avg = (sum?: number, n?: number) => (n ? Number(((sum ?? 0) / n).toFixed(1)) : null);
  return Array.from(acc.entries())
    .map(([month, v]) => ({
      month,
      warehouse: avg(v.sum.warehouse, v.n.warehouse),
      accounting: avg(v.sum.accounting, v.n.accounting),
      dispatch: avg(v.sum.dispatch, v.n.dispatch),
      total: avg(v.totalSum, v.totalN),
      count: (v.n.warehouse ?? 0) + (v.n.accounting ?? 0) + (v.n.dispatch ?? 0),
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

/** Freigabestatus anhand von Auftragsnummern (z. B. Kalender-/Mobileansichten). */
export async function fetchReleaseStatusByOrderNumbers(numbers: string[]): Promise<Record<string, OverallStatus>> {
  const nums = [...new Set(numbers.filter(Boolean))];
  const out: Record<string, OverallStatus> = {};
  if (!nums.length) return out;
  const { data: orders } = await db.from('orders').select('id, order_number').in('order_number', nums);
  const byId = new Map<string, string>();
  for (const o of ((orders ?? []) as any[])) byId.set(o.id, o.order_number);
  if (!byId.size) return out;
  const map = await fetchReleaseStatusMap([...byId.keys()]);
  for (const [id, st] of Object.entries(map)) {
    const num = byId.get(id);
    if (num) out[num] = st;
  }
  return out;
}

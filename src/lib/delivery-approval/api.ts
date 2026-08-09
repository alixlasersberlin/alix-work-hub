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
    const { data } = await db.from('user_roles').select('user_id').in('role', roles);
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

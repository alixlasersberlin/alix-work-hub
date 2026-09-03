/**
 * ALIXWORK MOBILE – PROMPT 9: Go-Live, Rollout, Monitoring (Client-Anbindung).
 *
 * Grundregeln:
 *  - Keine neuen Kernfunktionen: es werden ausschliesslich Release-,
 *    Rollout-, Konfigurations- und Monitoringdaten gelesen/geschrieben.
 *  - Alle Zugriffs-, Wartungs- und Kill-Switch-Entscheidungen kommen
 *    serverseitig aus `mobile_access_state` (RLS + SECURITY DEFINER).
 *    Das Frontend versteckt nur zusätzlich UI – es entscheidet nichts.
 *  - Keine Secrets, keine Fake-Zustände.
 */
import { supabase } from '@/integrations/supabase/client';
import { APP_VERSION_MOBILE, ENVIRONMENT } from '@/lib/mobil/appInfo';

/* ------------------------------------------------------- Betriebszustand */

export type MobileAccessState = {
  allowed: boolean;
  reason: 'OK' | 'NOT_AUTHENTICATED' | 'USER_INACTIVE' | 'MOBILE_ACCESS_OFF' | 'NOT_IN_PILOT' | string;
  environment: string;
  is_admin: boolean;
  groups: string[];
  rollout_stage: number;
  maintenance_mode: boolean;
  maintenance_message: string | null;
  read_only: boolean;
  whatsapp_outbound_enabled: boolean;
  push_enabled: boolean;
  ai_enabled: boolean;
  ticket_creation_enabled: boolean;
  minimum_supported_version: string;
  recommended_version: string;
  update_required: 'NONE' | 'SOFT' | 'HARD' | string;
};

export async function fetchAccessState(): Promise<MobileAccessState | null> {
  const { data, error } = await (supabase as any).rpc('mobile_access_state', {
    p_environment: ENVIRONMENT,
    p_app_version: APP_VERSION_MOBILE,
  });
  if (error || !data) return null;
  return data as MobileAccessState;
}

export const ACCESS_REASON_TEXT: Record<string, string> = {
  NOT_AUTHENTICATED: 'Bitte melden Sie sich an.',
  USER_INACTIVE: 'Ihr Benutzerkonto ist deaktiviert. Bitte wenden Sie sich an die Administration.',
  MOBILE_ACCESS_OFF: 'AlixWork Mobile ist derzeit für alle Benutzer deaktiviert (Not-Aus aktiv).',
  NOT_IN_PILOT: 'AlixWork Mobile ist für Ihr Konto noch nicht freigeschaltet.',
};

/* ------------------------------------------------------------- Konfiguration */

export type MobileAppConfig = {
  id: string;
  environment: string;
  minimum_supported_version: string;
  recommended_version: string;
  rollout_stage: number;
  maintenance_mode: boolean;
  maintenance_message: string | null;
  mobile_read_only: boolean;
  mobile_access_enabled: boolean;
  restrict_to_rollout_groups: boolean;
  whatsapp_outbound_enabled: boolean;
  push_enabled: boolean;
  ai_enabled: boolean;
  ticket_creation_enabled: boolean;
  updated_at: string;
};

export async function fetchConfigs(): Promise<MobileAppConfig[]> {
  const { data, error } = await (supabase as any)
    .from('mobile_app_config').select('*').order('environment');
  if (error) throw error;
  return (data ?? []) as MobileAppConfig[];
}

export async function updateConfig(id: string, patch: Partial<MobileAppConfig>) {
  const { error } = await (supabase as any).from('mobile_app_config').update(patch).eq('id', id);
  if (error) throw error;
}

export type ConfigAuditRow = {
  id: string; environment: string | null; field: string;
  old_value: string | null; new_value: string | null; changed_at: string; changed_by: string | null;
};

export async function fetchConfigAudit(limit = 30): Promise<ConfigAuditRow[]> {
  const { data } = await (supabase as any)
    .from('mobile_config_audit').select('*').order('changed_at', { ascending: false }).limit(limit);
  return (data ?? []) as ConfigAuditRow[];
}

/* ------------------------------------------------------------------ Releases */

export type ReleaseStatus = 'DRAFT' | 'TESTING' | 'RC' | 'PILOT' | 'PRODUCTION' | 'ROLLED_BACK' | 'DEPRECATED';
export type ReleaseStability = 'OBSERVATION' | 'STABLE' | 'DEGRADED' | 'ROLLBACK_RECOMMENDED';

export type AppRelease = {
  id: string;
  version: string;
  build_number: string;
  platform: string;
  release_channel: string;
  status: ReleaseStatus;
  stability: ReleaseStability;
  summary: string | null;
  changes: string[] | null;
  known_issues: string[] | null;
  rollback_plan: string | null;
  released_at: string | null;
  created_at: string;
};

export async function fetchReleases(): Promise<AppRelease[]> {
  const { data, error } = await (supabase as any)
    .from('app_releases').select('*').order('created_at', { ascending: false }).limit(50);
  if (error) throw error;
  return (data ?? []) as AppRelease[];
}

export async function saveRelease(row: Partial<AppRelease> & { version: string; build_number: string }) {
  const { data: auth } = await supabase.auth.getUser();
  const payload: any = { ...row };
  if (row.status === 'PRODUCTION' && !row.released_at) {
    payload.released_at = new Date().toISOString();
    payload.released_by_user_id = auth?.user?.id ?? null;
  }
  const { error } = await (supabase as any).from('app_releases').upsert(payload, {
    onConflict: 'version,build_number,platform',
  });
  if (error) throw error;
}

/* ----------------------------------------------------------------- Incidents */

export type IncidentSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
export type IncidentStatus = 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'IGNORED';

export type MobileIncident = {
  id: string; severity: IncidentSeverity; component: string; error_code: string;
  summary: string; release_version: string | null; customer_impact: string;
  status: IncidentStatus; occurrence_count: number;
  first_seen_at: string; last_seen_at: string; resolved_at: string | null;
};

export async function fetchIncidents(status?: IncidentStatus): Promise<MobileIncident[]> {
  let q = (supabase as any).from('mobile_incidents').select('*')
    .order('last_seen_at', { ascending: false }).limit(200);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as MobileIncident[];
}

export async function setIncidentStatus(id: string, status: IncidentStatus) {
  const patch: any = { status };
  if (status === 'RESOLVED') patch.resolved_at = new Date().toISOString();
  const { error } = await (supabase as any).from('mobile_incidents').update(patch).eq('id', id);
  if (error) throw error;
}

/** Meldet einen technischen Fehler gruppiert (kein Alert-Flood). */
export async function reportIncident(
  component: string, errorCode: string, summary: string,
  severity: IncidentSeverity = 'ERROR', metadata?: Record<string, unknown>,
) {
  try {
    await (supabase as any).rpc('mobile_report_incident', {
      p_component: component,
      p_error_code: errorCode,
      p_summary: summary,
      p_severity: severity,
      p_release_version: APP_VERSION_MOBILE,
      p_metadata: metadata ?? null,
    });
  } catch {
    /* Monitoring darf die App nie blockieren. */
  }
}

/* ------------------------------------------------------------------ Feedback */

export type FeedbackCategory = 'PROBLEM' | 'VERBESSERUNG' | 'UX';
export type MobileFeedback = {
  id: string; user_id: string; category: FeedbackCategory; message: string;
  screen: string | null; app_version: string | null; status: string; created_at: string;
};

export async function sendFeedback(input: {
  category: FeedbackCategory; message: string; screen?: string;
}) {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await (supabase as any).from('mobile_feedback').insert({
    user_id: auth?.user?.id,
    category: input.category,
    message: input.message.slice(0, 4000),
    screen: input.screen ?? null,
    app_version: `${APP_VERSION_MOBILE} (${ENVIRONMENT})`,
    device_info: {
      platform: navigator.platform,
      ua: navigator.userAgent.slice(0, 200),
      viewport: `${window.innerWidth}x${window.innerHeight}`,
    },
  });
  if (error) throw error;
}

export async function fetchFeedback(): Promise<MobileFeedback[]> {
  const { data } = await (supabase as any)
    .from('mobile_feedback').select('*').order('created_at', { ascending: false }).limit(100);
  return (data ?? []) as MobileFeedback[];
}

/* -------------------------------------------------------- Snapshot / Pilot */

export async function fetchGoLiveSnapshot(): Promise<any | null> {
  const { data, error } = await (supabase as any).rpc('mobile_golive_snapshot');
  if (error) return null;
  return data;
}

export async function fetchPilotOverview(): Promise<any | null> {
  const { data, error } = await (supabase as any).rpc('mobile_pilot_overview');
  if (error) return null;
  return data;
}

export async function fetchRolloutGroups() {
  const { data } = await (supabase as any)
    .from('mobile_rollout_groups').select('*').order('stage');
  return data ?? [];
}

export async function setGroupActive(id: string, is_active: boolean) {
  const { error } = await (supabase as any).from('mobile_rollout_groups').update({ is_active }).eq('id', id);
  if (error) throw error;
}

export async function addPilotUser(groupId: string, userId: string) {
  const { error } = await (supabase as any).from('mobile_rollout_users')
    .upsert({ group_id: groupId, user_id: userId, enabled: true }, { onConflict: 'group_id,user_id' });
  if (error) throw error;
}

export async function removePilotUser(groupId: string, userId: string) {
  const { error } = await (supabase as any).from('mobile_rollout_users')
    .delete().eq('group_id', groupId).eq('user_id', userId);
  if (error) throw error;
}

/* --------------------------------------------------------- Integrationstatus */

export type IntegrationHealthRow = {
  integration: string; status: string;
  last_success_at: string | null; last_failure_at: string | null;
  last_error_code: string | null; last_error_summary: string | null; updated_at: string;
};

export async function fetchIntegrationHealth(): Promise<IntegrationHealthRow[]> {
  const { data } = await (supabase as any)
    .from('integration_health').select('*').order('integration');
  return (data ?? []) as IntegrationHealthRow[];
}

// EAOC – Enterprise Administration & Organization Center
// Additive module; localStorage-backed. No changes to existing tables/schema.

export type EaocRecord = { id: string; createdAt: string; updatedAt: string; tenant: string; [k: string]: any };

export type EaocSectionKey =
  | "companies" | "tenants" | "locations" | "departments" | "users"
  | "roles" | "permissions" | "teams" | "branding" | "integrations"
  | "api_keys" | "webhooks" | "licenses" | "security_policies"
  | "system_settings" | "notifications" | "jobs" | "backups"
  | "oauth_clients" | "sso_providers" | "feature_flags";

export interface EaocAuditEntry {
  id: string;
  ts: string;
  user: string;
  ip: string;
  action: string;
  section: string;
  entityId?: string;
  before?: any;
  after?: any;
}

export interface EaocMaintenance {
  active: boolean;
  message: string;
  startsAt?: string;
  endsAt?: string;
}

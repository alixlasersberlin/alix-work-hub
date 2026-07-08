const KEY = 'ecp:audit:v1';
export interface EcpAuditEntry { id: string; ts: string; action: string; meta?: Record<string, unknown>; }

export function logEcp(action: string, meta?: Record<string, unknown>) {
  try {
    const list: EcpAuditEntry[] = JSON.parse(localStorage.getItem(KEY) || '[]');
    list.push({ id: crypto.randomUUID(), ts: new Date().toISOString(), action, meta });
    localStorage.setItem(KEY, JSON.stringify(list.slice(-500)));
  } catch { /* ignore */ }
}

export function listEcpAudit(): EcpAuditEntry[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

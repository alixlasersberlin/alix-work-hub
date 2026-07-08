import { enqueue } from './offline';

export function auditMobile(action: string, meta: Record<string, unknown> = {}) {
  enqueue({ kind: 'audit', payload: { action, meta, ts: new Date().toISOString(), ua: navigator.userAgent } });
}

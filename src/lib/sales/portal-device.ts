export function canInstallSalesPortal(active: boolean, roles: readonly string[], device: { approval_status: string; revoked_at: string | null; blocked_at: string | null } | null): boolean {
  return active && roles.length > 0 && device?.approval_status === 'approved' && !device.revoked_at && !device.blocked_at;
}
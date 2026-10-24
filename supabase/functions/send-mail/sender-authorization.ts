// Only server-verified RPC results may authorize a sender. Roles are stored
// through user_roles.role_id -> roles, not a user_roles.role text column.
export async function isSenderAuthorized(
  isAdmin: unknown,
  allowedRoles: readonly string[],
  hasRole: (role: string) => Promise<{ data: unknown; error: unknown }>,
): Promise<boolean> {
  if (isAdmin === true) return true;
  for (const role of allowedRoles) {
    const result = await hasRole(role);
    if (!result.error && result.data === true) return true;
  }
  return false;
}
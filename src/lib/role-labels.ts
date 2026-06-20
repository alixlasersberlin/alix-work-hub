// UI-only display labels for roles. The underlying role names in the database
// (user_roles.role / roles.name) and all RBAC checks remain unchanged.
const ROLE_DISPLAY: Record<string, string> = {
  Admin: "Chief Operations",
};

export function displayRoleName(name?: string | null): string {
  if (!name) return "";
  return ROLE_DISPLAY[name] ?? name;
}

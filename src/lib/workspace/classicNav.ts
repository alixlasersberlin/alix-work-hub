import { navItems, type NavChild } from '@/lib/nav/navItems';
import type { WorkspaceNavEntry } from '@/contexts/WorkspaceContext';

/**
 * Zuordnung der klassischen Hauptmenü-Gruppen zu den Workspaces.
 * Reihenfolge = Reihenfolge der Sektionen im Workspace-Menü.
 */
export const WORKSPACE_CLASSIC_GROUPS: Record<string, string[]> = {
  verkauf: [
    'DASHBOARDS',
    'VERKAUF',
    'CUSTOMER CARE',
    'FEEDBACK & REWARDS',
    'ALIX CONNECT',
    'TICKETS',
    'ALIX i-COM',
    'TEAMKALENDER',
  ],
  buchhaltung: [
    'DASHBOARDS',
    'BUCHHALTUNG',
    'GERÄTESPERREN',
    'ALIXDOCS',
    'TEAMKALENDER',
  ],
  lager: [
    'DASHBOARDS',
    'LAGER & WERKSTATT',
    'TOURENPLANUNG',
    'EINKAUF',
    'TEAMKALENDER',
  ],
  fertigung: [
    'DASHBOARDS',
    'PRODUKTION & BESCHAFFUNG',
    'LAGER & WERKSTATT',
    'TEAMKALENDER',
  ],
  tourenplanung: [
    'DASHBOARDS',
    'TOURENPLANUNG',
    'LAGER & WERKSTATT',
    'TICKETS',
    'TEAMKALENDER',
  ],
  operation: [
    'DASHBOARDS',
    'OPERATIONS',
    'ALIXDOCS',
    'ALIX AI DIENSTE',
    'ALIX i-COM',
    'TICKETS',
    'TEAMKALENDER',
    'KONTAKT',
  ],
};

const allowed = (roles: string[] | null | undefined, userRoles: string[], isSuper: boolean) => {
  if (isSuper) return true;
  if (!roles || roles.length === 0) return true;
  return roles.some(r => userRoles.includes(r));
};

/**
 * Baut die Workspace-Navigation aus dem klassischen Menü auf –
 * inklusive Rollenfilter auf jeder Ebene.
 */
export function classicNavForWorkspace(
  workspaceCode: string | null | undefined,
  workspaceId: string,
  userRoles: string[],
  isSuper: boolean,
): WorkspaceNavEntry[] {
  if (!workspaceCode) return [];
  const groups = WORKSPACE_CLASSIC_GROUPS[workspaceCode];
  if (!groups) return [];

  const out: WorkspaceNavEntry[] = [];
  let order = 0;

  const push = (item: NavChild, section: string) => {
    if (item.path.startsWith('#')) return;
    if (out.some(e => e.path === item.path && e.section === section)) return;
    out.push({
      id: `classic:${section}:${item.path}:${order}`,
      workspace_id: workspaceId,
      label: item.label,
      path: item.path,
      icon: '',
      section,
      roles: item.roles ?? null,
      tenant_codes: null,
      sort_order: order++,
      is_active: true,
      IconComp: item.icon,
    } as WorkspaceNavEntry);
  };

  for (const groupLabel of groups) {
    const group = navItems.find(g => g.label === groupLabel);
    if (!group) continue;
    if (!allowed(group.roles, userRoles, isSuper)) continue;

    const children = group.children || [];
    if (children.length === 0) {
      push(group, groupLabel);
      continue;
    }

    for (const child of children) {
      if (!allowed(child.roles, userRoles, isSuper)) continue;
      const sub = child.children || [];
      if (sub.length === 0) {
        push(child, groupLabel);
      } else {
        const section = `${groupLabel} › ${child.label}`;
        for (const leaf of sub) {
          if (!allowed(leaf.roles, userRoles, isSuper)) continue;
          push(leaf, section);
        }
      }
    }
  }

  return out;
}

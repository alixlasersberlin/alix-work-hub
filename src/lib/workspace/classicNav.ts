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
    'ALIX CONNECT',
    'TICKETS',
    'ALIX i-COM',
    'ALIXDOCS',
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
    'VERKAUF',
    'ALIXDOCS',
    'TEAMKALENDER',
  ],
  fertigung: [
    'DASHBOARDS',
    'OPERATIONS › PRODUKTION & BESCHAFFUNG',
    'LAGER & WERKSTATT',
    'ALIXDOCS',
    'TEAMKALENDER',
  ],
  tourenplanung: [
    'DASHBOARDS',
    'TOURENPLANUNG',
    'LAGER & WERKSTATT',
    'TICKETS',
    'VERKAUF',
    'ALIXDOCS',
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
  alixdocs: [
    'DASHBOARDS',
    'ALIXDOCS',
    'TEAMKALENDER',
  ],
  teamkalender: [
    'DASHBOARDS',
    'TEAMKALENDER',
    'TOURENPLANUNG',
    'ALIXDOCS',
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

  for (const groupRef of groups) {
    // Unterstützt "GRUPPE" und "GRUPPE › UNTERGRUPPE"
    const [rootLabel, subLabel] = groupRef.split('›').map(s => s.trim());
    const root = navItems.find(g => g.label === rootLabel);
    if (!root) continue;
    if (!allowed(root.roles, userRoles, isSuper)) continue;

    const group = subLabel
      ? (root.children || []).find(c => c.label === subLabel)
      : root;
    if (!group) continue;
    if (!allowed(group.roles, userRoles, isSuper)) continue;

    const groupLabel = subLabel || rootLabel;
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

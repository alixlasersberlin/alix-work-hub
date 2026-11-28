export type StudioNode = { id: string; type: 'trigger' | 'condition' | 'action'; kind: string; params?: Record<string, unknown>; next?: string | null; next_true?: string | null; next_false?: string | null };

/** Persist the full graph as a disabled draft, never flatten branching into a rule. */
export function studioDraft(flow: { name: string; description?: string; nodes: StudioNode[] }, tenantId: string, userId: string) {
  return {
    name: flow.name, description: flow.description ?? null,
    steps: flow.nodes,
    enabled: false,
    channels: [],
    handoff_rules: { studio_version: 'phase36', tenant_id: tenantId, created_by: userId, full_flow: flow },
  };
}
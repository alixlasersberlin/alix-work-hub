// Workflow engine: consumes ESC events and executes declarative actions.
// Individual actions are pluggable. Unimplemented actions log an intent
// so other modules can hook in later without touching ESC internals.

import { subscribe, type EscEvent, type EscEventName } from '@/lib/esc/events/bus';
import { findWorkflowsFor, type WorkflowAction } from './definitions';

type Executor = (action: WorkflowAction, event: EscEvent) => void | Promise<void>;
const executors = new Map<WorkflowAction['kind'], Executor>();

export function registerExecutor(kind: WorkflowAction['kind'], fn: Executor) {
  executors.set(kind, fn);
}

async function runAction(action: WorkflowAction, event: EscEvent) {
  const impl = executors.get(action.kind);
  if (impl) return impl(action, event);
  // No executor yet — log intent so it can be wired up later.
  if (typeof console !== 'undefined') {
    console.info('[esc.workflow] pending action', action.kind, action.config, event.name);
  }
}

let started = false;
export function startWorkflowEngine() {
  if (started) return;
  started = true;
  subscribe('*', async (event) => {
    const payload = event.payload as { kind?: string; departmentId?: string } | undefined;
    const workflows = findWorkflowsFor(event.name as EscEventName, payload?.kind, payload?.departmentId);
    for (const wf of workflows) {
      for (const action of wf.actions) {
        try { await runAction(action, event); }
        catch (err) { console.error('[esc.workflow] action failed', wf.id, action.kind, err); }
      }
    }
  });
}
